import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Protected Route Component
interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { isAuthenticated, hasRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

// Main App Component
const AppRoutes: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      
      {/* Protected routes */}
      <Route path="/" element={
        <ProtectedRoute>
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      } />
      
      {/* Admin routes */}
      <Route path="/admin/*" element={
        <ProtectedRoute requiredRole={['admin', 'manager']}>
          <Layout>
            <Routes>
              <Route index element={<AdminDashboard />} />
              {/* Additional admin routes will be added here */}
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />

      {/* Customers routes */}
      <Route path="/customers/*" element={
        <ProtectedRoute requiredRole={['accountant', 'manager', 'admin']}>
          <Layout>
            <Routes>
              <Route index element={<div>Customers List (Coming Soon)</div>} />
              <Route path="new" element={<div>New Customer (Coming Soon)</div>} />
              <Route path=":id" element={<div>Customer Details (Coming Soon)</div>} />
              <Route path=":id/edit" element={<div>Edit Customer (Coming Soon)</div>} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />

      {/* Invoices routes */}
      <Route path="/invoices/*" element={
        <ProtectedRoute requiredRole={['accountant', 'manager', 'admin']}>
          <Layout>
            <Routes>
              <Route index element={<div>Invoices List (Coming Soon)</div>} />
              <Route path="new" element={<div>New Invoice (Coming Soon)</div>} />
              <Route path=":id" element={<div>Invoice Details (Coming Soon)</div>} />
              <Route path=":id/edit" element={<div>Edit Invoice (Coming Soon)</div>} />
              <Route path="reports/overdue" element={<div>Overdue Invoices (Coming Soon)</div>} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />

      {/* Settings routes */}
      <Route path="/settings" element={
        <ProtectedRoute>
          <Layout>
            <div>Settings (Coming Soon)</div>
          </Layout>
        </ProtectedRoute>
      } />

      {/* Reports routes */}
      <Route path="/reports" element={
        <ProtectedRoute requiredRole={['accountant', 'manager', 'admin']}>
          <Layout>
            <div>Reports (Coming Soon)</div>
          </Layout>
        </ProtectedRoute>
      } />

      {/* Catch all route */}
      <Route path="*" element={
        isAuthenticated ? (
          <Navigate to="/" replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
};

export default App;