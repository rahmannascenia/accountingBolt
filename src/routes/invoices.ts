import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Invoice, ApiResponse, PaginatedResponse } from '../types';
import { CreateInvoiceSchema, InvoiceStatus } from '../types';
import { DatabaseUtils } from '../utils/database';
import { authMiddleware, requireRole } from '../middleware/auth';

const invoices = new Hono<{ Bindings: Env }>();

// All invoice routes require authentication
invoices.use('*', authMiddleware);

// Get all invoices
invoices.get('/', requireRole('accountant'), async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const search = c.req.query('search') || '';
    const status = c.req.query('status') || '';
    const customerId = c.req.query('customer_id') || '';

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (i.invoice_number LIKE ? OR c.company_name LIKE ? OR c.first_name LIKE ? OR c.last_name LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status && InvoiceStatus.includes(status as any)) {
      whereClause += ' AND i.status = ?';
      params.push(status);
    }

    if (customerId) {
      whereClause += ' AND i.customer_id = ?';
      params.push(customerId);
    }

    const baseQuery = `
      SELECT i.*, 
        c.company_name, c.first_name, c.last_name,
        u.first_name as created_by_first_name, u.last_name as created_by_last_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      ${whereClause}
      ORDER BY i.created_at DESC
    `;

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      ${whereClause}
    `;

    const result = await DatabaseUtils.paginate<Invoice & {
      company_name: string | null;
      first_name: string | null;
      last_name: string | null;
      created_by_first_name: string;
      created_by_last_name: string;
    }>(
      c.env.DB,
      baseQuery,
      countQuery,
      params,
      page,
      limit
    );

    return c.json<PaginatedResponse<Invoice>>({
      success: true,
      data: result.results as any,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Get invoices error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch invoices'
    }, 500);
  }
});

// Get invoice by ID
invoices.get('/:id', requireRole('accountant'), async (c) => {
  try {
    const id = c.req.param('id');

    // Get invoice with customer and line items
    const invoice = await DatabaseUtils.executeQueryFirst<Invoice & {
      company_name: string | null;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      created_by_first_name: string;
      created_by_last_name: string;
    }>(
      c.env.DB,
      `SELECT i.*, 
        c.company_name, c.first_name, c.last_name, c.email, c.address, c.city, c.state, c.postal_code,
        u.first_name as created_by_first_name, u.last_name as created_by_last_name
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN users u ON i.created_by = u.id
      WHERE i.id = ?`,
      [id]
    );

    if (!invoice) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invoice not found'
      }, 404);
    }

    // Get line items
    const lineItems = await DatabaseUtils.executeQuery(
      c.env.DB,
      `SELECT ili.*, coa.account_name
      FROM invoice_line_items ili
      LEFT JOIN chart_of_accounts coa ON ili.account_id = coa.id
      WHERE ili.invoice_id = ?
      ORDER BY ili.created_at ASC`,
      [id]
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        ...invoice,
        line_items: lineItems.results
      }
    });

  } catch (error) {
    console.error('Get invoice error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch invoice'
    }, 500);
  }
});

// Create invoice
invoices.post('/', requireRole('accountant'), async (c) => {
  try {
    const body = await c.req.json();
    const invoiceData = CreateInvoiceSchema.parse(body);
    const currentUser = c.get('user');

    // Generate invoice number
    const lastInvoice = await DatabaseUtils.executeQueryFirst<{ invoice_number: string }>(
      c.env.DB,
      'SELECT invoice_number FROM invoices ORDER BY created_at DESC LIMIT 1'
    );

    let invoiceNumber = 'INV-0001';
    if (lastInvoice) {
      const lastNumber = parseInt(lastInvoice.invoice_number.split('-')[1]) || 0;
      invoiceNumber = `INV-${(lastNumber + 1).toString().padStart(4, '0')}`;
    }

    // Calculate totals from line items
    const subtotal = invoiceData.line_items.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price);
    }, 0);

    const tax_amount = invoiceData.line_items.reduce((sum, item) => {
      return sum + (item.quantity * item.unit_price * (item.tax_rate || 0));
    }, 0);

    const total_amount = subtotal + tax_amount;

    // Create invoice using transaction
    await DatabaseUtils.transaction(c.env.DB, async (tx) => {
      // Create invoice
      const newInvoice = {
        id: DatabaseUtils.generateId('inv'),
        invoice_number: invoiceNumber,
        customer_id: invoiceData.customer_id,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date,
        subtotal: subtotal,
        tax_amount: tax_amount,
        total_amount: total_amount,
        paid_amount: 0,
        balance_due: total_amount,
        status: 'draft' as const,
        notes: invoiceData.notes || null,
        terms: invoiceData.terms || null,
        created_by: currentUser.userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const createdInvoice = await DatabaseUtils.insertRecord<Invoice>(
        tx,
        'invoices',
        newInvoice
      );

      // Create line items
      for (const lineItem of invoiceData.line_items) {
        const lineTotal = lineItem.quantity * lineItem.unit_price;
        
        await DatabaseUtils.insertRecord(
          tx,
          'invoice_line_items',
          {
            id: DatabaseUtils.generateId('invli'),
            invoice_id: createdInvoice.id,
            item_description: lineItem.item_description,
            quantity: lineItem.quantity,
            unit_price: lineItem.unit_price,
            line_total: lineTotal,
            tax_rate: lineItem.tax_rate || 0,
            account_id: lineItem.account_id || null,
            created_at: new Date().toISOString()
          }
        );
      }

      // Log audit
      await DatabaseUtils.logAudit(
        tx,
        'invoices',
        createdInvoice.id,
        'create',
        currentUser.userId,
        undefined,
        createdInvoice
      );

      return createdInvoice;
    });

    return c.json<ApiResponse>({
      success: true,
      data: { invoice_number: invoiceNumber },
      message: 'Invoice created successfully'
    }, 201);

  } catch (error) {
    console.error('Create invoice error:', error);
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request data',
        data: error.errors
      }, 400);
    }

    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to create invoice'
    }, 500);
  }
});

// Update invoice status
invoices.patch('/:id/status', requireRole('accountant'), async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const currentUser = c.get('user');

    const statusSchema = z.object({
      status: z.enum(InvoiceStatus)
    });

    const { status } = statusSchema.parse(body);

    // Get current invoice data
    const oldInvoice = await DatabaseUtils.executeQueryFirst<Invoice>(
      c.env.DB,
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    );

    if (!oldInvoice) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invoice not found'
      }, 404);
    }

    // Update invoice status
    const updatedInvoice = await DatabaseUtils.updateRecord<Invoice>(
      c.env.DB,
      'invoices',
      id,
      { status }
    );

    // Log audit
    await DatabaseUtils.logAudit(
      c.env.DB,
      'invoices',
      id,
      'update',
      currentUser.userId,
      { status: oldInvoice.status },
      { status: status }
    );

    return c.json<ApiResponse>({
      success: true,
      data: updatedInvoice,
      message: 'Invoice status updated successfully'
    });

  } catch (error) {
    console.error('Update invoice status error:', error);
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request data',
        data: error.errors
      }, 400);
    }

    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to update invoice status'
    }, 500);
  }
});

// Delete invoice
invoices.delete('/:id', requireRole('manager'), async (c) => {
  try {
    const id = c.req.param('id');
    const currentUser = c.get('user');

    // Get invoice data for audit
    const invoiceToDelete = await DatabaseUtils.executeQueryFirst<Invoice>(
      c.env.DB,
      'SELECT * FROM invoices WHERE id = ?',
      [id]
    );

    if (!invoiceToDelete) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invoice not found'
      }, 404);
    }

    // Check if invoice has payments
    const payments = await DatabaseUtils.executeQueryFirst<{ count: number }>(
      c.env.DB,
      'SELECT COUNT(*) as count FROM payment_applications WHERE invoice_id = ?',
      [id]
    );

    if (payments && payments.count > 0) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Cannot delete invoice with payments'
      }, 400);
    }

    // Set status to void instead of hard delete
    await DatabaseUtils.updateRecord(
      c.env.DB,
      'invoices',
      id,
      { status: 'void' }
    );

    // Log audit
    await DatabaseUtils.logAudit(
      c.env.DB,
      'invoices',
      id,
      'delete',
      currentUser.userId,
      invoiceToDelete,
      { status: 'void' }
    );

    return c.json<ApiResponse>({
      success: true,
      message: 'Invoice voided successfully'
    });

  } catch (error) {
    console.error('Delete invoice error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to delete invoice'
    }, 500);
  }
});

// Get overdue invoices
invoices.get('/reports/overdue', requireRole('accountant'), async (c) => {
  try {
    const overdueInvoices = await DatabaseUtils.executeQuery<Invoice & {
      company_name: string | null;
      first_name: string | null;
      last_name: string | null;
      days_overdue: number;
    }>(
      c.env.DB,
      `SELECT i.*, 
        c.company_name, c.first_name, c.last_name,
        CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      WHERE i.due_date < date('now') 
        AND i.status NOT IN ('paid', 'void')
        AND i.balance_due > 0
      ORDER BY i.due_date ASC`
    );

    return c.json<ApiResponse>({
      success: true,
      data: overdueInvoices.results
    });

  } catch (error) {
    console.error('Get overdue invoices error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch overdue invoices'
    }, 500);
  }
});

export default invoices;