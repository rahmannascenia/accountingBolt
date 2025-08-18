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
  Calculator,
  Shield,
  Settings,
  Activity
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface UserProfile {
  id: string;
  role: 'admin' | 'accountant' | 'user' | 'viewer';
  permissions: Record<string, boolean>;
  full_name: string;
  email: string;
}

interface NavigationProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  userProfile: UserProfile | null;
}

const getNavigationItems = (userProfile: UserProfile | null) => {
  const baseItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'accountant', 'user', 'viewer'] },
    { id: 'customers', label: 'Customers', icon: Users, roles: ['admin', 'accountant', 'user'] },
    { id: 'services', label: 'Services', icon: Package, roles: ['admin', 'accountant', 'user'] },
    { id: 'invoices', label: 'Invoices', icon: FileText, roles: ['admin', 'accountant', 'user'] },
    { id: 'payments', label: 'Payments', icon: CreditCard, roles: ['admin', 'accountant', 'user'] },
    { id: 'expenses', label: 'Expenses', icon: Receipt, roles: ['admin', 'accountant', 'user'] },
    { id: 'banks', label: 'Bank Accounts', icon: Building2, roles: ['admin', 'accountant'] },
    { id: 'journals', label: 'All Journals', icon: BookOpen, roles: ['admin', 'accountant'] },
    { id: 'accounts', label: 'Chart of Accounts', icon: PieChart, roles: ['admin', 'accountant'] },
    { id: 'currencies', label: 'FX Rates', icon: TrendingUp, roles: ['admin', 'accountant'] },
    { id: 'incentives', label: 'Cash Incentives', icon: DollarSign, roles: ['admin', 'accountant'] },
  ];

  const reportItems = [
    { id: 'trial-balance', label: 'Trial Balance', icon: BarChart3, roles: ['admin', 'accountant', 'viewer'] },
    { id: 'ar-breakdown', label: 'AR Breakdown', icon: Users, roles: ['admin', 'accountant', 'viewer'] },
    { id: 'balance-sheet', label: 'Balance Sheet', icon: PieChart, roles: ['admin', 'accountant', 'viewer'] },
    { id: 'fx-analysis', label: 'FX Analysis', icon: Calculator, roles: ['admin', 'accountant', 'viewer'] },
    { id: 'reports', label: 'Reports', icon: PieChart, roles: ['admin', 'accountant', 'viewer'] },
  ];

  const adminItems = [
    { id: 'admin-dashboard', label: 'System Overview', icon: Activity, roles: ['admin'] },
    { id: 'users', label: 'User Management', icon: Users, roles: ['admin'] },
    { id: 'system-settings', label: 'System Settings', icon: Settings, roles: ['admin'] },
  ];

  const userRole = userProfile?.role || 'viewer';
  
  return [
    ...baseItems.filter(item => item.roles.includes(userRole)),
    ...reportItems.filter(item => item.roles.includes(userRole)),
    ...(userRole === 'admin' ? adminItems : [])
  ];
};

export function Navigation({ currentPage, onNavigate, userProfile }: NavigationProps) {
  const { signOut, user, isAdmin } = useAuth();
  
  const navigationItems = getNavigationItems(userProfile);

  // Group navigation items
  const mainItems = navigationItems.filter(item => 
    !['admin-dashboard', 'users', 'system-settings', 'trial-balance', 'ar-breakdown', 'balance-sheet', 'fx-analysis', 'reports'].includes(item.id)
  );
  
  const reportItems = navigationItems.filter(item => 
    ['trial-balance', 'ar-breakdown', 'balance-sheet', 'fx-analysis', 'reports'].includes(item.id)
  );
  
  const adminItems = navigationItems.filter(item => 
    ['admin-dashboard', 'users', 'system-settings'].includes(item.id)
  );

  const renderNavSection = (items: any[], title?: string) => (
    <>
      {title && (
        <div className="px-3 mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {title}
          </p>
        </div>
      )}
      {items.map((item) => {
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
    </>
  );

  return (
    <nav className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <Building2 className="h-8 w-8 text-blue-600" />
          <h1 className="text-xl font-bold text-gray-900">FinanSys</h1>
        </div>
        {userProfile && (
          <div className="mt-3 px-2 py-1 bg-gray-100 rounded-md">
            <p className="text-xs text-gray-600">Role: {userProfile.role}</p>
          </div>
        )}
      </div>

      <div className="flex-1 py-6 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {/* Main Navigation */}
          {renderNavSection(mainItems)}
          
          {/* Reports Section */}
          {reportItems.length > 0 && (
            <>
              <li className="pt-4">
                <div className="border-t border-gray-200 pt-4">
                  {renderNavSection(reportItems, "Reports")}
                </div>
              </li>
            </>
          )}
          
          {/* Admin Section */}
          {adminItems.length > 0 && isAdmin && (
            <>
              <li className="pt-4">
                <div className="border-t border-gray-200 pt-4">
                  {renderNavSection(adminItems, "Administration")}
                </div>
              </li>
            </>
          )}
        </ul>
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="mb-3 px-3">
          <p className="text-xs text-gray-500">Signed in as</p>
          <p className="text-sm font-medium text-gray-900 truncate">
            {userProfile?.full_name || user?.email}
          </p>
          <p className="text-xs text-gray-500 truncate">
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