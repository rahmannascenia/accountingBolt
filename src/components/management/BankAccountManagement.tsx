import React, { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BankAccount {
  id: string;
  name: string;
  account_number: string;
  bank_name: string;
  currency: string;
  account_type: 'operational' | 'erq' | 'savings' | 'current';
  balance: number;
  is_active: boolean;
}

interface Currency {
  id: string;
  code: string;
  name: string;
}

export function BankAccountManagement() {
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    account_number: '',
    bank_name: '',
    currency: 'USD',
    account_type: 'operational' as 'operational' | 'erq' | 'savings' | 'current',
    balance: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [accountsResult, currenciesResult] = await Promise.all([
        supabase.from('bank_accounts').select('*').order('created_at', { ascending: false }),
        supabase.from('currencies').select('*').order('code')
      ]);

      if (accountsResult.data) setBankAccounts(accountsResult.data);
      if (currenciesResult.data) setCurrencies(currenciesResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const accountData = {
        ...formData,
        balance: parseFloat(formData.balance) || 0,
      };

      if (editingAccount) {
        await supabase
          .from('bank_accounts')
          .update(accountData)
          .eq('id', editingAccount.id);
      } else {
        await supabase
          .from('bank_accounts')
          .insert([accountData]);
      }

      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving bank account:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this bank account?')) {
      try {
        await supabase.from('bank_accounts').delete().eq('id', id);
        await loadData();
      } catch (error) {
        console.error('Error deleting bank account:', error);
      }
    }
  };

  const toggleStatus = async (id: string, isActive: boolean) => {
    try {
      await supabase
        .from('bank_accounts')
        .update({ is_active: !isActive })
        .eq('id', id);
      await loadData();
    } catch (error) {
      console.error('Error updating account status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      account_number: '',
      bank_name: '',
      currency: 'USD',
      account_type: 'operational',
      balance: '',
    });
    setEditingAccount(null);
    setShowForm(false);
  };

  const editAccount = (account: BankAccount) => {
    setFormData({
      name: account.name,
      account_number: account.account_number,
      bank_name: account.bank_name,
      currency: account.currency,
      account_type: account.account_type,
      balance: account.balance.toString(),
    });
    setEditingAccount(account);
    setShowForm(true);
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'operational': return 'bg-blue-100 text-blue-800';
      case 'erq': return 'bg-green-100 text-green-800';
      case 'savings': return 'bg-purple-100 text-purple-800';
      case 'current': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAccountTypeDescription = (type: string) => {
    switch (type) {
      case 'operational': return 'Day-to-day business operations';
      case 'erq': return 'Export Receipt Account for foreign currency';
      case 'savings': return 'Savings account for reserves';
      case 'current': return 'Current account for regular transactions';
      default: return '';
    }
  };

  // Group accounts by currency
  const accountsByCurrency = bankAccounts.reduce((acc, account) => {
    if (!acc[account.currency]) {
      acc[account.currency] = [];
    }
    acc[account.currency].push(account);
    return acc;
  }, {} as Record<string, BankAccount[]>);

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
          <Building2 className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Bank Account Management</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? 'Cancel' : 'Add Bank Account'}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">
            {editingAccount ? 'Edit Bank Account' : 'Add New Bank Account'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Main USD Account"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Account Number *
                </label>
                <input
                  type="text"
                  required
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1234567890"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Standard Chartered Bank"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency *
                </label>
                <select
                  required
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {currencies.map((currency) => (
                    <option key={currency.id} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
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
                  <option value="operational">Operational</option>
                  <option value="erq">ERQ (Export Receipt)</option>
                  <option value="savings">Savings</option>
                  <option value="current">Current</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {getAccountTypeDescription(formData.account_type)}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Balance
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingAccount ? 'Update Account' : 'Create Account'}
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

      {/* Account Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Object.entries(accountsByCurrency).map(([currency, accounts]) => (
          <div key={currency} className="bg-white p-4 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-900">{currency} Accounts</h3>
            <p className="text-2xl font-bold text-blue-600">{accounts.length}</p>
            <p className="text-sm text-gray-600">
              Total Balance: {currency} {accounts.reduce((sum, acc) => sum + acc.balance, 0).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Bank Accounts List */}
      <div className="space-y-6">
        {Object.entries(accountsByCurrency).map(([currency, accounts]) => (
          <div key={currency} className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b">
              <h3 className="text-lg font-semibold">{currency} Accounts</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Bank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
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
                {accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{account.name}</div>
                        <div className="text-sm text-gray-500">
                          Account: {account.account_number}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account.bank_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getAccountTypeColor(account.account_type)}`}>
                        {account.account_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account.currency} {account.balance.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => toggleStatus(account.id, account.is_active)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          account.is_active 
                            ? "bg-green-100 text-green-800 hover:bg-green-200" 
                            : "bg-red-100 text-red-800 hover:bg-red-200"
                        } transition-colors`}
                      >
                        {account.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {bankAccounts.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bank accounts yet</h3>
          <p className="text-gray-500 mb-4">Add your first bank account to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Bank Account
          </button>
        </div>
      )}
    </div>
  );
}