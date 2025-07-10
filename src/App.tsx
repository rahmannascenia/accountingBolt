import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { AuthProvider } from './contexts/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import { Dashboard } from './components/dashboard/Dashboard';
import { CustomerManagement } from './components/management/CustomerManagement';
import { InvoiceManagement } from './components/management/InvoiceManagement';
import { EnhancedPaymentManagement } from './components/management/EnhancedPaymentManagement';
import { ExpenseManagement } from './components/management/ExpenseManagement';
import { BankAccountManagement } from './components/management/BankAccountManagement';
import { JournalEntryManagement } from './components/management/JournalEntryManagement';
import { ChartOfAccountsManagement } from './components/management/ChartOfAccountsManagement';
import { FXRateManagement } from './components/management/FXRateManagement';
import { ModernCashIncentiveManagement } from './components/management/ModernCashIncentiveManagement';
import { ReportsManagement } from './components/management/ReportsManagement';
import { ServiceManagement } from './components/management/ServiceManagement';
import { TrialBalance } from './components/management/TrialBalance';
import { ComprehensiveAuditTrail } from './components/management/ComprehensiveAuditTrail';
import { EnhancedFXAnalysis } from './components/management/EnhancedFXAnalysis';
import { AccountsReceivableBreakdown } from './components/management/AccountsReceivableBreakdown';
import { BalanceSheet } from './components/management/BalanceSheet';
import { AutoJournalManagement } from './components/management/AutoJournalManagement';
import { UserManagement } from './components/management/UserManagement';
import { Navigation } from './components/layout/Navigation';
import { Loader } from './components/ui/Loader';
import { useAuth } from './hooks/useAuth';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (loading) {
    return <Loader />;
  }

  if (!user) {
    return <AuthPage />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'customers':
        return <CustomerManagement />;
      case 'invoices':
        return <InvoiceManagement />;
      case 'payments':
        return <EnhancedPaymentManagement />;
      case 'expenses':
        return <ExpenseManagement />;
      case 'banks':
        return <BankAccountManagement />;
      case 'journals':
        return <AutoJournalManagement onNavigate={setCurrentPage} />;
      case 'manual-journal':
        return <JournalEntryManagement />;
      case 'accounts':
        return <ChartOfAccountsManagement />;
      case 'currencies':
        return <FXRateManagement />;
      case 'incentives':
        return <ModernCashIncentiveManagement />;
      case 'reports':
        return <ReportsManagement />;
      case 'services':
        return <ServiceManagement />;
      case 'trial-balance':
        return <TrialBalance />;
      case 'audit-trail':
        return <ComprehensiveAuditTrail />;
      case 'fx-analysis':
        return <EnhancedFXAnalysis />;
      case 'ar-breakdown':
        return <AccountsReceivableBreakdown />;
      case 'balance-sheet':
        return <BalanceSheet />;
      case 'users':
        return <UserManagement />;
      case 'dashboard':
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;