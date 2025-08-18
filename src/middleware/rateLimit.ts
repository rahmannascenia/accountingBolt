import { Context, Next } from 'hono';
import type { Env } from '../types';

// Simple in-memory rate limiter (in production, use KV store)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (c: Context) => string; // Function to generate rate limit key
}

export const rateLimitMiddleware = (options: RateLimitOptions) => {
  const { windowMs, maxRequests, keyGenerator } = options;

  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const key = keyGenerator ? keyGenerator(c) : getDefaultKey(c);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Clean up expired entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (now > v.resetTime) {
        rateLimitStore.delete(k);
      }
    }

    const record = rateLimitStore.get(key);

    if (!record) {
      rateLimitStore.set(key, { count: 1, resetTime });
      await next();
      return;
    }

    if (now > record.resetTime) {
      // Window has expired, reset
      rateLimitStore.set(key, { count: 1, resetTime });
      await next();
      return;
    }

    if (record.count >= maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      c.res.headers.set('Retry-After', retryAfter.toString());
      c.res.headers.set('X-RateLimit-Limit', maxRequests.toString());
      c.res.headers.set('X-RateLimit-Remaining', '0');
      c.res.headers.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

      return c.json({
        success: false,
        error: 'Too many requests',
        retryAfter
      }, 429);
    }

    // Increment counter
    record.count++;
    rateLimitStore.set(key, record);

    // Add rate limit headers
    c.res.headers.set('X-RateLimit-Limit', maxRequests.toString());
    c.res.headers.set('X-RateLimit-Remaining', (maxRequests - record.count).toString());
    c.res.headers.set('X-RateLimit-Reset', Math.ceil(record.resetTime / 1000).toString());

    await next();
  };
};

function getDefaultKey(c: Context): string {
  // Try to get IP address from various headers
  const forwarded = c.req.header('X-Forwarded-For');
  const realIp = c.req.header('X-Real-IP');
  const cfConnectingIp = c.req.header('CF-Connecting-IP');
  
  return forwarded?.split(',')[0].trim() || 
         realIp || 
         cfConnectingIp || 
         'unknown';
}

// Pre-configured rate limiters
export const authRateLimit = rateLimitMiddleware({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 login attempts per 15 minutes
  keyGenerator: (c: Context) => {
    const body = c.req.json().catch(() => ({}));
    const email = (body as any)?.email;
    return email ? `auth:${email}` : `auth:${getDefaultKey(c)}`;
  }
});

export const generalRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100 // 100 requests per minute
});

export const apiRateLimit = rateLimitMiddleware({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60 // 60 API requests per minute per user
});