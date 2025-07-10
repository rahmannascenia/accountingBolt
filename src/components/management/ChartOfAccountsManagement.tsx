import React, { useState, useEffect } from 'react';
import { PieChart, Plus, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ChartOfAccount {
  id: string;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_account_id: string | null;
  description: string | null;
  is_active: boolean;
}

export function ChartOfAccountsManagement() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ChartOfAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    accountType: '',
    search: '',
    status: '',
  });

  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: 'asset' as 'asset' | 'liability' | 'equity' | 'revenue' | 'expense',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const { data } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .order('account_code');

      if (data) setAccounts(data);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter accounts based on search and filters
  const filteredAccounts = accounts.filter(account => {
    if (filters.accountType && account.account_type !== filters.accountType) return false;
    if (filters.status === 'active' && !account.is_active) return false;
    if (filters.status === 'inactive' && account.is_active) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return account.account_code.toLowerCase().includes(searchLower) ||
             account.account_name.toLowerCase().includes(searchLower) ||
             account.description?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  // Group accounts by type
  const groupedAccounts = filteredAccounts.reduce((groups, account) => {
    const type = account.account_type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(account);
    return groups;
  }, {} as Record<string, ChartOfAccount[]>);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await supabase
          .from('chart_of_accounts')
          .update(formData)
          .eq('id', editingAccount.id);
      } else {
        await supabase
          .from('chart_of_accounts')
          .insert([formData]);
      }
      
      await loadAccounts();
      resetForm();
    } catch (error) {
      console.error('Error saving account:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      account_code: '',
      account_name: '',
      account_type: 'asset',
      description: '',
      is_active: true,
    });
    setEditingAccount(null);
    setShowForm(false);
  };

  const editAccount = (account: ChartOfAccount) => {
    setEditingAccount(account);
    setFormData({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      description: account.description || '',
      is_active: account.is_active,
    });
    setShowForm(true);
  };

  const handleDelete = async (accountId: string) => {
    if (confirm('Are you sure you want to delete this account?')) {
      try {
        await supabase.from('chart_of_accounts').delete().eq('id', accountId);
        await loadAccounts();
      } catch (error) {
        console.error('Error deleting account:', error);
      }
    }
  };

  const handleInitializeDefaults = async () => {
    try {
      const defaultAccounts = [
        // Assets
        { account_code: '1000', account_name: 'Cash', account_type: 'asset' },
        { account_code: '1100', account_name: 'Bank - Local Currency', account_type: 'asset' },
        { account_code: '1200', account_name: 'Bank - Foreign Currency', account_type: 'asset' },
        { account_code: '1300', account_name: 'Accounts Receivable - Local', account_type: 'asset' },
        { account_code: '1400', account_name: 'Accounts Receivable - Foreign', account_type: 'asset' },
        { account_code: '1500', account_name: 'TDS Receivable', account_type: 'asset' },
        { account_code: '1600', account_name: 'VDS Receivable', account_type: 'asset' },
        { account_code: '1700', account_name: 'Equipment', account_type: 'asset' },
        
        // Liabilities
        { account_code: '2000', account_name: 'Accounts Payable', account_type: 'liability' },
        { account_code: '2100', account_name: 'VAT Collected', account_type: 'liability' },
        { account_code: '2200', account_name: 'Accrued Expenses', account_type: 'liability' },
        
        // Equity
        { account_code: '3000', account_name: "Owner's Equity", account_type: 'equity' },
        { account_code: '3100', account_name: 'Retained Earnings', account_type: 'equity' },
        
        // Revenue
        { account_code: '4000', account_name: 'Software Services Revenue - Local', account_type: 'revenue' },
        { account_code: '4100', account_name: 'Software Services Revenue - Export', account_type: 'revenue' },
        { account_code: '4200', account_name: 'Cash Incentive Income', account_type: 'revenue' },
        { account_code: '4300', account_name: 'Currency Gain', account_type: 'revenue' },
        
        // Expenses
        { account_code: '5000', account_name: 'Office Rent', account_type: 'expense' },
        { account_code: '5100', account_name: 'Utilities', account_type: 'expense' },
        { account_code: '5200', account_name: 'Software Licenses', account_type: 'expense' },
        { account_code: '5300', account_name: 'Professional Services', account_type: 'expense' },
        { account_code: '5400', account_name: 'Bank Charges - SWIFT', account_type: 'expense' },
        { account_code: '5500', account_name: 'Bank Charges - Other', account_type: 'expense' },
        { account_code: '5600', account_name: 'Discount Given', account_type: 'expense' },
        { account_code: '5700', account_name: 'Currency Loss', account_type: 'expense' },
        { account_code: '5800', account_name: 'Marketing', account_type: 'expense' },
        { account_code: '5900', account_name: 'Travel', account_type: 'expense' },
      ];

      await supabase.from('chart_of_accounts').insert(defaultAccounts);
      await loadAccounts();
    } catch (error) {
      console.error('Error initializing default accounts:', error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'asset': return 'bg-blue-100 text-blue-800';
      case 'liability': return 'bg-red-100 text-red-800';
      case 'equity': return 'bg-purple-100 text-purple-800';
      case 'revenue': return 'bg-green-100 text-green-800';
      case 'expense': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <PieChart className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Chart of Accounts</h2>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleInitializeDefaults}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700"
          >
            Initialize Defaults
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              if (showForm) {
                setEditingAccount(null);
                resetForm();
              }
            }}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{showForm ? 'Cancel' : 'Add Account'}</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Type</label>
            <select
              value={filters.accountType}
              onChange={(e) => setFilters({ ...filters, accountType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expense</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search accounts..."
            />
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">{editingAccount ? 'Edit' : 'Add New'} Account</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.account_code}
                  onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Cash"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Type *
                </label>
                <select
                  required
                  value={formData.account_type}
                  onChange={(e) => setFormData({ ...formData, account_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="asset">Asset</option>
                  <option value="liability">Liability</option>
                  <option value="equity">Equity</option>
                  <option value="revenue">Revenue</option>
                  <option value="expense">Expense</option>
                </select>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="mr-2"
                />
                <label className="text-sm font-medium text-gray-700">Active</label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Account description"
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingAccount ? 'Update' : 'Create'} Account
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grouped Accounts Display */}
      <div className="space-y-6">
        {Object.entries(groupedAccounts).map(([type, typeAccounts]) => (
          <div key={type} className="bg-white rounded-lg shadow overflow-hidden">
            <div className={`px-6 py-3 ${getTypeColor(type)} border-b`}>
              <h3 className="text-lg font-semibold capitalize">{type} Accounts ({typeAccounts.length})</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {typeAccounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {account.account_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account.account_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {account.description || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        account.is_active ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"
                      }`}>
                        {account.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => editAccount(account)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Edit account"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete account"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {filteredAccounts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <PieChart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No accounts found</h3>
          <p className="text-gray-500 mb-4">
            {accounts.length === 0 ? 'Initialize default accounts to get started.' : 'Try adjusting your filters.'}
          </p>
          {accounts.length === 0 && (
            <button
              onClick={handleInitializeDefaults}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Initialize Default Accounts
            </button>
          )}
        </div>
      )}
    </div>
  );
}