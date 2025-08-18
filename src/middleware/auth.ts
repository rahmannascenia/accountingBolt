import { Context, Next } from 'hono';
import type { Env, JWTPayload, UserRole } from '../types';
import { AuthUtils } from '../utils/auth';

// Extend Hono's Context with user info
declare module 'hono' {
  interface ContextVariableMap {
    user: JWTPayload;
  }
}

export const authMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  const token = AuthUtils.extractBearerToken(authHeader);

  if (!token) {
    return c.json({ success: false, error: 'Missing authorization token' }, 401);
  }

  const payload = AuthUtils.verifyJWT(token, c.env);
  if (!payload) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }

  // Verify user is still active
  try {
    const user = await c.env.DB.prepare(
      'SELECT id, email, role, is_active FROM users WHERE id = ? AND is_active = 1'
    ).bind(payload.userId).first();

    if (!user) {
      return c.json({ success: false, error: 'User not found or inactive' }, 401);
    }

    // Update last login
    await c.env.DB.prepare(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(payload.userId).run();

    c.set('user', payload);
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({ success: false, error: 'Authentication failed' }, 401);
  }
};

export const requireRole = (requiredRole: UserRole) => {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    if (!AuthUtils.hasPermission(user.role, requiredRole)) {
      return c.json({ 
        success: false, 
        error: `Insufficient permissions. Required: ${requiredRole}` 
      }, 403);
    }

    await next();
  };
};

export const requireAdmin = requireRole('admin');

export const requireManagerOrAdmin = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  if (!AuthUtils.canAccessAdminPanel(user.role)) {
    return c.json({ 
      success: false, 
      error: 'Admin or Manager role required' 
    }, 403);
  }

  await next();
};

// Optional auth middleware - doesn't fail if no token
export const optionalAuthMiddleware = async (c: Context<{ Bindings: Env }>, next: Next) => {
  const authHeader = c.req.header('Authorization');
  const token = AuthUtils.extractBearerToken(authHeader);

  if (token) {
    const payload = AuthUtils.verifyJWT(token, c.env);
    if (payload) {
      try {
        const user = await c.env.DB.prepare(
          'SELECT id, email, role, is_active FROM users WHERE id = ? AND is_active = 1'
        ).bind(payload.userId).first();

        if (user) {
          c.set('user', payload);
        }
      } catch (error) {
        console.error('Optional auth error:', error);
      }
    }
  }

  await next();
};