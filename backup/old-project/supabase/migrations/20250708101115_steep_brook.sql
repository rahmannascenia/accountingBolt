/*
  # Fix Database Schema and Add Missing Tables

  1. New Tables
    - `fx_rates` - Foreign exchange rates management
    - `bad_debt_adjustments` - Bad debt write-offs
    - `audit_trail` - System audit logging

  2. Updates
    - Fix any missing columns or constraints
    - Add proper indexes for performance
    - Ensure all RLS policies are correctly applied

  3. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create fx_rates table (renamed from exchange_rates for consistency)
CREATE TABLE IF NOT EXISTS fx_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate DECIMAL(10,6) NOT NULL,
  source TEXT DEFAULT 'Manual',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  modified_by UUID REFERENCES auth.users(id),
  modified_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  UNIQUE(from_currency, to_currency, date)
);

-- Create bad_debt_adjustments table
CREATE TABLE IF NOT EXISTS bad_debt_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  adjustment_date DATE NOT NULL,
  original_amount DECIMAL(15,2) NOT NULL,
  adjustment_amount DECIMAL(15,2) NOT NULL,
  remaining_amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'posted')) DEFAULT 'pending',
  journal_entry_id UUID,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- Create audit_trail table
CREATE TABLE IF NOT EXISTS audit_trail (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation_type TEXT CHECK (operation_type IN ('CREATE', 'UPDATE', 'DELETE')) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  user_id UUID REFERENCES auth.users(id),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  description TEXT
);

-- Add missing columns to existing tables if they don't exist
DO $$
BEGIN
  -- Add fx_calculation_method to payments if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'fx_calculation_method'
  ) THEN
    ALTER TABLE payments ADD COLUMN fx_calculation_method TEXT CHECK (fx_calculation_method IN ('foreign_to_bdt', 'bdt_to_foreign')) DEFAULT 'foreign_to_bdt';
  END IF;

  -- Add fx_rate_source to payments if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'fx_rate_source'
  ) THEN
    ALTER TABLE payments ADD COLUMN fx_rate_source TEXT DEFAULT 'Manual';
  END IF;

  -- Add bdt_calculated_amount to payments if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' AND column_name = 'bdt_calculated_amount'
  ) THEN
    ALTER TABLE payments ADD COLUMN bdt_calculated_amount DECIMAL(15,2);
  END IF;

  -- Add level column to chart_of_accounts if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'chart_of_accounts' AND column_name = 'level'
  ) THEN
    ALTER TABLE chart_of_accounts ADD COLUMN level INTEGER DEFAULT 1;
  END IF;

  -- Add bdt_debit_amount and bdt_credit_amount to journal_entry_lines if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entry_lines' AND column_name = 'bdt_debit_amount'
  ) THEN
    ALTER TABLE journal_entry_lines ADD COLUMN bdt_debit_amount DECIMAL(15,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entry_lines' AND column_name = 'bdt_credit_amount'
  ) THEN
    ALTER TABLE journal_entry_lines ADD COLUMN bdt_credit_amount DECIMAL(15,2) DEFAULT 0;
  END IF;

  -- Add original_currency, original_amount, fx_rate to journal_entry_lines if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entry_lines' AND column_name = 'original_currency'
  ) THEN
    ALTER TABLE journal_entry_lines ADD COLUMN original_currency TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entry_lines' AND column_name = 'original_amount'
  ) THEN
    ALTER TABLE journal_entry_lines ADD COLUMN original_amount DECIMAL(15,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entry_lines' AND column_name = 'fx_rate'
  ) THEN
    ALTER TABLE journal_entry_lines ADD COLUMN fx_rate DECIMAL(10,6);
  END IF;

  -- Add source_document_type and source_document_id to journal_entries if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entries' AND column_name = 'source_document_type'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN source_document_type TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entries' AND column_name = 'source_document_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN source_document_id TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'journal_entries' AND column_name = 'is_auto_generated'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN is_auto_generated BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Enable Row Level Security on new tables
ALTER TABLE fx_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bad_debt_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- RLS Policies for fx_rates (public read, authenticated write)
CREATE POLICY "Anyone can read fx rates" ON fx_rates FOR SELECT USING (true);
CREATE POLICY "Authenticated users can manage fx rates" ON fx_rates 
  FOR ALL USING (auth.uid() IS NOT NULL);

-- RLS Policies for bad_debt_adjustments
CREATE POLICY "Users can manage their bad debt adjustments" ON bad_debt_adjustments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM customers 
      WHERE customers.id = bad_debt_adjustments.customer_id 
      AND customers.user_id = auth.uid()
    )
  );

-- RLS Policies for audit_trail (read only for users)
CREATE POLICY "Users can read their audit trail" ON audit_trail
  FOR SELECT USING (user_id = auth.uid());

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_fx_rates_currencies_date ON fx_rates(from_currency, to_currency, date);
CREATE INDEX IF NOT EXISTS idx_fx_rates_date ON fx_rates(date);
CREATE INDEX IF NOT EXISTS idx_fx_rates_active ON fx_rates(is_active);
CREATE INDEX IF NOT EXISTS idx_bad_debt_adjustments_invoice ON bad_debt_adjustments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_bad_debt_adjustments_customer ON bad_debt_adjustments(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_table_record ON audit_trail(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_timestamp ON audit_trail(user_id, timestamp);

-- Insert sample FX rates if fx_rates table is empty
INSERT INTO fx_rates (from_currency, to_currency, rate, date, source) 
SELECT 'USD', 'BDT', 110.0000, CURRENT_DATE, 'Bangladesh Bank'
WHERE NOT EXISTS (SELECT 1 FROM fx_rates WHERE from_currency = 'USD' AND to_currency = 'BDT' AND date = CURRENT_DATE);

INSERT INTO fx_rates (from_currency, to_currency, rate, date, source) 
SELECT 'EUR', 'BDT', 120.0000, CURRENT_DATE, 'Bangladesh Bank'
WHERE NOT EXISTS (SELECT 1 FROM fx_rates WHERE from_currency = 'EUR' AND to_currency = 'BDT' AND date = CURRENT_DATE);

INSERT INTO fx_rates (from_currency, to_currency, rate, date, source) 
SELECT 'GBP', 'BDT', 140.0000, CURRENT_DATE, 'Bangladesh Bank'
WHERE NOT EXISTS (SELECT 1 FROM fx_rates WHERE from_currency = 'GBP' AND to_currency = 'BDT' AND date = CURRENT_DATE);

-- Update existing journal_entry_lines to have BDT amounts equal to original amounts where null
UPDATE journal_entry_lines 
SET 
  bdt_debit_amount = debit_amount,
  bdt_credit_amount = credit_amount,
  original_currency = 'BDT',
  original_amount = CASE WHEN debit_amount > 0 THEN debit_amount ELSE credit_amount END,
  fx_rate = 1.0
WHERE bdt_debit_amount IS NULL OR bdt_credit_amount IS NULL;