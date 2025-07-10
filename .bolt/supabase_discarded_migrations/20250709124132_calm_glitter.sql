/*
  # Expense Automation and FX Integration

  1. Database Schema Updates
    - Add FX-related columns to expenses table
    - Create upsert_fx_rate function
    - Create auto_journal_expense function
    - Create trigger for automatic journal entries

  2. New Functions
    - upsert_fx_rate: Handle FX rate upserts with audit logging
    - auto_journal_expense: Automatically create journal entries for expenses
    - get_fx_rate: Fetch latest FX rate for a currency pair

  3. Triggers
    - trigger_auto_journal_expense: Auto-generate journal entries for expenses
*/

-- Add FX-related columns to expenses table
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(10,6),
ADD COLUMN IF NOT EXISTS bdt_amount NUMERIC(15,2),
ADD COLUMN IF NOT EXISTS fx_calculation_method TEXT DEFAULT 'foreign_to_bdt' CHECK (fx_calculation_method IN ('foreign_to_bdt', 'bdt_to_foreign')),
ADD COLUMN IF NOT EXISTS fx_rate_source TEXT DEFAULT 'Manual',
ADD COLUMN IF NOT EXISTS bdt_calculated_amount NUMERIC(15,2);

-- Create get_fx_rate function
CREATE OR REPLACE FUNCTION get_fx_rate(
  p_from_currency TEXT,
  p_to_currency TEXT DEFAULT 'BDT',
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS NUMERIC(10,6)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rate NUMERIC(10,6);
BEGIN
  SELECT rate INTO v_rate
  FROM fx_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND date <= p_date
    AND is_active = true
  ORDER BY date DESC
  LIMIT 1;
  
  RETURN v_rate;
END;
$$;

-- Create upsert_fx_rate function
CREATE OR REPLACE FUNCTION upsert_fx_rate(
  p_from_currency TEXT,
  p_to_currency TEXT DEFAULT 'BDT',
  p_date DATE DEFAULT CURRENT_DATE,
  p_rate NUMERIC(10,6),
  p_source TEXT DEFAULT 'Manual',
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rate_id UUID;
  v_old_rate NUMERIC(10,6);
  v_operation_type TEXT;
BEGIN
  -- Check if rate already exists
  SELECT id, rate INTO v_rate_id, v_old_rate
  FROM fx_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND date = p_date;

  IF v_rate_id IS NOT NULL THEN
    -- Update existing rate
    UPDATE fx_rates
    SET rate = p_rate,
        source = p_source,
        notes = p_notes,
        modified_by = auth.uid(),
        modified_at = NOW()
    WHERE id = v_rate_id;
    
    v_operation_type := 'UPDATE';
    
    -- Log audit trail for update
    PERFORM log_audit_trail(
      'fx_rates',
      v_rate_id::TEXT,
      'UPDATE',
      jsonb_build_object('rate', v_old_rate),
      jsonb_build_object('rate', p_rate, 'source', p_source),
      'FX rate updated via upsert_fx_rate',
      'fx_rates'
    );
  ELSE
    -- Insert new rate
    INSERT INTO fx_rates (
      from_currency,
      to_currency,
      date,
      rate,
      source,
      notes,
      created_by
    ) VALUES (
      p_from_currency,
      p_to_currency,
      p_date,
      p_rate,
      p_source,
      p_notes,
      auth.uid()
    ) RETURNING id INTO v_rate_id;
    
    v_operation_type := 'CREATE';
    
    -- Log audit trail for insert
    PERFORM log_audit_trail(
      'fx_rates',
      v_rate_id::TEXT,
      'CREATE',
      NULL,
      jsonb_build_object('rate', p_rate, 'source', p_source, 'from_currency', p_from_currency, 'to_currency', p_to_currency, 'date', p_date),
      'FX rate created via upsert_fx_rate',
      'fx_rates'
    );
  END IF;

  RETURN v_rate_id;
END;
$$;

-- Create auto_journal_expense function
CREATE OR REPLACE FUNCTION auto_journal_expense()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_journal_entry_id UUID;
  v_entry_number TEXT;
  v_bdt_amount NUMERIC(15,2);
  v_exchange_rate NUMERIC(10,6);
  v_expense_account_code TEXT;
  v_cash_account_code TEXT;
  v_bank_account_currency TEXT;
  v_description TEXT;
  v_operation_type TEXT;
BEGIN
  -- Determine operation type
  IF TG_OP = 'INSERT' THEN
    v_operation_type := 'CREATE';
  ELSIF TG_OP = 'UPDATE' THEN
    v_operation_type := 'UPDATE';
  ELSIF TG_OP = 'DELETE' THEN
    v_operation_type := 'DELETE';
    -- For DELETE, use OLD record
    NEW := OLD;
  END IF;

  -- Only process if expense is paid
  IF NEW.status != 'paid' AND TG_OP != 'DELETE' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Calculate BDT amount
  IF NEW.currency = 'BDT' THEN
    v_bdt_amount := NEW.amount;
    v_exchange_rate := 1.0;
  ELSE
    v_exchange_rate := COALESCE(NEW.exchange_rate, get_fx_rate(NEW.currency, 'BDT', NEW.date::DATE));
    IF v_exchange_rate IS NULL THEN
      RAISE EXCEPTION 'No exchange rate found for % to BDT on %', NEW.currency, NEW.date;
    END IF;
    v_bdt_amount := NEW.amount * v_exchange_rate;
  END IF;

  -- Update bdt_calculated_amount if this is an INSERT or UPDATE
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE expenses 
    SET bdt_calculated_amount = v_bdt_amount,
        exchange_rate = v_exchange_rate
    WHERE id = NEW.id;
  END IF;

  -- Generate journal entry number
  SELECT 'JE-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || 
         LPAD((COUNT(*) + 1)::TEXT, 4, '0')
  INTO v_entry_number
  FROM journal_entries
  WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM CURRENT_DATE);

  -- Determine account codes based on expense category and payment method
  CASE NEW.category
    WHEN 'Office Rent' THEN v_expense_account_code := '5000';
    WHEN 'Utilities' THEN v_expense_account_code := '5100';
    WHEN 'Software Licenses' THEN v_expense_account_code := '5200';
    WHEN 'Professional Services' THEN v_expense_account_code := '5300';
    WHEN 'Bank Charges' THEN v_expense_account_code := '5400';
    WHEN 'Marketing' THEN v_expense_account_code := '5800';
    WHEN 'Travel' THEN v_expense_account_code := '5900';
    ELSE v_expense_account_code := '5999'; -- Other expenses
  END CASE;

  -- Determine cash/bank account
  IF NEW.payment_method = 'cash' THEN
    v_cash_account_code := '1000'; -- Cash
  ELSE
    -- Get bank account currency if available
    IF NEW.bank_account_id IS NOT NULL THEN
      SELECT currency INTO v_bank_account_currency
      FROM bank_accounts
      WHERE id = NEW.bank_account_id;
      
      IF v_bank_account_currency = 'BDT' THEN
        v_cash_account_code := '1100'; -- Bank - Local Currency
      ELSE
        v_cash_account_code := '1200'; -- Bank - Foreign Currency
      END IF;
    ELSE
      v_cash_account_code := '1100'; -- Default to local bank
    END IF;
  END IF;

  -- Create description
  v_description := 'Auto: ' || NEW.category || ' - ' || NEW.description;
  IF TG_OP = 'DELETE' THEN
    v_description := 'Reversal: ' || v_description;
  END IF;

  -- Create journal entry
  INSERT INTO journal_entries (
    entry_number,
    date,
    description,
    reference,
    total_debit,
    total_credit,
    status,
    entry_type,
    source_document_type,
    source_document_id,
    is_auto_generated,
    user_id
  ) VALUES (
    v_entry_number,
    NEW.date::DATE,
    v_description,
    NEW.expense_number,
    v_bdt_amount,
    v_bdt_amount,
    'posted',
    'auto',
    'expense',
    NEW.id::TEXT,
    true,
    NEW.user_id
  ) RETURNING id INTO v_journal_entry_id;

  -- Create journal entry lines
  IF TG_OP = 'DELETE' THEN
    -- Reverse the entries for deletion
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_code,
      account_name,
      account_type,
      debit_amount,
      credit_amount,
      bdt_debit_amount,
      bdt_credit_amount,
      original_currency,
      original_amount,
      fx_rate,
      description
    ) VALUES 
    (
      v_journal_entry_id,
      v_cash_account_code,
      CASE v_cash_account_code
        WHEN '1000' THEN 'Cash'
        WHEN '1100' THEN 'Bank - Local Currency'
        WHEN '1200' THEN 'Bank - Foreign Currency'
      END,
      'asset',
      v_bdt_amount,
      0,
      v_bdt_amount,
      0,
      NEW.currency,
      NEW.amount,
      v_exchange_rate,
      'Reversal: Payment for ' || NEW.description
    ),
    (
      v_journal_entry_id,
      v_expense_account_code,
      NEW.category,
      'expense',
      0,
      v_bdt_amount,
      0,
      v_bdt_amount,
      NEW.currency,
      NEW.amount,
      v_exchange_rate,
      'Reversal: ' || NEW.description
    );
  ELSE
    -- Normal entries for INSERT/UPDATE
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      account_code,
      account_name,
      account_type,
      debit_amount,
      credit_amount,
      bdt_debit_amount,
      bdt_credit_amount,
      original_currency,
      original_amount,
      fx_rate,
      description
    ) VALUES 
    (
      v_journal_entry_id,
      v_expense_account_code,
      NEW.category,
      'expense',
      v_bdt_amount,
      0,
      v_bdt_amount,
      0,
      NEW.currency,
      NEW.amount,
      v_exchange_rate,
      NEW.description
    ),
    (
      v_journal_entry_id,
      v_cash_account_code,
      CASE v_cash_account_code
        WHEN '1000' THEN 'Cash'
        WHEN '1100' THEN 'Bank - Local Currency'
        WHEN '1200' THEN 'Bank - Foreign Currency'
      END,
      'asset',
      0,
      v_bdt_amount,
      0,
      v_bdt_amount,
      NEW.currency,
      NEW.amount,
      v_exchange_rate,
      'Payment for ' || NEW.description
    );
  END IF;

  -- Update expense with journal entry ID
  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE expenses 
    SET journal_entry_id = v_journal_entry_id
    WHERE id = NEW.id;
  END IF;

  -- Insert FX rate snapshot for foreign currency expenses
  IF NEW.currency != 'BDT' THEN
    INSERT INTO fx_rate_snapshots (
      transaction_table,
      transaction_id,
      currency,
      rate,
      rate_date
    ) VALUES (
      'expenses',
      NEW.id,
      NEW.currency,
      v_exchange_rate,
      NEW.date::DATE
    );
  END IF;

  -- Create auto journal entry record
  INSERT INTO auto_journal_entries (
    source_table,
    source_id,
    journal_entry_id,
    operation_type,
    is_reversal
  ) VALUES (
    'expenses',
    NEW.id,
    v_journal_entry_id,
    v_operation_type,
    TG_OP = 'DELETE'
  );

  -- Log audit trail
  PERFORM log_audit_trail(
    'expenses',
    NEW.id::TEXT,
    v_operation_type,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END,
    'Auto journal entry created for expense: ' || NEW.expense_number,
    'expenses'
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create trigger for auto journal entries on expenses
DROP TRIGGER IF EXISTS trigger_auto_journal_expense ON expenses;
CREATE TRIGGER trigger_auto_journal_expense
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW
  WHEN (
    (TG_OP = 'INSERT' AND NEW.status = 'paid') OR
    (TG_OP = 'UPDATE' AND NEW.status = 'paid' AND (OLD.status != 'paid' OR OLD.amount != NEW.amount OR OLD.currency != NEW.currency)) OR
    (TG_OP = 'DELETE' AND OLD.status = 'paid')
  )
  EXECUTE FUNCTION auto_journal_expense();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_fx_rate TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_fx_rate TO authenticated;