// Frontend types that mirror the backend types
export type UserRole = 'admin' | 'manager' | 'accountant' | 'user';

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export interface Customer {
  id: string;
  customer_code: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string;
  tax_id: string | null;
  credit_limit: number;
  payment_terms: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  invoice_count?: number;
  outstanding_balance?: number;
}

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partial' | 'paid' | 'overdue' | 'void';

export interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: InvoiceStatus;
  notes: string | null;
  terms: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  // Additional fields from joins
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  created_by_first_name?: string;
  created_by_last_name?: string;
}

export interface InvoiceLineItem {
  id: string;
  invoice_id: string;
  item_description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_rate: number;
  account_id: string | null;
  account_name?: string;
  created_at: string;
}

export interface CreateInvoiceRequest {
  customer_id: string;
  invoice_date: string;
  due_date: string;
  notes?: string;
  terms?: string;
  line_items: {
    item_description: string;
    quantity: number;
    unit_price: number;
    tax_rate?: number;
    account_id?: string;
  }[];
}

export interface ChartOfAccounts {
  id: string;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  totalCustomers: number;
  totalInvoices: number;
  totalRevenue: number;
  overdueInvoices: number;
  draftInvoices: number;
}

export interface AdminDashboardStats extends DashboardStats {
  totalUsers: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'create' | 'update' | 'delete';
  old_values: string | null;
  new_values: string | null;
  user_id: string;
  timestamp: string;
  // From joins
  first_name?: string;
  last_name?: string;
  email?: string;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: UserRole;
}

export interface CreateCustomerRequest {
  customer_code: string;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string;
  tax_id?: string | null;
  credit_limit?: number;
  payment_terms?: number;
}