-- Insert default admin user (password: admin123)
INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active) 
VALUES (
    'user_' || lower(hex(randomblob(16))),
    'admin@accounting.com',
    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- bcrypt hash of 'admin123'
    'System',
    'Administrator',
    'admin',
    TRUE
);

-- Default Chart of Accounts
INSERT INTO chart_of_accounts (id, account_code, account_name, account_type, parent_id, is_active) VALUES 
-- Assets
('acc_' || lower(hex(randomblob(16))), '1000', 'Assets', 'asset', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '1100', 'Current Assets', 'asset', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '1110', 'Cash and Cash Equivalents', 'asset', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '1120', 'Accounts Receivable', 'asset', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '1130', 'Inventory', 'asset', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '1140', 'Prepaid Expenses', 'asset', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '1200', 'Fixed Assets', 'asset', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '1210', 'Equipment', 'asset', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '1220', 'Accumulated Depreciation - Equipment', 'asset', NULL, TRUE),

-- Liabilities
('acc_' || lower(hex(randomblob(16))), '2000', 'Liabilities', 'liability', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '2100', 'Current Liabilities', 'liability', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '2110', 'Accounts Payable', 'liability', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '2120', 'Sales Tax Payable', 'liability', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '2130', 'Payroll Liabilities', 'liability', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '2200', 'Long-term Liabilities', 'liability', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '2210', 'Notes Payable', 'liability', NULL, TRUE),

-- Equity
('acc_' || lower(hex(randomblob(16))), '3000', 'Equity', 'equity', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '3100', 'Owner''s Equity', 'equity', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '3110', 'Retained Earnings', 'equity', NULL, TRUE),

-- Revenue
('acc_' || lower(hex(randomblob(16))), '4000', 'Revenue', 'revenue', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '4100', 'Sales Revenue', 'revenue', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '4110', 'Service Revenue', 'revenue', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '4120', 'Other Income', 'revenue', NULL, TRUE),

-- Expenses
('acc_' || lower(hex(randomblob(16))), '5000', 'Expenses', 'expense', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '5100', 'Cost of Goods Sold', 'expense', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '5200', 'Operating Expenses', 'expense', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '5210', 'Rent Expense', 'expense', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '5220', 'Utilities Expense', 'expense', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '5230', 'Office Supplies', 'expense', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '5240', 'Insurance Expense', 'expense', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '5250', 'Professional Services', 'expense', NULL, TRUE),
('acc_' || lower(hex(randomblob(16))), '5260', 'Marketing Expense', 'expense', NULL, TRUE);

-- Default Bank Account
INSERT INTO bank_accounts (id, account_name, bank_name, account_number, account_type, current_balance, is_active)
VALUES (
    'bank_' || lower(hex(randomblob(16))),
    'Business Checking',
    'First National Bank',
    '****1234',
    'checking',
    0.00,
    TRUE
);

-- Sample Customer
INSERT INTO customers (id, customer_code, company_name, email, phone, address, city, state, postal_code, is_active)
VALUES (
    'cust_' || lower(hex(randomblob(16))),
    'CUST001',
    'Acme Corporation',
    'billing@acme.com',
    '555-0123',
    '123 Business St',
    'Business City',
    'CA',
    '90210',
    TRUE
);

-- Sample Vendor
INSERT INTO vendors (id, vendor_code, company_name, contact_name, email, phone, address, city, state, postal_code, is_active)
VALUES (
    'vend_' || lower(hex(randomblob(16))),
    'VEND001',
    'Office Supplies Inc',
    'John Smith',
    'orders@officesupplies.com',
    '555-0456',
    '456 Vendor Ave',
    'Supply City',
    'CA',
    '90211',
    TRUE
);