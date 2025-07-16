import React, { useState, useEffect } from 'react';
import { Receipt, Plus, Edit2, Trash2, CheckCircle, XCircle, Calculator, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Expense {
  id: string;
  expense_number: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  currency: string;
  vendor: string | null;
  bank_account_id: string | null;
  payment_method: 'bank_transfer' | 'cash' | 'check' | 'online';
  vat_amount: number | null;
  is_recurring: boolean;
  recurring_frequency: string | null;
  status: 'pending' | 'paid' | 'cancelled';
  notes: string | null;
  exchange_rate: number | null;
  bdt_amount: number | null;
  fx_calculation_method: 'foreign_to_bdt' | 'bdt_to_foreign';
  fx_rate_source: string;
  bdt_calculated_amount: number | null;
  bank_accounts?: { name: string; currency: string } | null;
}

interface BankAccount {
  id: string;
  name: string;
  currency: string;
  account_type: string;
  is_active: boolean;
}

interface Currency {
  id: string;
  code: string;
  name: string;
}

export function ExpenseManagement() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFXRateModal, setShowFXRateModal] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    category: '',
    search: '',
    status: '',
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    category: '',
    amount: '',
    currency: 'BDT',
    vendor: '',
    bank_account_id: '',
    payment_method: 'bank_transfer' as 'bank_transfer' | 'cash' | 'check' | 'online',
    vat_amount: '',
    is_recurring: false,
    recurring_frequency: '',
    notes: '',
    exchange_rate: '',
    bdt_amount: '',
    fx_calculation_method: 'foreign_to_bdt' as 'foreign_to_bdt' | 'bdt_to_foreign',
    fx_rate_source: 'Manual',
  });

  const expenseCategories = [
    'Office Rent',
    'Utilities', 
    'Software Licenses',
    'Professional Services',
    'Marketing',
    'Travel',
    'Equipment',
    'Supplies',
    'Insurance',
    'Bank Charges',
    'Legal Fees',
    'Training',
    'Telecommunications',
    'Maintenance',
    'Other'
  ];

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (formData.currency !== 'BDT') {
      fetchFXRate();
    } else {
      setFormData(prev => ({
        ...prev,
        exchange_rate: '1.0',
        bdt_amount: prev.amount,
      }));
    }
  }, [formData.currency, formData.date, fetchFXRate]);

  const loadData = async () => {
    try {
      const [expensesResult, bankAccountsResult, currenciesResult] = await Promise.all([
        supabase
          .from('expenses')
          .select(`
            *,
            bank_accounts(name, currency)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('bank_accounts').select('*').eq('is_active', true).order('name'),
        supabase.from('currencies').select('*').order('code')
      ]);

      if (expensesResult.data) setExpenses(expensesResult.data);
      if (bankAccountsResult.data) setBankAccounts(bankAccountsResult.data);
      if (currenciesResult.data) setCurrencies(currenciesResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFXRate = async () => {
    if (formData.currency === 'BDT') return;

    try {
      const { data, error } = await supabase.rpc('get_fx_rate', {
        p_from_currency: formData.currency,
        p_to_currency: 'BDT',
        p_date: formData.date
      });

      if (error) throw error;

      if (data) {
        setFormData(prev => ({
          ...prev,
          exchange_rate: data.toString(),
          fx_rate_source: 'Database'
        }));
        calculateBDTAmount(parseFloat(prev.amount) || 0, data, prev.fx_calculation_method);
      } else {
        // No rate found, show modal for manual input
        setShowFXRateModal(true);
      }
    } catch (error) {
      console.error('Error fetching FX rate:', error);
      setShowFXRateModal(true);
    }
  };

  const calculateBDTAmount = (amount: number, rate: number, method: 'foreign_to_bdt' | 'bdt_to_foreign') => {
    if (formData.currency === 'BDT') {
      setFormData(prev => ({ ...prev, bdt_amount: amount.toString() }));
      return;
    }

    let bdtAmount: number;
    if (method === 'foreign_to_bdt') {
      bdtAmount = amount * rate;
    } else {
      // bdt_to_foreign: user enters BDT amount, we calculate the rate
      bdtAmount = amount;
    }

    setFormData(prev => ({ ...prev, bdt_amount: bdtAmount.toFixed(2) }));
  };

  const handleAmountChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    
    if (formData.currency !== 'BDT') {
      const amount = parseFloat(field === 'amount' ? value : newFormData.amount) || 0;
      const bdtAmount = parseFloat(field === 'bdt_amount' ? value : newFormData.bdt_amount) || 0;
      const exchangeRate = parseFloat(field === 'exchange_rate' ? value : newFormData.exchange_rate) || 0;

      if (field === 'amount' && formData.fx_calculation_method === 'foreign_to_bdt' && exchangeRate > 0) {
        newFormData.bdt_amount = (amount * exchangeRate).toFixed(2);
      } else if (field === 'bdt_amount' && formData.fx_calculation_method === 'bdt_to_foreign' && amount > 0) {
        newFormData.exchange_rate = (bdtAmount / amount).toFixed(6);
      } else if (field === 'exchange_rate' && formData.fx_calculation_method === 'foreign_to_bdt' && amount > 0) {
        newFormData.bdt_amount = (amount * parseFloat(value)).toFixed(2);
      }
    } else {
      if (field === 'amount') {
        newFormData.bdt_amount = value;
      }
    }

    setFormData(newFormData);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Get old values for audit trail (if editing)
      let oldValues = null;
      if (editingExpense) {
        const { data: currentExpense } = await supabase
          .from('expenses')
          .select('*')
          .eq('id', editingExpense.id)
          .single();
        oldValues = currentExpense;
      }

      // Generate expense number
      let expenseNumber = '';
      if (!editingExpense) {
        const expenseCount = await supabase.from('expenses').select('id', { count: 'exact', head: true });
        const year = new Date().getFullYear();
        expenseNumber = `EXP-${year}-${String((expenseCount.count || 0) + 1).padStart(4, '0')}`;
      }

      const expenseData = {
        ...(expenseNumber && { expense_number: expenseNumber }),
        date: formData.date,
        description: formData.description,
        category: formData.category,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        vendor: formData.vendor || null,
        bank_account_id: formData.bank_account_id || null,
        payment_method: formData.payment_method,
        vat_amount: formData.vat_amount ? parseFloat(formData.vat_amount) : null,
        is_recurring: formData.is_recurring,
        recurring_frequency: formData.recurring_frequency || null,
        notes: formData.notes || null,
        exchange_rate: formData.currency !== 'BDT' ? parseFloat(formData.exchange_rate) : null,
        bdt_amount: formData.currency !== 'BDT' ? parseFloat(formData.bdt_amount) : null,
        fx_calculation_method: formData.fx_calculation_method,
        fx_rate_source: formData.fx_rate_source,
      };

      let expenseId: string;

      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id);

        if (error) throw error;
        expenseId = editingExpense.id;

        // Log audit trail for update
        await supabase.rpc('log_audit_trail', {
          p_table_name: 'expenses',
          p_record_id: expenseId,
          p_operation_type: 'UPDATE',
          p_old_values: oldValues,
          p_new_values: expenseData,
          p_description: `Expense updated: ${expenseData.description}`,
          p_module: 'expenses'
        });
      } else {
        const { data, error } = await supabase
          .from('expenses')
          .insert([expenseData])
          .select()
          .single();

        if (error) throw error;
        expenseId = data.id;

        // Log audit trail for create
        await supabase.rpc('log_audit_trail', {
          p_table_name: 'expenses',
          p_record_id: expenseId,
          p_operation_type: 'CREATE',
          p_old_values: null,
          p_new_values: expenseData,
          p_description: `Expense created: ${expenseData.description}`,
          p_module: 'expenses'
        });
      }

      // Save FX rate if foreign currency
      if (formData.currency !== 'BDT' && formData.exchange_rate) {
        await supabase.rpc('upsert_fx_rate', {
          p_from_currency: formData.currency,
          p_to_currency: 'BDT',
          p_date: formData.date,
          p_rate: parseFloat(formData.exchange_rate),
          p_source: formData.fx_rate_source,
          p_notes: `From expense: ${expenseNumber || editingExpense?.expense_number}`
        });
      }

      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving expense:', error);
      alert('Error saving expense. Please try again.');
    }
  };

  const handleStatusUpdate = async (expenseId: string, status: 'pending' | 'paid' | 'cancelled') => {
    try {
      // Get old values for audit trail
      const { data: oldExpense } = await supabase
        .from('expenses')
        .select('*')
        .eq('id', expenseId)
        .single();

      await supabase
        .from('expenses')
        .update({ status })
        .eq('id', expenseId);

      // Log audit trail
      await supabase.rpc('log_audit_trail', {
        p_table_name: 'expenses',
        p_record_id: expenseId,
        p_operation_type: 'UPDATE',
        p_old_values: oldExpense,
        p_new_values: { status },
        p_description: `Expense status updated to ${status}`,
        p_module: 'expenses'
      });

      await loadData();
    } catch (error) {
      console.error('Error updating expense status:', error);
    }
  };

  const handleDelete = async (expenseId: string) => {
    if (confirm('Are you sure you want to delete this expense?')) {
      try {
        // Get old values for audit trail
        const { data: oldExpense } = await supabase
          .from('expenses')
          .select('*')
          .eq('id', expenseId)
          .single();

        await supabase.from('expenses').delete().eq('id', expenseId);

        // Log audit trail
        await supabase.rpc('log_audit_trail', {
          p_table_name: 'expenses',
          p_record_id: expenseId,
          p_operation_type: 'DELETE',
          p_old_values: oldExpense,
          p_new_values: null,
          p_description: `Expense deleted: ${oldExpense?.description}`,
          p_module: 'expenses'
        });

        await loadData();
      } catch (error) {
        console.error('Error deleting expense:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      category: '',
      amount: '',
      currency: 'BDT',
      vendor: '',
      bank_account_id: '',
      payment_method: 'bank_transfer',
      vat_amount: '',
      is_recurring: false,
      recurring_frequency: '',
      notes: '',
      exchange_rate: '',
      bdt_amount: '',
      fx_calculation_method: 'foreign_to_bdt',
      fx_rate_source: 'Manual',
    });
    setEditingExpense(null);
    setShowForm(false);
  };

  const editExpense = (expense: Expense) => {
    setEditingExpense(expense);
    setFormData({
      date: expense.date,
      description: expense.description,
      category: expense.category,
      amount: expense.amount.toString(),
      currency: expense.currency,
      vendor: expense.vendor || '',
      bank_account_id: expense.bank_account_id || '',
      payment_method: expense.payment_method,
      vat_amount: expense.vat_amount?.toString() || '',
      is_recurring: expense.is_recurring,
      recurring_frequency: expense.recurring_frequency || '',
      notes: expense.notes || '',
      exchange_rate: expense.exchange_rate?.toString() || '',
      bdt_amount: expense.bdt_amount?.toString() || '',
      fx_calculation_method: expense.fx_calculation_method || 'foreign_to_bdt',
      fx_rate_source: expense.fx_rate_source || 'Manual',
    });
    setShowForm(true);
  };

  const availableBankAccounts = bankAccounts.filter(ba => 
    ba.currency === formData.currency && ba.is_active
  );

  // Filter expenses
  const filteredExpenses = expenses.filter(expense => {
    if (filters.startDate && expense.date < filters.startDate) return false;
    if (filters.endDate && expense.date > filters.endDate) return false;
    if (filters.category && expense.category !== filters.category) return false;
    if (filters.status && expense.status !== filters.status) return false;
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return expense.expense_number.toLowerCase().includes(searchLower) ||
             expense.description.toLowerCase().includes(searchLower) ||
             expense.category.toLowerCase().includes(searchLower) ||
             expense.vendor?.toLowerCase().includes(searchLower);
    }
    return true;
  });

  const calculatedAmounts = {
    foreignAmount: parseFloat(formData.amount) || 0,
    bdtAmount: parseFloat(formData.bdt_amount) || 0,
    exchangeRate: parseFloat(formData.exchange_rate) || 0
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
          <Receipt className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Expense Management</h2>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            if (showForm) {
              setEditingExpense(null);
              resetForm();
            }
          }}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? 'Cancel' : 'Record Expense'}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {expenseCategories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
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
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search expenses..."
            />
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">{editingExpense ? 'Edit' : 'Record New'} Expense</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category *
                </label>
                <select
                  required
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Category</option>
                  {expenseCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency *
                </label>
                <select
                  required
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value, bank_account_id: '' })}
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
                  Payment Method *
                </label>
                <select
                  required
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="online">Online Payment</option>
                </select>
              </div>
            </div>

            {/* Currency and Amount Section */}
            {formData.currency !== 'BDT' && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3">Foreign Exchange Calculation</h4>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Calculation Method</label>
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="foreign_to_bdt"
                        checked={formData.fx_calculation_method === 'foreign_to_bdt'}
                        onChange={(e) => setFormData({ ...formData, fx_calculation_method: e.target.value as any })}
                        className="mr-2"
                      />
                      <span className="text-sm">Enter {formData.currency} amount → Calculate BDT</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        value="bdt_to_foreign"
                        checked={formData.fx_calculation_method === 'bdt_to_foreign'}
                        onChange={(e) => setFormData({ ...formData, fx_calculation_method: e.target.value as any })}
                        className="mr-2"
                      />
                      <span className="text-sm">Enter BDT amount → Calculate rate</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.currency} Amount *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={formData.amount}
                      onChange={(e) => handleAmountChange('amount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="1000.00"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Exchange Rate
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.exchange_rate}
                      onChange={(e) => handleAmountChange('exchange_rate', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="110.500000"
                      readOnly={formData.fx_calculation_method === 'bdt_to_foreign'}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      1 {formData.currency} = {formData.exchange_rate || '0'} BDT
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      BDT Amount
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.bdt_amount}
                      onChange={(e) => handleAmountChange('bdt_amount', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="110500.00"
                      readOnly={formData.fx_calculation_method === 'foreign_to_bdt'}
                    />
                  </div>
                </div>

                <div className="mt-3 p-3 bg-white rounded border">
                  <div className="flex items-center space-x-2">
                    <Calculator className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Calculation Result:</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {calculatedAmounts.foreignAmount.toFixed(2)} {formData.currency} × {calculatedAmounts.exchangeRate.toFixed(6)} = {calculatedAmounts.bdtAmount.toFixed(2)} BDT
                  </p>
                </div>
              </div>
            )}

            {formData.currency === 'BDT' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => handleAmountChange('amount', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor
                </label>
                <input
                  type="text"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Vendor name"
                />
              </div>

              {formData.payment_method !== 'cash' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bank Account
                  </label>
                  <select
                    value={formData.bank_account_id}
                    onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select Bank Account</option>
                    {availableBankAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name} ({account.currency})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VAT Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.vat_amount}
                  onChange={(e) => setFormData({ ...formData, vat_amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <input
                type="text"
                required
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Expense description"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="mr-2"
              />
              <label className="text-sm font-medium text-gray-700">Recurring Expense</label>
            </div>

            {formData.is_recurring && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Frequency
                </label>
                <select
                  value={formData.recurring_frequency}
                  onChange={(e) => setFormData({ ...formData, recurring_frequency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Frequency</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            )}

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingExpense ? 'Update' : 'Record'} Expense
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

      {/* FX Rate Modal */}
      {showFXRateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 bg-yellow-50 border-b">
              <h3 className="text-lg font-semibold text-yellow-900">Exchange Rate Required</h3>
            </div>
            <div className="p-6">
              <div className="flex items-start mb-4">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
                <div>
                  <p className="text-gray-600">
                    No exchange rate found for {formData.currency} to BDT on {formData.date}. 
                    Please enter the exchange rate manually.
                  </p>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {formData.currency} to BDT Rate
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={formData.exchange_rate}
                  onChange={(e) => setFormData({ ...formData, exchange_rate: e.target.value, fx_rate_source: 'Manual' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  placeholder={`Enter ${formData.currency} rate`}
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    if (formData.exchange_rate) {
                      calculateBDTAmount(parseFloat(formData.amount) || 0, parseFloat(formData.exchange_rate), formData.fx_calculation_method);
                      setShowFXRateModal(false);
                    }
                  }}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
                  disabled={!formData.exchange_rate}
                >
                  Apply Rate
                </button>
                <button
                  onClick={() => setShowFXRateModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Expenses List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expense Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Payment
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
            {filteredExpenses.map((expense) => (
              <tr key={expense.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{expense.expense_number}</div>
                    <div className="text-sm text-gray-500">{expense.date}</div>
                    <div className="text-sm text-gray-900">{expense.description}</div>
                    {expense.vendor && (
                      <div className="text-sm text-gray-500">Vendor: {expense.vendor}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {expense.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {expense.currency} {expense.amount.toLocaleString()}
                  </div>
                  {expense.currency !== 'BDT' && expense.bdt_calculated_amount && (
                    <div className="text-sm text-blue-600">
                      Rate: {expense.exchange_rate?.toFixed(6)} → BDT {expense.bdt_calculated_amount.toLocaleString()}
                    </div>
                  )}
                  {expense.vat_amount && expense.vat_amount > 0 && (
                    <div className="text-sm text-gray-500">
                      VAT: {expense.currency} {expense.vat_amount.toLocaleString()}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">{expense.payment_method.replace('_', ' ')}</div>
                  {expense.bank_accounts && (
                    <div className="text-sm text-gray-500">{expense.bank_accounts.name}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    expense.status === 'paid' ? "bg-green-100 text-green-800" :
                    expense.status === 'cancelled' ? "bg-red-100 text-red-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {expense.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => editExpense(expense)}
                      className="text-blue-600 hover:text-blue-900 p-1"
                      title="Edit expense"
                      disabled={expense.status === 'paid'}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    {expense.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusUpdate(expense.id, 'paid')}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Mark as paid"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(expense.id, 'cancelled')}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Cancel expense"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => handleDelete(expense.id)}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="Delete expense"
                      disabled={expense.status === 'paid'}
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

      {expenses.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No expenses yet</h3>
          <p className="text-gray-500 mb-4">Record your first expense to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Record Expense
          </button>
        </div>
      )}

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">
              Automated Journal Entries
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              When you mark an expense as "Paid", the system automatically creates the corresponding journal entry, 
              debiting the expense account and crediting the cash/bank account. Foreign currency expenses are 
              converted to BDT using the exchange rate, and the rate is saved for future reference.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}