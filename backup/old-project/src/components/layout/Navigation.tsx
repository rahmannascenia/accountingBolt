import React from 'react';
import { 
  BarChart3, 
  Users, 
  FileText, 
  CreditCard, 
  Receipt, 
  Building2, 
  BookOpen, 
  PieChart,
  LogOut,
  DollarSign,
  TrendingUp,
  Package,
  Calculator
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'services', label: 'Services', icon: Package },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'banks', label: 'Bank Accounts', icon: Building2 },
  { id: 'journals', label: 'All Journals', icon: BookOpen },
  { id: 'accounts', label: 'Chart of Accounts', icon: PieChart },
  { id: 'currencies', label: 'FX Rates', icon: TrendingUp },
  { id: 'incentives', label: 'Cash Incentives', icon: DollarSign },
  { id: 'trial-balance', label: 'Trial Balance', icon: BarChart3 },
  { id: 'ar-breakdown', label: 'AR Breakdown', icon: Users },
  { id: 'balance-sheet', label: 'Balance Sheet', icon: PieChart },
  { id: 'fx-analysis', label: 'FX Analysis', icon: Calculator },
  { id: 'users', label: 'User Management', icon: Users },
  { id: 'reports', label: 'Reports', icon: PieChart },
];

export function Navigation({ currentPage, onNavigate }: NavigationProps) {
  const { signOut, user } = useAuth();

  return (
    <nav className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">FinanSys</h1>
        </div>
      </div>

      <div className="flex-1 py-6">
        <ul className="space-y-1 px-3">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => onNavigate(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="mb-3 px-3">
          <p className="text-xs text-gray-500">Signed in as</p>
          <p className="text-sm font-medium text-gray-900 truncate">
            {user?.email}
          </p>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center space-x-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors"
        >
          <LogOut className="h-4 w-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
}