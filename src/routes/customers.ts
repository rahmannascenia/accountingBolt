import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Customer, ApiResponse, PaginatedResponse } from '../types';
import { CreateCustomerSchema } from '../types';
import { DatabaseUtils } from '../utils/database';
import { authMiddleware, requireRole } from '../middleware/auth';

const customers = new Hono<{ Bindings: Env }>();

// All customer routes require authentication
customers.use('*', authMiddleware);

// Get all customers
customers.get('/', requireRole('accountant'), async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const search = c.req.query('search') || '';
    const active = c.req.query('active');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (company_name LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR customer_code LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (active === 'true' || active === 'false') {
      whereClause += ' AND is_active = ?';
      params.push(active === 'true' ? 1 : 0);
    }

    const baseQuery = `
      SELECT *, 
        (SELECT COUNT(*) FROM invoices WHERE customer_id = customers.id) as invoice_count,
        (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE customer_id = customers.id AND status NOT IN ('paid', 'void')) as outstanding_balance
      FROM customers 
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const countQuery = `SELECT COUNT(*) as count FROM customers ${whereClause}`;

    const result = await DatabaseUtils.paginate<Customer & {
      invoice_count: number;
      outstanding_balance: number;
    }>(
      c.env.DB,
      baseQuery,
      countQuery,
      params,
      page,
      limit
    );

    return c.json<PaginatedResponse<Customer>>({
      success: true,
      data: result.results as any,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Get customers error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch customers'
    }, 500);
  }
});

// Get customer by ID
customers.get('/:id', requireRole('accountant'), async (c) => {
  try {
    const id = c.req.param('id');

    const customer = await DatabaseUtils.executeQueryFirst<Customer & {
      invoice_count: number;
      outstanding_balance: number;
      total_paid: number;
    }>(
      c.env.DB,
      `SELECT c.*, 
        (SELECT COUNT(*) FROM invoices WHERE customer_id = c.id) as invoice_count,
        (SELECT COALESCE(SUM(balance_due), 0) FROM invoices WHERE customer_id = c.id AND status NOT IN ('paid', 'void')) as outstanding_balance,
        (SELECT COALESCE(SUM(paid_amount), 0) FROM invoices WHERE customer_id = c.id) as total_paid
      FROM customers c
      WHERE c.id = ?`,
      [id]
    );

    if (!customer) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Customer not found'
      }, 404);
    }

    return c.json<ApiResponse>({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Get customer error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch customer'
    }, 500);
  }
});

// Create customer
customers.post('/', requireRole('accountant'), async (c) => {
  try {
    const body = await c.req.json();
    const customerData = CreateCustomerSchema.parse(body);
    const currentUser = c.get('user');

    // Check if customer code already exists
    const existingCustomer = await DatabaseUtils.executeQueryFirst(
      c.env.DB,
      'SELECT id FROM customers WHERE customer_code = ?',
      [customerData.customer_code]
    );

    if (existingCustomer) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Customer with this code already exists'
      }, 400);
    }

    // Create new customer
    const newCustomer = {
      id: DatabaseUtils.generateId('cust'),
      ...customerData,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createdCustomer = await DatabaseUtils.insertRecord<Customer>(
      c.env.DB,
      'customers',
      newCustomer
    );

    // Log audit
    await DatabaseUtils.logAudit(
      c.env.DB,
      'customers',
      createdCustomer.id,
      'create',
      currentUser.userId,
      undefined,
      createdCustomer
    );

    return c.json<ApiResponse>({
      success: true,
      data: createdCustomer,
      message: 'Customer created successfully'
    }, 201);

  } catch (error) {
    console.error('Create customer error:', error);
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request data',
        data: error.errors
      }, 400);
    }

    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to create customer'
    }, 500);
  }
});

// Update customer
customers.put('/:id', requireRole('accountant'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const currentUser = c.get('user');

    const updateSchema = CreateCustomerSchema.partial().extend({
      is_active: z.boolean().optional()
    });

    const updateData = updateSchema.parse(body);

    // Get current customer data for audit
    const oldCustomer = await DatabaseUtils.executeQueryFirst<Customer>(
      c.env.DB,
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );

    if (!oldCustomer) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Customer not found'
      }, 404);
    }

    // Check if customer code already exists (if being updated)
    if (updateData.customer_code && updateData.customer_code !== oldCustomer.customer_code) {
      const existingCustomer = await DatabaseUtils.executeQueryFirst(
        c.env.DB,
        'SELECT id FROM customers WHERE customer_code = ? AND id != ?',
        [updateData.customer_code, id]
      );

      if (existingCustomer) {
        return c.json<ApiResponse>({
          success: false,
          error: 'Customer with this code already exists'
        }, 400);
      }
    }

    const updatedCustomer = await DatabaseUtils.updateRecord<Customer>(
      c.env.DB,
      'customers',
      id,
      updateData
    );

    // Log audit
    await DatabaseUtils.logAudit(
      c.env.DB,
      'customers',
      id,
      'update',
      currentUser.userId,
      oldCustomer,
      updatedCustomer
    );

    return c.json<ApiResponse>({
      success: true,
      data: updatedCustomer,
      message: 'Customer updated successfully'
    });

  } catch (error) {
    console.error('Update customer error:', error);
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request data',
        data: error.errors
      }, 400);
    }

    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to update customer'
    }, 500);
  }
});

// Delete customer (soft delete)
customers.delete('/:id', requireRole('manager'), async (c) => {
  try {
    const id = c.req.param('id');
    const currentUser = c.get('user');

    // Get customer data for audit
    const customerToDelete = await DatabaseUtils.executeQueryFirst<Customer>(
      c.env.DB,
      'SELECT * FROM customers WHERE id = ?',
      [id]
    );

    if (!customerToDelete) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Customer not found'
      }, 404);
    }

    // Check if customer has open invoices
    const openInvoices = await DatabaseUtils.executeQueryFirst<{ count: number }>(
      c.env.DB,
      'SELECT COUNT(*) as count FROM invoices WHERE customer_id = ? AND status NOT IN (\'paid\', \'void\')',
      [id]
    );

    if (openInvoices && openInvoices.count > 0) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Cannot delete customer with open invoices'
      }, 400);
    }

    // Soft delete by setting is_active to false
    await DatabaseUtils.updateRecord(
      c.env.DB,
      'customers',
      id,
      { is_active: false }
    );

    // Log audit
    await DatabaseUtils.logAudit(
      c.env.DB,
      'customers',
      id,
      'delete',
      currentUser.userId,
      customerToDelete,
      { is_active: false }
    );

    return c.json<ApiResponse>({
      success: true,
      message: 'Customer deactivated successfully'
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to delete customer'
    }, 500);
  }
});

// Get customer's invoices
customers.get('/:id/invoices', requireRole('accountant'), async (c) => {
  try {
    const customerId = c.req.param('id');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const status = c.req.query('status');

    let whereClause = 'WHERE customer_id = ?';
    const params: any[] = [customerId];

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    const baseQuery = `
      SELECT * FROM invoices 
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const countQuery = `SELECT COUNT(*) as count FROM invoices ${whereClause}`;

    const result = await DatabaseUtils.paginate(
      c.env.DB,
      baseQuery,
      countQuery,
      params,
      page,
      limit
    );

    return c.json<PaginatedResponse<any>>({
      success: true,
      data: result.results,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Get customer invoices error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch customer invoices'
    }, 500);
  }
});

export default customers;