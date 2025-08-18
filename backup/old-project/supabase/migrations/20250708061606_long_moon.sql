/*
  # Financial Management System Database Schema

  1. New Tables
    - `currencies` - Currency definitions (USD, EUR, BDT, etc.)
    - `customers` - Customer management with local/foreign classification
    - `bank_accounts` - Bank account management with multi-currency support
    - `chart_of_accounts` - Chart of accounts for accounting
    - `services` - Service/product catalog
    - `invoices` - Invoice management with tax calculations
    - `invoice_items` - Invoice line items
    - `payments` - Payment tracking with fees and allocations
    - `payment_allocations` - Payment to invoice allocations
    - `cash_incentives` - Export incentive tracking
    - `journal_entries` - Accounting journal entries
    - `journal_entry_lines` - Journal entry line items
    - `expenses` - Expense management
    - `exchange_rates` - Currency exchange rates

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Currencies table
CREATE TABLE IF NOT EXISTS currencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_base_currency BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL,
  currency TEXT NOT NULL,
  customer_type TEXT CHECK (customer_type IN ('local', 'foreign')) NOT NULL,
  payment_terms INTEGER DEFAULT 30,
  tin_number TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bank accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  account_type TEXT CHECK (account_type IN ('operational', 'erq', 'savings', 'current')) NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chart of accounts table
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  account_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')) NOT NULL,
  parent_account_id UUID REFERENCES chart_of_accounts(id),
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, account_code)
);

-- Services table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_price DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL,
  category TEXT NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency TEXT NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  bdt_amount DECIMAL(15,2),
  exchange_rate DECIMAL(10,4),
  exchange_rate_date DATE,
  status TEXT CHECK (status IN ('draft', 'sent', 'cancelled')) DEFAULT 'draft',
  invoice_type TEXT CHECK (invoice_type IN ('custom', 'recurring')) DEFAULT 'custom',
  parent_invoice_id UUID REFERENCES invoices(id),
  recurring_end_date DATE,
  recurring_frequency TEXT,
  tds_rate DECIMAL(5,2),
  tds_amount DECIMAL(15,2),
  vds_rate DECIMAL(5,2),
  vds_amount DECIMAL(15,2),
  vat_rate DECIMAL(5,2),
  vat_amount DECIMAL(15,2),
  net_receivable DECIMAL(15,2),
  notes TEXT,
  journal_entry_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, invoice_number)
);

-- Invoice items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_number TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL,
  bdt_amount DECIMAL(15,2),
  exchange_rate DECIMAL(10,4),
  payment_date DATE NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('swift', 'bank_transfer', 'cash', 'check')) NOT NULL,
  status TEXT CHECK (status IN ('pending', 'cleared', 'failed')) DEFAULT 'pending',
  swift_fee DECIMAL(15,2),
  bank_charges DECIMAL(15,2),
  discount_given DECIMAL(15,2),
  net_amount DECIMAL(15,2),
  reference TEXT,
  notes TEXT,
  journal_entry_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, payment_number)
);

-- Payment allocations table
CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(15,2) NOT NULL,
  allocation_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cash incentives table
CREATE TABLE IF NOT EXISTS cash_incentives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES payments(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  eligible_amount DECIMAL(15,2) NOT NULL,
  incentive_rate DECIMAL(5,4) NOT NULL,
  expected_incentive DECIMAL(15,2) NOT NULL,
  actual_incentive DECIMAL(15,2),
  submission_deadline DATE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'documents_prepared', 'submitted', 'received', 'expired')) DEFAULT 'pending',
  documents_submitted BOOLEAN DEFAULT FALSE,
  submission_date DATE,
  received_date DATE,
  notes TEXT,
  journal_entry_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Journal entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_number TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  reference TEXT,
  total_debit DECIMAL(15,2) NOT NULL,
  total_credit DECIMAL(15,2) NOT NULL,
  status TEXT CHECK (status IN ('draft', 'posted')) DEFAULT 'draft',
  entry_type TEXT,
  source_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, entry_number)
);

-- Journal entry lines table
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_code TEXT,
  account_name TEXT NOT NULL,
  account_type TEXT CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')) NOT NULL,
  debit_amount DECIMAL(15,2) DEFAULT 0,
  credit_amount DECIMAL(15,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses table
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expense_number TEXT NOT NULL,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL,
  vendor TEXT,
  bank_account_id UUID REFERENCES bank_accounts(id),
  payment_method TEXT CHECK (payment_method IN ('bank_transfer', 'cash', 'check', 'online')) NOT NULL,
  vat_amount DECIMAL(15,2),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency TEXT,
  status TEXT CHECK (status IN ('pending', 'paid', 'cancelled')) DEFAULT 'pending',
  notes TEXT,
  journal_entry_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, expense_number)
);

-- Exchange rates table
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate DECIMAL(10,4) NOT NULL,
  date DATE NOT NULL,
  reference TEXT,
  is_historical BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_currency, to_currency, date)
);

-- Enable Row Level Security
ALTER TABLE currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_incentives ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for currencies (public read, admin write)
CREATE POLICY "Anyone can read currencies" ON currencies FOR SELECT USING (true);

-- RLS Policies for customers
CREATE POLICY "Users can manage their own customers" ON customers
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for bank_accounts
CREATE POLICY "Users can manage their own bank accounts" ON bank_accounts
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for chart_of_accounts
CREATE POLICY "Users can manage their own chart of accounts" ON chart_of_accounts
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for services
CREATE POLICY "Users can manage their own services" ON services
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for invoices
CREATE POLICY "Users can manage their own invoices" ON invoices
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for invoice_items
CREATE POLICY "Users can manage invoice items for their invoices" ON invoice_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices 
      WHERE invoices.id = invoice_items.invoice_id 
      AND invoices.user_id = auth.uid()
    )
  );

-- RLS Policies for payments
CREATE POLICY "Users can manage their own payments" ON payments
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for payment_allocations
CREATE POLICY "Users can manage payment allocations for their payments" ON payment_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM payments 
      WHERE payments.id = payment_allocations.payment_id 
      AND payments.user_id = auth.uid()
    )
  );

-- RLS Policies for cash_incentives
CREATE POLICY "Users can manage their own cash incentives" ON cash_incentives
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for journal_entries
CREATE POLICY "Users can manage their own journal entries" ON journal_entries
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for journal_entry_lines
CREATE POLICY "Users can manage journal entry lines for their entries" ON journal_entry_lines
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM journal_entries 
      WHERE journal_entries.id = journal_entry_lines.journal_entry_id 
      AND journal_entries.user_id = auth.uid()
    )
  );

-- RLS Policies for expenses
CREATE POLICY "Users can manage their own expenses" ON expenses
  FOR ALL USING (auth.uid() = user_id);

-- RLS Policies for exchange_rates (public read, admin write)
CREATE POLICY "Anyone can read exchange rates" ON exchange_rates FOR SELECT USING (true);

-- Insert default currencies
INSERT INTO currencies (code, name, symbol, is_base_currency) VALUES
  ('USD', 'US Dollar', '$', false),
  ('BDT', 'Bangladeshi Taka', '৳', true),
  ('EUR', 'Euro', '€', false),
  ('GBP', 'British Pound', '£', false)
ON CONFLICT (code) DO NOTHING;

-- Insert sample exchange rates
INSERT INTO exchange_rates (from_currency, to_currency, rate, date, reference) VALUES
  ('USD', 'BDT', 110.0000, CURRENT_DATE, 'Bangladesh Bank'),
  ('EUR', 'BDT', 120.0000, CURRENT_DATE, 'Bangladesh Bank'),
  ('GBP', 'BDT', 140.0000, CURRENT_DATE, 'Bangladesh Bank')
ON CONFLICT (from_currency, to_currency, date) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(customer_type);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_user_id ON bank_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_currency ON bank_accounts(currency);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies_date ON exchange_rates(from_currency, to_currency, date);