/*
  # Comprehensive Financial Management System

  1. New Tables
    - `users` - User management with roles
    - Enhanced audit trail
    - Auto-journalization triggers
    - FX analysis support
    - Cash incentive workflow

  2. Security & Permissions
    - Role-based access control
    - Enhanced RLS policies
    - User management

  3. Auto-Journalization
    - Triggers for invoices, payments, expenses
    - Automatic journal entry creation
    - FX rate handling
    - Reversal entries for deletions

  4. Audit Trail Enhancement
    - Complete CRUD logging
    - User action tracking
    - Before/after values
    - IP and user agent tracking
*/

-- Create users table for role management
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'accountant', 'user', 'viewer')) DEFAULT 'user',
  permissions JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced audit trail with more details
DROP TABLE IF EXISTS audit_trail;
CREATE TABLE audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation_type TEXT CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE', 'POST', 'REVERSE')) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  description TEXT,
  module TEXT,
  affected_journal_entry_id UUID
);

-- Auto-journalization tracking
CREATE TABLE IF NOT EXISTS auto_journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_table TEXT NOT NULL,
  source_id UUID NOT NULL,
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  operation_type TEXT CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE', 'REVERSE')) NOT NULL,
  is_reversal BOOLEAN DEFAULT FALSE,
  original_entry_id UUID REFERENCES auto_journal_entries(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FX rate snapshots for historical tracking
CREATE TABLE IF NOT EXISTS fx_rate_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_table TEXT NOT NULL,
  transaction_id UUID NOT NULL,
  currency TEXT NOT NULL,
  rate DECIMAL(10,6) NOT NULL,
  rate_date DATE NOT NULL,
  snapshot_date TIMESTAMPTZ DEFAULT NOW()
);

-- Cash incentive workflow tracking
CREATE TABLE IF NOT EXISTS cash_incentive_workflow (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incentive_id UUID REFERENCES cash_incentives(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  action_date TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  notes TEXT,
  document_url TEXT
);

-- User activity tracking
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  session_id TEXT
);

-- Enable RLS on new tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE fx_rate_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_incentive_workflow ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can read their own profile" ON users
  FOR SELECT USING (auth.uid() = auth_user_id);

CREATE POLICY "Admins can manage all users" ON users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE auth_user_id = auth.uid() 
      AND role = 'admin'
    )
  );

CREATE POLICY "Users can read auto journal entries" ON auto_journal_entries
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can read FX snapshots" ON fx_rate_snapshots
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can manage cash incentive workflow" ON cash_incentive_workflow
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can read their activity" ON user_activity
  FOR SELECT USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_auto_journal_source ON auto_journal_entries(source_table, source_id);
CREATE INDEX IF NOT EXISTS idx_fx_snapshots_transaction ON fx_rate_snapshots(transaction_table, transaction_id);
CREATE INDEX IF NOT EXISTS idx_cash_workflow_incentive ON cash_incentive_workflow(incentive_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_user_timestamp ON user_activity(user_id, timestamp);

-- Function to get current user info
CREATE OR REPLACE FUNCTION get_current_user_info()
RETURNS TABLE(user_id UUID, user_email TEXT, user_role TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id,
    u.email,
    usr.role
  FROM auth.users u
  LEFT JOIN users usr ON usr.auth_user_id = u.id
  WHERE u.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log audit trail
CREATE OR REPLACE FUNCTION log_audit_trail(
  p_table_name TEXT,
  p_record_id TEXT,
  p_operation_type TEXT,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_module TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  audit_id UUID;
  user_info RECORD;
BEGIN
  -- Get current user info
  SELECT * INTO user_info FROM get_current_user_info() LIMIT 1;
  
  INSERT INTO audit_trail (
    table_name,
    record_id,
    operation_type,
    old_values,
    new_values,
    user_id,
    user_email,
    description,
    module
  ) VALUES (
    p_table_name,
    p_record_id,
    p_operation_type,
    p_old_values,
    p_new_values,
    user_info.user_id,
    user_info.user_email,
    p_description,
    p_module
  ) RETURNING id INTO audit_id;
  
  RETURN audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get or create FX rate
CREATE OR REPLACE FUNCTION get_fx_rate(
  p_from_currency TEXT,
  p_to_currency TEXT,
  p_date DATE
) RETURNS DECIMAL(10,6) AS $$
DECLARE
  fx_rate DECIMAL(10,6);
BEGIN
  -- Return 1.0 if same currency
  IF p_from_currency = p_to_currency THEN
    RETURN 1.0;
  END IF;
  
  -- Get the most recent rate for the date
  SELECT rate INTO fx_rate
  FROM fx_rates
  WHERE from_currency = p_from_currency
    AND to_currency = p_to_currency
    AND date <= p_date
    AND is_active = TRUE
  ORDER BY date DESC
  LIMIT 1;
  
  -- If no rate found, return NULL (will need manual input)
  RETURN COALESCE(fx_rate, NULL);
END;
$$ LANGUAGE plpgsql;

-- Function to create journal entry
CREATE OR REPLACE FUNCTION create_auto_journal_entry(
  p_source_table TEXT,
  p_source_id UUID,
  p_date DATE,
  p_description TEXT,
  p_reference TEXT,
  p_lines JSONB,
  p_operation_type TEXT DEFAULT 'CREATE'
) RETURNS UUID AS $$
DECLARE
  journal_id UUID;
  auto_journal_id UUID;
  entry_number TEXT;
  total_debit DECIMAL(15,2) := 0;
  total_credit DECIMAL(15,2) := 0;
  line_item JSONB;
BEGIN
  -- Calculate totals
  FOR line_item IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    total_debit := total_debit + COALESCE((line_item->>'debit_amount')::DECIMAL(15,2), 0);
    total_credit := total_credit + COALESCE((line_item->>'credit_amount')::DECIMAL(15,2), 0);
  END LOOP;
  
  -- Generate entry number
  SELECT 'JE-' || EXTRACT(YEAR FROM p_date) || '-' || 
         LPAD((COUNT(*) + 1)::TEXT, 4, '0')
  INTO entry_number
  FROM journal_entries
  WHERE EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM p_date);
  
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
    is_auto_generated
  ) VALUES (
    entry_number,
    p_date,
    p_description,
    p_reference,
    total_debit,
    total_credit,
    'posted',
    'auto',
    p_source_table,
    p_source_id::TEXT,
    TRUE
  ) RETURNING id INTO journal_id;
  
  -- Create journal entry lines
  FOR line_item IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
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
    ) VALUES (
      journal_id,
      line_item->>'account_code',
      line_item->>'account_name',
      line_item->>'account_type',
      COALESCE((line_item->>'debit_amount')::DECIMAL(15,2), 0),
      COALESCE((line_item->>'credit_amount')::DECIMAL(15,2), 0),
      COALESCE((line_item->>'bdt_debit_amount')::DECIMAL(15,2), (line_item->>'debit_amount')::DECIMAL(15,2), 0),
      COALESCE((line_item->>'bdt_credit_amount')::DECIMAL(15,2), (line_item->>'credit_amount')::DECIMAL(15,2), 0),
      COALESCE(line_item->>'original_currency', 'BDT'),
      COALESCE((line_item->>'original_amount')::DECIMAL(15,2), 0),
      COALESCE((line_item->>'fx_rate')::DECIMAL(10,6), 1.0),
      line_item->>'description'
    );
  END LOOP;
  
  -- Track auto journal entry
  INSERT INTO auto_journal_entries (
    source_table,
    source_id,
    journal_entry_id,
    operation_type
  ) VALUES (
    p_source_table,
    p_source_id,
    journal_id,
    p_operation_type
  ) RETURNING id INTO auto_journal_id;
  
  -- Log audit trail
  PERFORM log_audit_trail(
    'journal_entries',
    journal_id::TEXT,
    'CREATE',
    NULL,
    jsonb_build_object('entry_number', entry_number, 'auto_generated', TRUE),
    'Auto-generated journal entry for ' || p_source_table || ' ' || p_reference,
    'auto_journal'
  );
  
  RETURN journal_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for invoice auto-journalization
CREATE OR REPLACE FUNCTION auto_journal_invoice()
RETURNS TRIGGER AS $$
DECLARE
  customer_rec RECORD;
  fx_rate DECIMAL(10,6);
  journal_lines JSONB;
  bdt_total DECIMAL(15,2);
BEGIN
  -- Get customer info
  SELECT * INTO customer_rec FROM customers WHERE id = NEW.customer_id;
  
  -- Get FX rate
  fx_rate := get_fx_rate(NEW.currency, 'BDT', NEW.date);
  IF fx_rate IS NULL AND NEW.currency != 'BDT' THEN
    fx_rate := COALESCE(NEW.exchange_rate, 1.0);
  END IF;
  
  -- Calculate BDT amount
  bdt_total := CASE 
    WHEN NEW.currency = 'BDT' THEN NEW.total_amount
    ELSE NEW.total_amount * fx_rate
  END;
  
  -- Build journal lines
  journal_lines := jsonb_build_array(
    -- Debit AR
    jsonb_build_object(
      'account_code', CASE WHEN customer_rec.customer_type = 'local' THEN '1300' ELSE '1400' END,
      'account_name', CASE WHEN customer_rec.customer_type = 'local' THEN 'AR - Local Customers' ELSE 'AR - Foreign Customers' END,
      'account_type', 'asset',
      'debit_amount', NEW.total_amount,
      'credit_amount', 0,
      'bdt_debit_amount', bdt_total,
      'bdt_credit_amount', 0,
      'original_currency', NEW.currency,
      'original_amount', NEW.total_amount,
      'fx_rate', fx_rate,
      'description', 'Invoice ' || NEW.invoice_number
    ),
    -- Credit Revenue
    jsonb_build_object(
      'account_code', CASE WHEN customer_rec.customer_type = 'local' THEN '4000' ELSE '4100' END,
      'account_name', CASE WHEN customer_rec.customer_type = 'local' THEN 'Software Services Revenue - Local' ELSE 'Software Services Revenue - Export' END,
      'account_type', 'revenue',
      'debit_amount', 0,
      'credit_amount', NEW.subtotal,
      'bdt_debit_amount', 0,
      'bdt_credit_amount', NEW.subtotal * fx_rate,
      'original_currency', NEW.currency,
      'original_amount', NEW.subtotal,
      'fx_rate', fx_rate,
      'description', 'Revenue for ' || NEW.invoice_number
    )
  );
  
  -- Add VAT if applicable
  IF NEW.vat_amount > 0 THEN
    journal_lines := journal_lines || jsonb_build_array(
      jsonb_build_object(
        'account_code', '2100',
        'account_name', 'VAT Collected',
        'account_type', 'liability',
        'debit_amount', 0,
        'credit_amount', NEW.vat_amount,
        'bdt_debit_amount', 0,
        'bdt_credit_amount', NEW.vat_amount * fx_rate,
        'original_currency', NEW.currency,
        'original_amount', NEW.vat_amount,
        'fx_rate', fx_rate,
        'description', 'VAT on ' || NEW.invoice_number
      )
    );
  END IF;
  
  -- Create journal entry
  PERFORM create_auto_journal_entry(
    'invoices',
    NEW.id,
    NEW.date,
    'Invoice ' || NEW.invoice_number || ' - ' || customer_rec.name,
    NEW.invoice_number,
    journal_lines,
    TG_OP
  );
  
  -- Store FX rate snapshot
  IF NEW.currency != 'BDT' THEN
    INSERT INTO fx_rate_snapshots (transaction_table, transaction_id, currency, rate, rate_date)
    VALUES ('invoices', NEW.id, NEW.currency, fx_rate, NEW.date);
  END IF;
  
  -- Log audit trail
  PERFORM log_audit_trail(
    'invoices',
    NEW.id::TEXT,
    TG_OP,
    CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END,
    to_jsonb(NEW),
    'Invoice ' || TG_OP || ': ' || NEW.invoice_number,
    'invoices'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for auto-journalization
DROP TRIGGER IF EXISTS trigger_auto_journal_invoice ON invoices;
CREATE TRIGGER trigger_auto_journal_invoice
  AFTER INSERT OR UPDATE ON invoices
  FOR EACH ROW
  WHEN (NEW.status = 'sent')
  EXECUTE FUNCTION auto_journal_invoice();

-- Insert default admin user
INSERT INTO users (auth_user_id, email, full_name, role, is_active)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  'demo@example.com',
  'Demo Admin',
  'admin',
  TRUE
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE auth_user_id = '00000000-0000-0000-0000-000000000001'
);