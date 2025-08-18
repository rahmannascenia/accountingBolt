import { Context, Next } from 'hono';

export const corsMiddleware = async (c: Context, next: Next) => {
  const origin = c.req.header('Origin');
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:3000', 
    'https://localhost:5173',
    'https://localhost:3000'
    // Add your production domains here
  ];

  // Allow all origins in development
  const isDevelopment = c.env?.ENVIRONMENT === 'development';
  const isOriginAllowed = isDevelopment || (origin && allowedOrigins.includes(origin));

  if (isOriginAllowed) {
    c.res.headers.set('Access-Control-Allow-Origin', origin || '*');
  }

  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  c.res.headers.set('Access-Control-Allow-Credentials', 'true');
  c.res.headers.set('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (c.req.method === 'OPTIONS') {
    return c.text('', 204);
  }

  await next();
};