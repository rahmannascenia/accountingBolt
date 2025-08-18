import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, User, ApiResponse } from '../types';
import { LoginSchema, CreateUserSchema } from '../types';
import { AuthUtils } from '../utils/auth';
import { DatabaseUtils } from '../utils/database';
import { authMiddleware, requireAdmin } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimit';

const auth = new Hono<{ Bindings: Env }>();

// Login endpoint
auth.post('/login', authRateLimit, async (c) => {
  try {
    const body = await c.req.json();
    const { email, password } = LoginSchema.parse(body);

    // Find user by email
    const user = await DatabaseUtils.executeQueryFirst<User>(
      c.env.DB,
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid credentials'
      }, 401);
    }

    // Verify password
    const isPasswordValid = await AuthUtils.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid credentials'
      }, 401);
    }

    // Update last login
    await DatabaseUtils.executeQuery(
      c.env.DB,
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    // Generate JWT
    const token = AuthUtils.generateJWT({
      userId: user.id,
      email: user.email,
      role: user.role
    }, c.env);

    return c.json<ApiResponse>({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name,
          role: user.role
        }
      },
      message: 'Login successful'
    });

  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request data',
        data: error.errors
      }, 400);
    }

    return c.json<ApiResponse>({
      success: false,
      error: 'Login failed'
    }, 500);
  }
});

// Register endpoint (admin only)
auth.post('/register', authMiddleware, requireAdmin, async (c) => {
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
        role: createdUser.role
      },
      message: 'User created successfully'
    }, 201);

  } catch (error) {
    console.error('Register error:', error);
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request data',
        data: error.errors
      }, 400);
    }

    return c.json<ApiResponse>({
      success: false,
      error: 'Registration failed'
    }, 500);
  }
});

// Get current user info
auth.get('/me', authMiddleware, async (c) => {
  try {
    const currentUser = c.get('user');

    const user = await DatabaseUtils.executeQueryFirst<User>(
      c.env.DB,
      'SELECT id, email, first_name, last_name, role, is_active, created_at, last_login FROM users WHERE id = ?',
      [currentUser.userId]
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
    console.error('Get user info error:', error);
    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to get user info'
    }, 500);
  }
});

// Change password
auth.post('/change-password', authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { currentPassword, newPassword } = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(6)
    }).parse(body);

    const currentUser = c.get('user');

    // Get user's current password hash
    const user = await DatabaseUtils.executeQueryFirst<{ password_hash: string }>(
      c.env.DB,
      'SELECT password_hash FROM users WHERE id = ?',
      [currentUser.userId]
    );

    if (!user) {
      return c.json<ApiResponse>({
        success: false,
        error: 'User not found'
      }, 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await AuthUtils.verifyPassword(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Current password is incorrect'
      }, 400);
    }

    // Hash new password
    const newPasswordHash = await AuthUtils.hashPassword(newPassword);

    // Update password
    await DatabaseUtils.updateRecord(
      c.env.DB,
      'users',
      currentUser.userId,
      { password_hash: newPasswordHash }
    );

    // Log audit
    await DatabaseUtils.logAudit(
      c.env.DB,
      'users',
      currentUser.userId,
      'update',
      currentUser.userId,
      { password_changed: false },
      { password_changed: true }
    );

    return c.json<ApiResponse>({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    if (error instanceof z.ZodError) {
      return c.json<ApiResponse>({
        success: false,
        error: 'Invalid request data',
        data: error.errors
      }, 400);
    }

    return c.json<ApiResponse>({
      success: false,
      error: 'Failed to change password'
    }, 500);
  }
});

// Logout endpoint (mainly for client-side token removal)
auth.post('/logout', authMiddleware, async (c) => {
  return c.json<ApiResponse>({
    success: true,
    message: 'Logged out successfully'
  });
});

export default auth;