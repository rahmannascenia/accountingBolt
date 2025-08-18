import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-workers';
import type { Env } from './types';
import { corsMiddleware } from './middleware/cors';
import { generalRateLimit } from './middleware/rateLimit';

// Import routes
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import customerRoutes from './routes/customers';
import invoiceRoutes from './routes/invoices';

const app = new Hono<{ Bindings: Env }>();

// Global middleware
app.use('*', corsMiddleware);
app.use('/api/*', generalRateLimit);

// Health check endpoint
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: c.env?.ENVIRONMENT || 'development'
  });
});

// API routes
app.route('/api/auth', authRoutes);
app.route('/api/admin', adminRoutes);
app.route('/api/customers', customerRoutes);
app.route('/api/invoices', invoiceRoutes);

// Additional API endpoints
app.get('/api/dashboard/stats', async (c) => {
  try {
    // Get basic stats for dashboard
    const [
      totalCustomers,
      totalInvoices,
      totalRevenue,
      overdueInvoices,
      draftInvoices
    ] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM customers WHERE is_active = 1').first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM invoices').first(),
      c.env.DB.prepare('SELECT COALESCE(SUM(paid_amount), 0) as total FROM invoices').first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM invoices WHERE due_date < date(\'now\') AND status NOT IN (\'paid\', \'void\')').first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM invoices WHERE status = \'draft\'').first()
    ]);

    return c.json({
      success: true,
      data: {
        totalCustomers: (totalCustomers as any)?.count || 0,
        totalInvoices: (totalInvoices as any)?.count || 0,
        totalRevenue: (totalRevenue as any)?.total || 0,
        overdueInvoices: (overdueInvoices as any)?.count || 0,
        draftInvoices: (draftInvoices as any)?.count || 0
      }
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch dashboard stats'
    }, 500);
  }
});

// Chart of accounts endpoints
app.get('/api/accounts', async (c) => {
  try {
    const accounts = await c.env.DB.prepare(
      'SELECT * FROM chart_of_accounts WHERE is_active = 1 ORDER BY account_code'
    ).all();

    return c.json({
      success: true,
      data: accounts.results
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch accounts'
    }, 500);
  }
});

// Serve static files (React frontend) - this should come last
app.get('*', serveStatic({ 
  root: './',
  rewriteRequestPath: (path) => {
    // Serve index.html for all non-API routes (SPA routing)
    if (!path.startsWith('/api/') && !path.includes('.')) {
      return '/index.html';
    }
    return path;
  }
}));

// 404 handler for API routes
app.notFound((c) => {
  const path = c.req.path;
  if (path.startsWith('/api/')) {
    return c.json({
      success: false,
      error: 'API endpoint not found'
    }, 404);
  }
  
  // For non-API routes, serve the React app
  return c.redirect('/');
});

// Global error handler
app.onError((err, c) => {
  console.error('Global error handler:', err);
  
  if (c.req.path.startsWith('/api/')) {
    return c.json({
      success: false,
      error: 'Internal server error'
    }, 500);
  }
  
  return c.text('Internal Server Error', 500);
});

export default app;