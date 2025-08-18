/*
  # Remove RLS and Add Dummy Data

  1. Changes
    - Disable RLS on all tables
    - Drop all RLS policies
    - Insert comprehensive dummy data for testing

  2. Dummy Data
    - Sample currencies and exchange rates
    - Test customers (both local and foreign)
    - Sample services
    - Bank accounts
    - Chart of accounts
    - Sample invoices with items
    - Sample payments with allocations
    - Sample expenses
    - Sample journal entries
*/

-- Disable Row Level Security on all tables
ALTER TABLE currencies DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE cash_incentives DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates DISABLE ROW LEVEL SECURITY;

-- Drop all RLS policies
DROP POLICY IF EXISTS "Anyone can read currencies" ON currencies;
DROP POLICY IF EXISTS "Users can manage their own customers" ON customers;
DROP POLICY IF EXISTS "Users can manage their own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can manage their own chart of accounts" ON chart_of_accounts;
DROP POLICY IF EXISTS "Users can manage their own services" ON services;
DROP POLICY IF EXISTS "Users can manage their own invoices" ON invoices;
DROP POLICY IF EXISTS "Users can manage invoice items for their invoices" ON invoice_items;
DROP POLICY IF EXISTS "Users can manage their own payments" ON payments;
DROP POLICY IF EXISTS "Users can manage payment allocations for their payments" ON payment_allocations;
DROP POLICY IF EXISTS "Users can manage their own cash incentives" ON cash_incentives;
DROP POLICY IF EXISTS "Users can manage their own journal entries" ON journal_entries;
DROP POLICY IF EXISTS "Users can manage journal entry lines for their entries" ON journal_entry_lines;
DROP POLICY IF EXISTS "Users can manage their own expenses" ON expenses;
DROP POLICY IF EXISTS "Anyone can read exchange rates" ON exchange_rates;

-- Create a dummy user ID for testing (using a fixed UUID)
DO $$
DECLARE
    dummy_user_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- Insert dummy user into auth.users if it doesn't exist
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
    VALUES (
        dummy_user_id,
        'demo@example.com',
        '$2a$10$dummy.hash.for.testing.purposes.only',
        NOW(),
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;
END $$;

-- Insert additional currencies
INSERT INTO currencies (code, name, symbol, is_base_currency) VALUES
  ('CAD', 'Canadian Dollar', 'C$', false),
  ('AUD', 'Australian Dollar', 'A$', false),
  ('JPY', 'Japanese Yen', '¥', false),
  ('CHF', 'Swiss Franc', 'CHF', false)
ON CONFLICT (code) DO NOTHING;

-- Insert more exchange rates
INSERT INTO exchange_rates (from_currency, to_currency, rate, date, reference) VALUES
  ('USD', 'BDT', 109.5000, CURRENT_DATE - INTERVAL '1 day', 'Bangladesh Bank'),
  ('EUR', 'BDT', 119.2000, CURRENT_DATE - INTERVAL '1 day', 'Bangladesh Bank'),
  ('GBP', 'BDT', 138.7500, CURRENT_DATE - INTERVAL '1 day', 'Bangladesh Bank'),
  ('CAD', 'BDT', 82.3000, CURRENT_DATE, 'Bangladesh Bank'),
  ('AUD', 'BDT', 75.8000, CURRENT_DATE, 'Bangladesh Bank')
ON CONFLICT (from_currency, to_currency, date) DO NOTHING;

-- Insert dummy customers
INSERT INTO customers (id, user_id, name, email, country, currency, customer_type, payment_terms, tin_number) VALUES
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'TechCorp Bangladesh Ltd.', 'contact@techcorp.bd', 'Bangladesh', 'BDT', 'local', 30, 'TIN-123456789'),
  ('11111111-1111-1111-1111-111111111112', '00000000-0000-0000-0000-000000000001', 'Global Solutions Inc.', 'billing@globalsolutions.com', 'United States', 'USD', 'foreign', 45, NULL),
  ('11111111-1111-1111-1111-111111111113', '00000000-0000-0000-0000-000000000001', 'European Tech GmbH', 'finance@eurotech.de', 'Germany', 'EUR', 'foreign', 30, NULL),
  ('11111111-1111-1111-1111-111111111114', '00000000-0000-0000-0000-000000000001', 'UK Digital Ltd.', 'accounts@ukdigital.co.uk', 'United Kingdom', 'GBP', 'foreign', 30, NULL),
  ('11111111-1111-1111-1111-111111111115', '00000000-0000-0000-0000-000000000001', 'Local Enterprise Ltd.', 'admin@localent.bd', 'Bangladesh', 'BDT', 'local', 15, 'TIN-987654321')
ON CONFLICT (id) DO NOTHING;

-- Insert dummy bank accounts
INSERT INTO bank_accounts (id, user_id, name, account_number, bank_name, currency, account_type, balance) VALUES
  ('22222222-2222-2222-2222-222222222221', '00000000-0000-0000-0000-000000000001', 'Main BDT Account', '1234567890', 'Standard Chartered Bank', 'BDT', 'operational', 2500000.00),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000001', 'USD Export Account', 'USD9876543210', 'Standard Chartered Bank', 'USD', 'erq', 45000.00),
  ('22222222-2222-2222-2222-222222222223', '00000000-0000-0000-0000-000000000001', 'EUR Business Account', 'EUR5555666677', 'HSBC Bank', 'EUR', 'operational', 12000.00),
  ('22222222-2222-2222-2222-222222222224', '00000000-0000-0000-0000-000000000001', 'Savings Account', 'SAV1111222233', 'Dutch Bangla Bank', 'BDT', 'savings', 500000.00)
ON CONFLICT (id) DO NOTHING;

-- Insert chart of accounts
INSERT INTO chart_of_accounts (id, user_id, account_code, account_name, account_type, description) VALUES
  ('33333333-3333-3333-3333-333333333331', '00000000-0000-0000-0000-000000000001', '1000', 'Cash', 'asset', 'Cash on hand'),
  ('33333333-3333-3333-3333-333333333332', '00000000-0000-0000-0000-000000000001', '1100', 'Bank - Local Currency', 'asset', 'BDT bank accounts'),
  ('33333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000001', '1200', 'Bank - Foreign Currency', 'asset', 'Foreign currency bank accounts'),
  ('33333333-3333-3333-3333-333333333334', '00000000-0000-0000-0000-000000000001', '1300', 'Accounts Receivable - Local', 'asset', 'Local customer receivables'),
  ('33333333-3333-3333-3333-333333333335', '00000000-0000-0000-0000-000000000001', '1400', 'Accounts Receivable - Foreign', 'asset', 'Foreign customer receivables'),
  ('33333333-3333-3333-3333-333333333336', '00000000-0000-0000-0000-000000000001', '2000', 'Accounts Payable', 'liability', 'Amounts owed to suppliers'),
  ('33333333-3333-3333-3333-333333333337', '00000000-0000-0000-0000-000000000001', '2100', 'VAT Collected', 'liability', 'VAT collected from customers'),
  ('33333333-3333-3333-3333-333333333338', '00000000-0000-0000-0000-000000000001', '3000', 'Owner Equity', 'equity', 'Owner equity account'),
  ('33333333-3333-3333-3333-333333333339', '00000000-0000-0000-0000-000000000001', '4000', 'Software Services Revenue - Local', 'revenue', 'Revenue from local customers'),
  ('33333333-3333-3333-3333-33333333333a', '00000000-0000-0000-0000-000000000001', '4100', 'Software Services Revenue - Export', 'revenue', 'Revenue from export customers'),
  ('33333333-3333-3333-3333-33333333333b', '00000000-0000-0000-0000-000000000001', '5000', 'Office Rent', 'expense', 'Monthly office rent'),
  ('33333333-3333-3333-3333-33333333333c', '00000000-0000-0000-0000-000000000001', '5100', 'Software Licenses', 'expense', 'Software and tool licenses'),
  ('33333333-3333-3333-3333-33333333333d', '00000000-0000-0000-0000-000000000001', '5400', 'Bank Charges - SWIFT', 'expense', 'SWIFT transfer fees'),
  ('33333333-3333-3333-3333-33333333333e', '00000000-0000-0000-0000-000000000001', '5500', 'Bank Charges - Other', 'expense', 'Other banking fees')
ON CONFLICT (id) DO NOTHING;

-- Insert dummy services
INSERT INTO services (id, user_id, name, description, default_price, currency, category) VALUES
  ('44444444-4444-4444-4444-444444444441', '00000000-0000-0000-0000-000000000001', 'Web Application Development', 'Custom web application development using modern technologies', 5000.00, 'USD', 'Development'),
  ('44444444-4444-4444-4444-444444444442', '00000000-0000-0000-0000-000000000001', 'Mobile App Development', 'iOS and Android mobile application development', 8000.00, 'USD', 'Development'),
  ('44444444-4444-4444-4444-444444444443', '00000000-0000-0000-0000-000000000001', 'Software Maintenance', 'Monthly software maintenance and support services', 1200.00, 'USD', 'Support'),
  ('44444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000001', 'Database Design', 'Database architecture and optimization services', 3000.00, 'USD', 'Consulting'),
  ('44444444-4444-4444-4444-444444444445', '00000000-0000-0000-0000-000000000001', 'Local Software Development', 'Software development for local market', 150000.00, 'BDT', 'Development')
ON CONFLICT (id) DO NOTHING;

-- Insert dummy invoices
INSERT INTO invoices (id, user_id, invoice_number, customer_id, date, due_date, currency, subtotal, tax_amount, total_amount, bdt_amount, exchange_rate, status, tds_rate, tds_amount, vds_rate, vds_amount, vat_rate, vat_amount, net_receivable) VALUES
  ('55555555-5555-5555-5555-555555555551', '00000000-0000-0000-0000-000000000001', 'INV-2024-001', '11111111-1111-1111-1111-111111111111', '2024-01-15', '2024-02-14', 'BDT', 150000.00, 22500.00, 172500.00, NULL, NULL, 'sent', 10.00, 15000.00, 5.00, 7500.00, 15.00, 22500.00, 150000.00),
  ('55555555-5555-5555-5555-555555555552', '00000000-0000-0000-0000-000000000001', 'INV-2024-002', '11111111-1111-1111-1111-111111111112', '2024-01-20', '2024-03-05', 'USD', 5000.00, 0.00, 5000.00, 547500.00, 109.50, 'sent', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('55555555-5555-5555-5555-555555555553', '00000000-0000-0000-0000-000000000001', 'INV-2024-003', '11111111-1111-1111-1111-111111111113', '2024-02-01', '2024-03-02', 'EUR', 3000.00, 0.00, 3000.00, 357600.00, 119.20, 'sent', NULL, NULL, NULL, NULL, NULL, NULL, NULL),
  ('55555555-5555-5555-5555-555555555554', '00000000-0000-0000-0000-000000000001', 'INV-2024-004', '11111111-1111-1111-1111-111111111114', '2024-02-10', '2024-03-11', 'GBP', 2000.00, 0.00, 2000.00, 277500.00, 138.75, 'draft', NULL, NULL, NULL, NULL, NULL, NULL, NULL)
ON CONFLICT (id) DO NOTHING;

-- Insert dummy invoice items
INSERT INTO invoice_items (invoice_id, service_id, description, quantity, unit_price, total_price) VALUES
  ('55555555-5555-5555-5555-555555555551', '44444444-4444-4444-4444-444444444445', 'Local Software Development', 1.00, 150000.00, 150000.00),
  ('55555555-5555-5555-5555-555555555552', '44444444-4444-4444-4444-444444444441', 'Web Application Development', 1.00, 5000.00, 5000.00),
  ('55555555-5555-5555-5555-555555555553', '44444444-4444-4444-4444-444444444444', 'Database Design', 1.00, 3000.00, 3000.00),
  ('55555555-5555-5555-5555-555555555554', '44444444-4444-4444-4444-444444444443', 'Software Maintenance', 1.00, 1200.00, 1200.00),
  ('55555555-5555-5555-5555-555555555554', '44444444-4444-4444-4444-444444444444', 'Database Consultation', 0.50, 1600.00, 800.00)
ON CONFLICT DO NOTHING;

-- Insert dummy payments
INSERT INTO payments (id, user_id, payment_number, customer_id, bank_account_id, amount, currency, bdt_amount, exchange_rate, payment_date, payment_method, status, swift_fee, bank_charges, net_amount) VALUES
  ('66666666-6666-6666-6666-666666666661', '00000000-0000-0000-0000-000000000001', 'PAY-2024-001', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222221', 150000.00, 'BDT', NULL, NULL, '2024-01-25', 'bank_transfer', 'cleared', NULL, 50.00, 149950.00),
  ('66666666-6666-6666-6666-666666666662', '00000000-0000-0000-0000-000000000001', 'PAY-2024-002', '11111111-1111-1111-1111-111111111112', '22222222-2222-2222-2222-222222222222', 4950.00, 'USD', 541725.00, 109.50, '2024-02-05', 'swift', 'cleared', 30.00, 20.00, 4900.00),
  ('66666666-6666-6666-6666-666666666663', '00000000-0000-0000-0000-000000000001', 'PAY-2024-003', '11111111-1111-1111-1111-111111111113', '22222222-2222-2222-2222-222222222223', 2980.00, 'EUR', 355216.00, 119.20, '2024-02-15', 'swift', 'pending', 25.00, 15.00, 2940.00)
ON CONFLICT (id) DO NOTHING;

-- Insert dummy payment allocations
INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount, allocation_date) VALUES
  ('66666666-6666-6666-6666-666666666661', '55555555-5555-5555-5555-555555555551', 150000.00, '2024-01-25'),
  ('66666666-6666-6666-6666-666666666662', '55555555-5555-5555-5555-555555555552', 5000.00, '2024-02-05'),
  ('66666666-6666-6666-6666-666666666663', '55555555-5555-5555-5555-555555555553', 3020.00, '2024-02-15')
ON CONFLICT DO NOTHING;

-- Insert dummy cash incentives (for foreign payments)
INSERT INTO cash_incentives (id, user_id, payment_id, customer_id, eligible_amount, incentive_rate, expected_incentive, submission_deadline, status) VALUES
  ('77777777-7777-7777-7777-777777777771', '00000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666662', '11111111-1111-1111-1111-111111111112', 4950.00, 0.0250, 123.75, '2024-08-03', 'pending'),
  ('77777777-7777-7777-7777-777777777772', '00000000-0000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666663', '11111111-1111-1111-1111-111111111113', 2980.00, 0.0250, 74.50, '2024-08-13', 'documents_prepared')
ON CONFLICT (id) DO NOTHING;

-- Insert dummy expenses
INSERT INTO expenses (id, user_id, expense_number, date, description, category, amount, currency, vendor, bank_account_id, payment_method, status) VALUES
  ('88888888-8888-8888-8888-888888888881', '00000000-0000-0000-0000-000000000001', 'EXP-2024-001', '2024-01-05', 'Monthly office rent for January', 'Office Rent', 45000.00, 'BDT', 'Property Management Co.', '22222222-2222-2222-2222-222222222221', 'bank_transfer', 'paid'),
  ('88888888-8888-8888-8888-888888888882', '00000000-0000-0000-0000-000000000001', 'EXP-2024-002', '2024-01-10', 'Adobe Creative Suite License', 'Software Licenses', 52.99, 'USD', 'Adobe Inc.', '22222222-2222-2222-2222-222222222222', 'online', 'paid'),
  ('88888888-8888-8888-8888-888888888883', '00000000-0000-0000-0000-000000000001', 'EXP-2024-003', '2024-01-15', 'Internet and phone bills', 'Utilities', 8500.00, 'BDT', 'Telecom Provider', '22222222-2222-2222-2222-222222222221', 'bank_transfer', 'paid'),
  ('88888888-8888-8888-8888-888888888884', '00000000-0000-0000-0000-000000000001', 'EXP-2024-004', '2024-02-01', 'Team lunch and meeting expenses', 'Marketing', 3200.00, 'BDT', NULL, NULL, 'cash', 'pending')
ON CONFLICT (id) DO NOTHING;

-- Insert dummy journal entries
INSERT INTO journal_entries (id, user_id, entry_number, date, description, reference, total_debit, total_credit, status, entry_type) VALUES
  ('99999999-9999-9999-9999-999999999991', '00000000-0000-0000-0000-000000000001', 'JE-2024-001', '2024-01-15', 'Invoice INV-2024-001 - TechCorp Bangladesh Ltd.', 'INV-2024-001', 172500.00, 172500.00, 'posted', 'invoice'),
  ('99999999-9999-9999-9999-999999999992', '00000000-0000-0000-0000-000000000001', 'JE-2024-002', '2024-01-25', 'Payment PAY-2024-001 from TechCorp Bangladesh Ltd.', 'PAY-2024-001', 172500.00, 172500.00, 'posted', 'payment'),
  ('99999999-9999-9999-9999-999999999993', '00000000-0000-0000-0000-000000000001', 'JE-2024-003', '2024-01-05', 'Office rent payment for January', 'EXP-2024-001', 45000.00, 45000.00, 'posted', 'expense')
ON CONFLICT (id) DO NOTHING;

-- Insert dummy journal entry lines
INSERT INTO journal_entry_lines (journal_entry_id, account_code, account_name, account_type, debit_amount, credit_amount, description) VALUES
  -- Invoice entry
  ('99999999-9999-9999-9999-999999999991', '1300', 'Accounts Receivable - Local', 'asset', 172500.00, 0.00, 'Invoice INV-2024-001'),
  ('99999999-9999-9999-9999-999999999991', '4000', 'Software Services Revenue - Local', 'revenue', 0.00, 150000.00, 'Revenue for INV-2024-001'),
  ('99999999-9999-9999-9999-999999999991', '2100', 'VAT Collected', 'liability', 0.00, 22500.00, 'VAT on INV-2024-001'),
  
  -- Payment entry
  ('99999999-9999-9999-9999-999999999992', '1100', 'Bank - Local Currency', 'asset', 149950.00, 0.00, 'Payment received'),
  ('99999999-9999-9999-9999-999999999992', '5500', 'Bank Charges - Other', 'expense', 50.00, 0.00, 'Bank charges'),
  ('99999999-9999-9999-9999-999999999992', '1500', 'TDS Receivable', 'asset', 15000.00, 0.00, 'TDS deducted'),
  ('99999999-9999-9999-9999-999999999992', '1600', 'VDS Receivable', 'asset', 7500.00, 0.00, 'VDS deducted'),
  ('99999999-9999-9999-9999-999999999992', '1300', 'Accounts Receivable - Local', 'asset', 0.00, 172500.00, 'Payment allocation'),
  
  -- Expense entry
  ('99999999-9999-9999-9999-999999999993', '5000', 'Office Rent', 'expense', 45000.00, 0.00, 'January office rent'),
  ('99999999-9999-9999-9999-999999999993', '1100', 'Bank - Local Currency', 'asset', 0.00, 45000.00, 'Rent payment')
ON CONFLICT DO NOTHING;