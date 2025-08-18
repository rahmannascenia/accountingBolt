import axios, { AxiosResponse } from 'axios';
import type { 
  ApiResponse, 
  PaginatedResponse, 
  LoginRequest, 
  LoginResponse,
  User,
  Customer,
  Invoice,
  CreateUserRequest,
  CreateCustomerRequest,
  CreateInvoiceRequest,
  DashboardStats,
  AdminDashboardStats,
  AuditLogEntry,
  ChartOfAccounts
} from '../types';

const API_BASE_URL = '/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response: AxiosResponse<ApiResponse<LoginResponse>> = await api.post('/auth/login', credentials);
    return response.data.data!;
  },

  me: async (): Promise<User> => {
    const response: AxiosResponse<ApiResponse<User>> = await api.get('/auth/me');
    return response.data.data!;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  }
};

// Admin API
export const adminAPI = {
  getDashboard: async (): Promise<{ stats: AdminDashboardStats; recentActivities: AuditLogEntry[] }> => {
    const response: AxiosResponse<ApiResponse<{ stats: AdminDashboardStats; recentActivities: AuditLogEntry[] }>> = 
      await api.get('/admin/dashboard');
    return response.data.data!;
  },

  getUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }): Promise<PaginatedResponse<User>> => {
    const response: AxiosResponse<PaginatedResponse<User>> = await api.get('/admin/users', { params });
    return response.data;
  },

  getUser: async (id: string): Promise<User> => {
    const response: AxiosResponse<ApiResponse<User>> = await api.get(`/admin/users/${id}`);
    return response.data.data!;
  },

  createUser: async (userData: CreateUserRequest): Promise<User> => {
    const response: AxiosResponse<ApiResponse<User>> = await api.post('/admin/users', userData);
    return response.data.data!;
  },

  updateUser: async (id: string, userData: Partial<CreateUserRequest> & { is_active?: boolean }): Promise<User> => {
    const response: AxiosResponse<ApiResponse<User>> = await api.put(`/admin/users/${id}`, userData);
    return response.data.data!;
  },

  deleteUser: async (id: string): Promise<void> => {
    await api.delete(`/admin/users/${id}`);
  },

  getAuditLog: async (params?: {
    page?: number;
    limit?: number;
    table?: string;
    action?: string;
  }): Promise<PaginatedResponse<AuditLogEntry>> => {
    const response: AxiosResponse<PaginatedResponse<AuditLogEntry>> = await api.get('/admin/audit-log', { params });
    return response.data;
  }
};

// Customers API
export const customersAPI = {
  getCustomers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    active?: boolean;
  }): Promise<PaginatedResponse<Customer>> => {
    const response: AxiosResponse<PaginatedResponse<Customer>> = await api.get('/customers', { params });
    return response.data;
  },

  getCustomer: async (id: string): Promise<Customer> => {
    const response: AxiosResponse<ApiResponse<Customer>> = await api.get(`/customers/${id}`);
    return response.data.data!;
  },

  createCustomer: async (customerData: CreateCustomerRequest): Promise<Customer> => {
    const response: AxiosResponse<ApiResponse<Customer>> = await api.post('/customers', customerData);
    return response.data.data!;
  },

  updateCustomer: async (id: string, customerData: Partial<CreateCustomerRequest> & { is_active?: boolean }): Promise<Customer> => {
    const response: AxiosResponse<ApiResponse<Customer>> = await api.put(`/customers/${id}`, customerData);
    return response.data.data!;
  },

  deleteCustomer: async (id: string): Promise<void> => {
    await api.delete(`/customers/${id}`);
  },

  getCustomerInvoices: async (id: string, params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<PaginatedResponse<Invoice>> => {
    const response: AxiosResponse<PaginatedResponse<Invoice>> = await api.get(`/customers/${id}/invoices`, { params });
    return response.data;
  }
};

// Invoices API
export const invoicesAPI = {
  getInvoices: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    customer_id?: string;
  }): Promise<PaginatedResponse<Invoice>> => {
    const response: AxiosResponse<PaginatedResponse<Invoice>> = await api.get('/invoices', { params });
    return response.data;
  },

  getInvoice: async (id: string): Promise<Invoice & { line_items: any[] }> => {
    const response: AxiosResponse<ApiResponse<Invoice & { line_items: any[] }>> = await api.get(`/invoices/${id}`);
    return response.data.data!;
  },

  createInvoice: async (invoiceData: CreateInvoiceRequest): Promise<{ invoice_number: string }> => {
    const response: AxiosResponse<ApiResponse<{ invoice_number: string }>> = await api.post('/invoices', invoiceData);
    return response.data.data!;
  },

  updateInvoiceStatus: async (id: string, status: string): Promise<Invoice> => {
    const response: AxiosResponse<ApiResponse<Invoice>> = await api.patch(`/invoices/${id}/status`, { status });
    return response.data.data!;
  },

  deleteInvoice: async (id: string): Promise<void> => {
    await api.delete(`/invoices/${id}`);
  },

  getOverdueInvoices: async (): Promise<Invoice[]> => {
    const response: AxiosResponse<ApiResponse<Invoice[]>> = await api.get('/invoices/reports/overdue');
    return response.data.data!;
  }
};

// Dashboard API
export const dashboardAPI = {
  getStats: async (): Promise<DashboardStats> => {
    const response: AxiosResponse<ApiResponse<DashboardStats>> = await api.get('/dashboard/stats');
    return response.data.data!;
  }
};

// Chart of Accounts API
export const accountsAPI = {
  getAccounts: async (): Promise<ChartOfAccounts[]> => {
    const response: AxiosResponse<ApiResponse<ChartOfAccounts[]>> = await api.get('/accounts');
    return response.data.data!;
  }
};

// Utility function to handle API errors
export const handleApiError = (error: any): string => {
  if (error.response?.data?.error) {
    return error.response.data.error;
  } else if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
};

export default api;