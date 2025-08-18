import { z } from 'zod';

// Database bindings type
export interface Env {
  DB: D1Database;
  JWT_SECRET?: string;
  ENVIRONMENT?: string;
}

// User types
export const UserRoles = ['admin', 'manager', 'accountant', 'user'] as const;
export type UserRole = typeof UserRoles[number];

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: z.enum(UserRoles),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  last_login: z.string().nullable()
});

export type User = z.infer<typeof UserSchema>;

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  role: z.enum(UserRoles).default('user')
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

// Customer types
export const CustomerSchema = z.object({
  id: z.string(),
  customer_code: z.string(),
  company_name: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().default('USA'),
  tax_id: z.string().nullable(),
  credit_limit: z.number().default(0),
  payment_terms: z.number().default(30),
  is_active: z.boolean().default(true),
  created_at: z.string(),
  updated_at: z.string()
});

export type Customer = z.infer<typeof CustomerSchema>;

export const CreateCustomerSchema = z.object({
  customer_code: z.string().min(1),
  company_name: z.string().nullable(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postal_code: z.string().nullable(),
  country: z.string().default('USA'),
  tax_id: z.string().nullable(),
  credit_limit: z.number().default(0),
  payment_terms: z.number().default(30)
}).refine(data => data.company_name || (data.first_name && data.last_name), {
  message: "Either company_name or both first_name and last_name must be provided"
});

// Invoice types
export const InvoiceStatus = ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'void'] as const;
export type InvoiceStatusType = typeof InvoiceStatus[number];

export const InvoiceSchema = z.object({
  id: z.string(),
  invoice_number: z.string(),
  customer_id: z.string(),
  invoice_date: z.string(),
  due_date: z.string(),
  subtotal: z.number(),
  tax_amount: z.number(),
  total_amount: z.number(),
  paid_amount: z.number(),
  balance_due: z.number(),
  status: z.enum(InvoiceStatus),
  notes: z.string().nullable(),
  terms: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string()
});

export type Invoice = z.infer<typeof InvoiceSchema>;

export const CreateInvoiceSchema = z.object({
  customer_id: z.string(),
  invoice_date: z.string(),
  due_date: z.string(),
  notes: z.string().optional(),
  terms: z.string().optional(),
  line_items: z.array(z.object({
    item_description: z.string(),
    quantity: z.number().positive(),
    unit_price: z.number(),
    tax_rate: z.number().default(0),
    account_id: z.string().optional()
  }))
});

// Chart of Accounts types
export const AccountTypes = ['asset', 'liability', 'equity', 'revenue', 'expense'] as const;
export type AccountType = typeof AccountTypes[number];

export const ChartOfAccountsSchema = z.object({
  id: z.string(),
  account_code: z.string(),
  account_name: z.string(),
  account_type: z.enum(AccountTypes),
  parent_id: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

export type ChartOfAccounts = z.infer<typeof ChartOfAccountsSchema>;

// JWT payload type
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

// API Response types
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

// Audit log types
export const AuditActions = ['create', 'update', 'delete'] as const;
export type AuditAction = typeof AuditActions[number];

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: AuditAction;
  old_values: string | null;
  new_values: string | null;
  user_id: string;
  timestamp: string;
}