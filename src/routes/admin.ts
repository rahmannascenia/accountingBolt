import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, User, ApiResponse, PaginatedResponse, AuditLogEntry } from '../types';
import { CreateUserSchema, UserRoles } from '../types';
import { DatabaseUtils } from '../utils/database';
import { AuthUtils } from '../utils/auth';
import { authMiddleware, requireAdmin, requireManagerOrAdmin } from '../middleware/auth';

const admin = new Hono<{ Bindings: Env }>();

// All admin routes require authentication
admin.use('*', authMiddleware);

// Get dashboard stats
admin.get('/dashboard', requireManagerOrAdmin, async (c) => {
  try {
    const [
      totalUsers,
      totalCustomers,
      totalInvoices,
      totalRevenue,
      overdueInvoices,
      recentActivities
    ] = await Promise.all([
      // Total users
      DatabaseUtils.executeQueryFirst<{ count: number }>(
        c.env.DB,
        'SELECT COUNT(*) as count FROM users WHERE is_active = 1'
      ),
      // Total customers
      DatabaseUtils.executeQueryFirst<{ count: number }>(
        c.env.DB,
        'SELECT COUNT(*) as count FROM customers WHERE is_active = 1'
      ),
      // Total invoices
      DatabaseUtils.executeQueryFirst<{ count: number }>(
        c.env.DB,
        'SELECT COUNT(*) as count FROM invoices'
      ),
      // Total revenue (paid invoices)
      DatabaseUtils.executeQueryFirst<{ total: number }>(
        c.env.DB,
        'SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices'
      ),
      // Overdue invoices
      DatabaseUtils.executeQueryFirst<{ count: number }>(
        c.env.DB,
        `SELECT COUNT(*) as count FROM invoices 
         WHERE due_date < date('now') AND status NOT IN ('paid', 'void')`
      ),
      // Recent activities (audit log)
      DatabaseUtils.executeQuery<AuditLogEntry>(
        c.env.DB,
        `SELECT al.*, u.first_name, u.last_name 
         FROM audit_log al 
         JOIN users u ON al.user_id = u.id 
         ORDER BY al.timestamp DESC 
         LIMIT 10`
      )
    ]);

    return c.json<ApiResponse>({
      success: true,
      data: {
        stats: {
          totalUsers: totalUsers?.count || 0,
          totalCustomers: totalCustomers?.count || 0,
          totalInvoices: totalInvoices?.count || 0,
          totalRevenue: totalRevenue?.total || 0,
          overdueInvoices: overdueInvoices?.count || 0
        },
        recentActivities: recentActivities.results
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to load dashboard data'
    }, 500);
  }
});

// User management routes
admin.get('/users', requireManagerOrAdmin, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '10');
    const search = c.req.query('search') || '';
    const role = c.req.query('role') || '';

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (search) {
      whereClause += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (role && UserRoles.includes(role as any)) {
      whereClause += ' AND role = ?';
      params.push(role);
    }

    const baseQuery = `
      SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at, last_login
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
    `;

    const countQuery = `SELECT COUNT(*) as count FROM users ${whereClause}`;

    const result = await DatabaseUtils.paginate<User>(
      c.env.DB,
      baseQuery,
      countQuery,
      params,
      page,
      limit
    );

    return c.json<PaginatedResponse<User>>({
      success: true,
      data: result.results,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Get users error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch users'
    }, 500);
  }
});

admin.get('/users/:id', requireManagerOrAdmin, async (c) => {
  try {
    const id = c.req.param('id');

    const user = await DatabaseUtils.executeQueryFirst<User>(
      c.env.DB,
      'SELECT id, email, first_name, last_name, role, is_active, created_at, updated_at, last_login FROM users WHERE id = ?',
      [id]
    );

    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'User not found'
      }, 404);
    }

    return c.json<ApiResponse>({
      success: true,
      data: user
    });

  } catch (error) {
    console.error('Get user error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch user'
    }, 500);
  }
});

admin.post('/users', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const userData = CreateUserSchema.parse(body);
    const currentUser = c.get('user');

    // Check if user with email already exists
    const existingUser = await DatabaseUtils.executeQueryFirst(
      c.env.DB,
      'SELECT id FROM users WHERE email = ?',
      [userData.email]
    );

    if (existingUser) {
      return c.json<ApiResponse>({
        success: false,
        error: 'User with this email already exists'
      }, 400);
    }

    // Hash password
    const passwordHash = await AuthUtils.hashPassword(userData.password);

    // Create new user
    const newUser = {
      id: DatabaseUtils.generateId('user'),
      email: userData.email,
      password_hash: passwordHash,
      first_name: userData.first_name,
      last_name: userData.last_name,
      role: userData.role,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createdUser = await DatabaseUtils.insertRecord<User>(
      c.env.DB,
      'users',
      newUser
    );

    // Log audit
    await DatabaseUtils.logAudit(
      c.env.DB,
      'users',
      createdUser.id,
      'create',
      currentUser.userId,
      undefined,
      { ...createdUser, password_hash: '[REDACTED]' }
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        id: createdUser.id,
        email: createdUser.email,
        first_name: createdUser.first_name,
        last_name: createdUser.last_name,
        role: createdUser.role,
        is_active: createdUser.is_active
      },
      message: 'User created successfully'
    }, 201);

  } catch (error) {
    console.error('Create user error:', error);
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request data',
        data: error.errors
      }, 400);
    }

    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to create user'
    }, 500);
  }
});

admin.put('/users/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const currentUser = c.get('user');

    const updateSchema = z.object({
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      role: z.enum(UserRoles).optional(),
      is_active: z.boolean().optional()
    });

    const updateData = updateSchema.parse(body);

    // Get current user data for audit
    const oldUser = await DatabaseUtils.executeQueryFirst<User>(
      c.env.DB,
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (!oldUser) {
      return c.json<ApiResponse>({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // Prevent admin from deactivating themselves
    if (id === currentUser.userId && updateData.is_active === false) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Cannot deactivate your own account'
      }, 400);
    }

    const updatedUser = await DatabaseUtils.updateRecord<User>(
      c.env.DB,
      'users',
      id,
      updateData
    );

    // Log audit
    await DatabaseUtils.logAudit(
      c.env.DB,
      'users',
      id,
      'update',
      currentUser.userId,
      { ...oldUser, password_hash: '[REDACTED]' },
      { ...updatedUser, password_hash: '[REDACTED]' }
    );

    return c.json<ApiResponse>({
      success: true,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
        role: updatedUser.role,
        is_active: updatedUser.is_active
      },
      message: 'User updated successfully'
    });

  } catch (error) {
    console.error('Update user error:', error);
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request data',
        data: error.errors
      }, 400);
    }

    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to update user'
    }, 500);
  }
});

admin.delete('/users/:id', requireAdmin, async (c) => {
  try {
    const id = c.req.param('id');
    const currentUser = c.get('user');

    // Prevent admin from deleting themselves
    if (id === currentUser.userId) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Cannot delete your own account'
      }, 400);
    }

    // Get user data for audit
    const userToDelete = await DatabaseUtils.executeQueryFirst<User>(
      c.env.DB,
      'SELECT * FROM users WHERE id = ?',
      [id]
    );

    if (!userToDelete) {
      return c.json<ApiResponse>({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // Soft delete by setting is_active to false
    await DatabaseUtils.updateRecord(
      c.env.DB,
      'users',
      id,
      { is_active: false }
    );

    // Log audit
    await DatabaseUtils.logAudit(
      c.env.DB,
      'users',
      id,
      'delete',
      currentUser.userId,
      { ...userToDelete, password_hash: '[REDACTED]' },
      { is_active: false }
    );

    return c.json<ApiResponse>({
      success: true,
      message: 'User deactivated successfully'
    });

  } catch (error) {
    console.error('Delete user error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to delete user'
    }, 500);
  }
});

// Audit log routes
admin.get('/audit-log', requireManagerOrAdmin, async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const table = c.req.query('table') || '';
    const action = c.req.query('action') || '';

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (table) {
      whereClause += ' AND al.table_name = ?';
      params.push(table);
    }

    if (action) {
      whereClause += ' AND al.action = ?';
      params.push(action);
    }

    const baseQuery = `
      SELECT al.*, u.first_name, u.last_name, u.email
      FROM audit_log al 
      JOIN users u ON al.user_id = u.id 
      ${whereClause}
      ORDER BY al.timestamp DESC
    `;

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM audit_log al 
      JOIN users u ON al.user_id = u.id 
      ${whereClause}
    `;

    const result = await DatabaseUtils.paginate<AuditLogEntry & {
      first_name: string;
      last_name: string;
      email: string;
    }>(
      c.env.DB,
      baseQuery,
      countQuery,
      params,
      page,
      limit
    );

    return c.json<PaginatedResponse<AuditLogEntry>>({
      success: true,
      data: result.results as any,
      pagination: result.pagination
    });

  } catch (error) {
    console.error('Audit log error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to fetch audit log'
    }, 500);
  }
});

export default admin;