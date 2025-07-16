import React, { useState, useEffect } from 'react';
import { CreditCard, Plus, CheckCircle, XCircle, Calculator } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Payment {
  id: string;
  payment_number: string;
  customer_id: string;
  bank_account_id: string;
  amount: number;
  currency: string;
  bdt_amount: number | null;
  bdt_calculated_amount: number | null;
  exchange_rate: number | null;
  fx_calculation_method: 'foreign_to_bdt' | 'bdt_to_foreign';
  fx_rate_source: string;
  payment_date: string;
  payment_method: 'swift' | 'bank_transfer' | 'cash' | 'check';
  status: 'pending' | 'cleared' | 'failed';
  swift_fee: number | null;
  bank_charges: number | null;
  discount_given: number | null;
  net_amount: number | null;
  reference: string | null;
  notes: string | null;
  customers: { name: string; customer_type: string } | null;
  bank_accounts: { name: string; currency: string } | null;
}

interface Customer {
  id: string;
  name: string;
  customer_type: 'local' | 'foreign';
  currency: string;
}

interface BankAccount {
  id: string;
  name: string;
  currency: string;
  account_type: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  currency: string;
  remaining_amount: number;
}

interface FXRate {
  id: string;
  date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
}

export function EnhancedPaymentManagement() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showBadDebtForm, setShowBadDebtForm] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState('');
  const [badDebtAdjustmentAmount, setBadDebtAdjustmentAmount] = useState('');

  const [formData, setFormData] = useState({
    customer_id: '',
    bank_account_id: '',
    amount: '',
    currency: 'USD',
    bdt_amount: '',
    exchange_rate: '',
    fx_calculation_method: 'foreign_to_bdt' as 'foreign_to_bdt' | 'bdt_to_foreign',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'swift' as 'swift' | 'bank_transfer' | 'cash' | 'check',
    swift_fee: '',
    bank_charges: '',
    discount_given: '',
    reference: '',
    notes: '',
    allocations: [] as Array<{ invoice_id: string; allocated_amount: number; }>
  });

  const [badDebtForm, setBadDebtForm] = useState({
    invoice_id: '',
    adjustment_amount: '',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      loadCustomerInvoices(selectedCustomer);
    }
  }, [selectedCustomer]);

  const loadData = async () => {
    try {
      const [paymentsResult, customersResult, bankAccountsResult] = await Promise.all([
        supabase
          .from('payments')
          .select(`
            *,
            customers!inner(name, customer_type),
            bank_accounts!inner(name, currency)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('customers').select('*').order('name'),
        supabase.from('bank_accounts').select('*').eq('is_active', true).order('name')
      ]);

      if (paymentsResult.data) setPayments(paymentsResult.data);
      if (customersResult.data) setCustomers(customersResult.data);
      if (bankAccountsResult.data) setBankAccounts(bankAccountsResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomerInvoices = async (customerId: string) => {
    try {
      const { data: invoices } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', customerId)
        .eq('status', 'sent');

      if (invoices) {
        const invoicesWithRemaining = await Promise.all(
          invoices.map(async (invoice) => {
            const { data: allocations } = await supabase
              .from('payment_allocations')
              .select('allocated_amount')
              .eq('invoice_id', invoice.id);

            const totalAllocated = allocations?.reduce((sum, alloc) => sum + alloc.allocated_amount, 0) || 0;
            const remainingAmount = invoice.total_amount - totalAllocated;

            return {
              id: invoice.id,
              invoice_number: invoice.invoice_number,
              total_amount: invoice.total_amount,
              currency: invoice.currency,
              remaining_amount: remainingAmount
            };
          })
        );

        setCustomerInvoices(invoicesWithRemaining.filter(inv => inv.remaining_amount > 0.01));
      }
    } catch (error) {
      console.error('Error loading customer invoices:', error);
    }
  };

  const getFXRate = async (fromCurrency: string, toCurrency: string, date: string): Promise<FXRate | null> => {
    try {
      const { data } = await supabase
        .from('fx_rates')
        .select('*')
        .eq('from_currency', fromCurrency)
        .eq('to_currency', toCurrency)
        .lte('date', date)
        .eq('is_active', true)
        .order('date', { ascending: false })
        .limit(1);

      return data?.[0] || null;
    } catch (error) {
      console.error('Error fetching FX rate:', error);
      return null;
    }
  };

  const handleCustomerChange = async (customerId: string) => {
    setSelectedCustomer(customerId);
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setFormData({ 
        ...formData, 
        customer_id: customerId, 
        currency: customer.currency,
        allocations: [] 
      });

      // Auto-fetch FX rate if foreign currency
      if (customer.currency !== 'BDT') {
        const rate = await getFXRate(customer.currency, 'BDT', formData.payment_date);
        if (rate) {
          setFormData(prev => ({
            ...prev,
            exchange_rate: rate.rate.toString()
          }));
        } else {
          setFxRateInput({
            id: '',
            date: formData.payment_date,
            from_currency: customer.currency,
            to_currency: 'BDT',
            rate: 0,
            source: 'Manual'
          });
          setShowFXRateModal(true);
        }
      }
    }
  };

  const calculateAmounts = () => {
    const foreignAmount = parseFloat(formData.amount) || 0;
    const bdtAmount = parseFloat(formData.bdt_amount) || 0;
    const exchangeRate = parseFloat(formData.exchange_rate) || 0;

    if (formData.fx_calculation_method === 'foreign_to_bdt') {
      // Calculate BDT from foreign amount
      const calculatedBDT = foreignAmount * exchangeRate;
      return {
        foreignAmount,
        bdtAmount: calculatedBDT,
        exchangeRate
      };
    } else {
      // Calculate exchange rate from BDT amount
      const calculatedRate = foreignAmount > 0 ? bdtAmount / foreignAmount : 0;
      return {
        foreignAmount,
        bdtAmount,
        exchangeRate: calculatedRate
      };
    }
  };

  const handleAmountChange = (field: string, value: string) => {
    const newFormData = { ...formData, [field]: value };
    
    if (formData.currency !== 'BDT') {
      const foreignAmount = parseFloat(newFormData.amount) || 0;
      const bdtAmount = parseFloat(newFormData.bdt_amount) || 0;
      const exchangeRate = parseFloat(newFormData.exchange_rate) || 0;

      if (field === 'amount' && formData.fx_calculation_method === 'foreign_to_bdt' && exchangeRate > 0) {
        newFormData.bdt_amount = (foreignAmount * exchangeRate).toFixed(2);
      } else if (field === 'bdt_amount' && formData.fx_calculation_method === 'bdt_to_foreign' && foreignAmount > 0) {
        newFormData.exchange_rate = (bdtAmount / foreignAmount).toFixed(6);
      } else if (field === 'exchange_rate' && formData.fx_calculation_method === 'foreign_to_bdt' && foreignAmount > 0) {
        newFormData.bdt_amount = (foreignAmount * parseFloat(value)).toFixed(2);
      }
    }

    setFormData(newFormData);
  };

  const handleAllocationChange = (invoiceId: string, amount: number) => {
    const allocations = [...formData.allocations];
    const existingIndex = allocations.findIndex(a => a.invoice_id === invoiceId);

    if (existingIndex >= 0) {
      if (amount > 0) {
        allocations[existingIndex].allocated_amount = amount;
      } else {
        allocations.splice(existingIndex, 1);
      }
    } else if (amount > 0) {
      allocations.push({ invoice_id: invoiceId, allocated_amount: amount });
    }

    setFormData({ ...formData, allocations });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalAllocated = formData.allocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0);
      const paymentAmount = parseFloat(formData.amount);
      const swiftFee = formData.swift_fee ? parseFloat(formData.swift_fee) : 0;
      const bankCharges = formData.bank_charges ? parseFloat(formData.bank_charges) : 0;
      const discountGiven = formData.discount_given ? parseFloat(formData.discount_given) : 0;

      const expectedTotal = paymentAmount + swiftFee + bankCharges + discountGiven;
      if (Math.abs(totalAllocated - expectedTotal) > 0.01) {
        alert(`Total allocated (${totalAllocated.toFixed(2)}) must equal payment amount + fees + discount (${expectedTotal.toFixed(2)})`);
        return;
      }

      // Generate payment number
      const paymentCount = await supabase.from('payments').select('id', { count: 'exact', head: true });
      const year = new Date().getFullYear();
      const paymentNumber = `PAY-${year}-${String((paymentCount.count || 0) + 1).padStart(4, '0')}`;

      const netAmount = paymentAmount - swiftFee - bankCharges;
      const calculatedAmounts = calculateAmounts();

      const paymentData = {
        payment_number: paymentNumber,
        customer_id: formData.customer_id,
        bank_account_id: formData.bank_account_id,
        amount: paymentAmount,
        currency: formData.currency,
        bdt_amount: formData.currency !== 'BDT' ? calculatedAmounts.bdtAmount : null,
        bdt_calculated_amount: formData.currency !== 'BDT' ? calculatedAmounts.bdtAmount : paymentAmount,
        exchange_rate: formData.currency !== 'BDT' ? calculatedAmounts.exchangeRate : null,
        fx_calculation_method: formData.fx_calculation_method,
        fx_rate_source: 'Manual',
        payment_date: formData.payment_date,
        payment_method: formData.payment_method,
        swift_fee: swiftFee || null,
        bank_charges: bankCharges || null,
        discount_given: discountGiven || null,
        net_amount: netAmount,
        reference: formData.reference || null,
        notes: formData.notes || null,
      };

      const { data: payment, error } = await supabase
        .from('payments')
        .insert([paymentData])
        .select()
        .single();

      if (error) throw error;

      // Create payment allocations
      if (formData.allocations.length > 0) {
        const allocationsData = formData.allocations.map(alloc => ({
          payment_id: payment.id,
          invoice_id: alloc.invoice_id,
          allocated_amount: alloc.allocated_amount,
          allocation_date: formData.payment_date,
        }));

        await supabase.from('payment_allocations').insert(allocationsData);
      }

      await loadData();
      
      // Save FX rate if foreign currency and exchange rate was determined
      if (formData.currency !== 'BDT' && calculatedAmounts.exchangeRate > 0) {
        try {
          await supabase.rpc('upsert_fx_rate', {
            p_from_currency: formData.currency,
            p_to_currency: 'BDT',
            p_date: formData.payment_date,
            p_rate: calculatedAmounts.exchangeRate,
            p_source: 'Payment',
            p_notes: `From payment: ${paymentNumber}`
          });
        } catch (error) {
          console.error('Error saving FX rate from payment:', error);
        }
      }
      
      // Log audit trail for payment creation
      await supabase.from('audit_trail').insert({
        table_name: 'payments',
        record_id: payment.id,
        operation_type: 'CREATE',
        old_values: null,
        new_values: payment,
        description: `Payment created: ${paymentNumber}`,
        module: 'payments'
      });

      resetForm();
    } catch (error) {
      console.error('Error creating payment:', error);
    }
  };

  const handleBadDebtAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const invoice = customerInvoices.find(inv => inv.id === badDebtForm.invoice_id);
      if (!invoice) return;

      const adjustmentAmount = parseFloat(badDebtForm.adjustment_amount);
      const remainingAmount = invoice.remaining_amount - adjustmentAmount;

      // Create bad debt adjustment record
      const { data: adjustment, error } = await supabase
        .from('bad_debt_adjustments')
        .insert([{
          invoice_id: badDebtForm.invoice_id,
          customer_id: selectedCustomer,
          adjustment_date: new Date().toISOString().split('T')[0],
          original_amount: invoice.remaining_amount,
          adjustment_amount: adjustmentAmount,
          remaining_amount: remainingAmount,
          currency: invoice.currency,
          reason: badDebtForm.reason,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          notes: badDebtForm.notes,
        }])
        .select()
        .single();

      if (error) throw error;

      // Create journal entry for bad debt
      const journalEntryData = {
        entry_number: `BD-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        date: new Date().toISOString().split('T')[0],
        description: `Bad debt adjustment for invoice ${invoice.invoice_number}`,
        reference: invoice.invoice_number,
        total_debit: adjustmentAmount,
        total_credit: adjustmentAmount,
        status: 'posted',
        entry_type: 'bad_debt',
        source_document_id: adjustment.id,
        is_auto_generated: true,
      };

      const { data: journalEntry } = await supabase
        .from('journal_entries')
        .insert([journalEntryData])
        .select()
        .single();

      // Create journal entry lines
      const journalLines = [
        {
          journal_entry_id: journalEntry.id,
          account_code: '5104',
          account_name: 'Bad Debt Expense',
          account_type: 'expense',
          debit_amount: adjustmentAmount,
          credit_amount: 0,
          bdt_debit_amount: adjustmentAmount,
          bdt_credit_amount: 0,
          original_currency: invoice.currency,
          original_amount: adjustmentAmount,
          fx_rate: 1.0,
          description: `Bad debt write-off for ${invoice.invoice_number}`,
        },
        {
          journal_entry_id: journalEntry.id,
          account_code: invoice.currency === 'BDT' ? '1201' : '1202',
          account_name: invoice.currency === 'BDT' ? 'AR - Local Customers' : 'AR - Foreign Customers',
          account_type: 'asset',
          debit_amount: 0,
          credit_amount: adjustmentAmount,
          bdt_debit_amount: 0,
          bdt_credit_amount: adjustmentAmount,
          original_currency: invoice.currency,
          original_amount: adjustmentAmount,
          fx_rate: 1.0,
          description: `Bad debt write-off for ${invoice.invoice_number}`,
        }
      ];

      await supabase.from('journal_entry_lines').insert(journalLines);

      // Update bad debt adjustment with journal entry ID
      await supabase
        .from('bad_debt_adjustments')
        .update({ journal_entry_id: journalEntry.id, status: 'posted' })
        .eq('id', adjustment.id);

      setBadDebtForm({ invoice_id: '', adjustment_amount: '', reason: '', notes: '' });
      setShowBadDebtForm(null);
      await loadCustomerInvoices(selectedCustomer);

      // Log audit trail for bad debt adjustment
      await supabase.from('audit_trail').insert({
        table_name: 'bad_debt_adjustments',
        record_id: adjustment.id,
        operation_type: 'CREATE',
        old_values: null,
        new_values: adjustment,
        description: `Bad debt adjustment created for invoice ${invoice.invoice_number}`,
        module: 'payments'
      });
    } catch (error) {
      console.error('Error creating bad debt adjustment:', error);
    }
  };

  const handleStatusUpdate = async (id: string, status: 'pending' | 'cleared' | 'failed') => {
    try {
      await supabase
        .from('payments')
        .update({ status })
        .eq('id', id);
      await loadData();
    } catch (error) {
      console.error('Error updating payment status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      bank_account_id: '',
      amount: '',
      currency: 'USD',
      bdt_amount: '',
      exchange_rate: '',
      fx_calculation_method: 'foreign_to_bdt',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'swift',
      swift_fee: '',
      bank_charges: '',
      discount_given: '',
      reference: '',
      notes: '',
      allocations: []
    });
    setSelectedCustomer('');
    setCustomerInvoices([]);
    setBadDebtAdjustmentAmount('');
    setShowForm(false);
  };

  const calculatedAmounts = calculateAmounts();

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
          <CreditCard className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Enhanced Payment Management</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? 'Cancel' : 'Record Payment'}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">Record New Payment</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => handleCustomerChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.customer_type}) - {customer.currency}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account *</label>
                <select
                  required
                  value={formData.bank_account_id}
                  onChange={(e) => setFormData({ ...formData, bank_account_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Bank Account</option>
                  {bankAccounts.filter(ba => ba.currency === formData.currency).map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.currency})
                    </option>
                  ))}
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
                      placeholder="4900.00"
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
                      placeholder="539550.00"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount Received *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="150000.00"
                />
              </div>
            )}

            {/* Fees and Charges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT Fee</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.swift_fee}
                  onChange={(e) => setFormData({ ...formData, swift_fee: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="30.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Charges</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.bank_charges}
                  onChange={(e) => setFormData({ ...formData, bank_charges: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="20.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount Given</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.discount_given}
                  onChange={(e) => setFormData({ ...formData, discount_given: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="50.00"
                />
              </div>
            </div>

            {/* Invoice Allocation Section */}
            {selectedCustomer && customerInvoices.length > 0 && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-md font-semibold">Allocate Payment to Invoices</h4>
                  <button
                    type="button"
                    onClick={() => setShowBadDebtForm(showBadDebtForm ? null : selectedCustomer)}
                    className="text-sm bg-red-100 text-red-700 px-3 py-1 rounded hover:bg-red-200"
                  >
                    Bad Debt Adjustment
                  </button>
                </div>
                
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {customerInvoices.map((invoice) => (
                    <div key={invoice.id} className="flex items-center justify-between p-3 bg-white rounded border">
                      <div className="flex-1">
                        <div className="font-medium">{invoice.invoice_number}</div>
                        <div className="text-sm text-gray-600">
                          Total: {invoice.currency} {invoice.total_amount.toLocaleString()}
                          <span className="text-red-600 ml-2">
                            Remaining: {invoice.currency} {invoice.remaining_amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <div className="w-32">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={invoice.remaining_amount}
                          placeholder="Amount"
                          onChange={(e) => handleAllocationChange(invoice.id, parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bad Debt Adjustment Amount Input */}
                {selectedCustomer && customerInvoices.length > 0 && (() => {
                  const totalRemaining = customerInvoices.reduce((sum, inv) => sum + inv.remaining_amount, 0);
                  const totalAllocated = formData.allocations.reduce((sum, alloc) => sum + alloc.allocated_amount, 0);
                  const showBadDebtInput = totalAllocated < totalRemaining;
                  
                  return showBadDebtInput ? (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bad Debt Adjustment Amount
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={totalRemaining - totalAllocated}
                        value={badDebtAdjustmentAmount}
                        onChange={(e) => setBadDebtAdjustmentAmount(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                        placeholder="Enter amount to write off as bad debt"
                      />
                      <p className="text-xs text-gray-600 mt-1">
                        Unallocated amount: {formData.currency} {(totalRemaining - totalAllocated).toFixed(2)}
                      </p>
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Bad Debt Adjustment Form */}
            {showBadDebtForm && (
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900 mb-3">Bad Debt Adjustment</h4>
                <form onSubmit={handleBadDebtAdjustment} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Invoice</label>
                      <select
                        required
                        value={badDebtForm.invoice_id}
                        onChange={(e) => setBadDebtForm({ ...badDebtForm, invoice_id: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="">Select Invoice</option>
                        {customerInvoices.map((invoice) => (
                          <option key={invoice.id} value={invoice.id}>
                            {invoice.invoice_number} - {invoice.currency} {invoice.remaining_amount.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={badDebtForm.adjustment_amount}
                        onChange={(e) => setBadDebtForm({ ...badDebtForm, adjustment_amount: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder="Amount to write off"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <input
                      type="text"
                      required
                      value={badDebtForm.reason}
                      onChange={(e) => setBadDebtForm({ ...badDebtForm, reason: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Reason for bad debt adjustment"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <textarea
                      value={badDebtForm.notes}
                      onChange={(e) => setBadDebtForm({ ...badDebtForm, notes: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                      placeholder="Additional notes (optional)"
                    />
                  </div>
                  <div className="flex space-x-2">
                    <button
                      type="submit"
                      className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700"
                    >
                      Create Bad Debt Adjustment
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBadDebtForm(null)}
                      className="bg-gray-500 text-white px-4 py-2 rounded text-sm hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Other Payment Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={formData.payment_date}
                  onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                <select
                  required
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="swift">SWIFT Transfer</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Payment reference"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="Additional notes about fees, discounts, etc."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Record Payment
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

      {/* Payments List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount & FX
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bank Account
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
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{payment.payment_number}</div>
                      <div className="text-sm text-gray-500">{payment.payment_date}</div>
                      <div className="text-sm text-gray-500">{payment.payment_method}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.customers?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      Received: {payment.currency} {payment.amount.toLocaleString()}
                    </div>
                    {payment.exchange_rate && payment.bdt_calculated_amount && (
                      <div className="text-sm text-blue-600">
                        Rate: {payment.exchange_rate.toFixed(6)} → BDT {payment.bdt_calculated_amount.toLocaleString()}
                      </div>
                    )}
                    {(payment.swift_fee || payment.bank_charges || payment.discount_given) && (
                      <div className="text-xs text-gray-500">
                        {payment.swift_fee && `SWIFT: ${payment.swift_fee} `}
                        {payment.bank_charges && `Bank: ${payment.bank_charges} `}
                        {payment.discount_given && `Discount: ${payment.discount_given}`}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.bank_accounts?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      payment.status === 'cleared' ? "bg-green-100 text-green-800" :
                      payment.status === 'failed' ? "bg-red-100 text-red-800" :
                      "bg-yellow-100 text-yellow-800"
                    }`}>
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {payment.status === 'pending' && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleStatusUpdate(payment.id, 'cleared')}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Clear payment"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleStatusUpdate(payment.id, 'failed')}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Mark as failed"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No payments yet</h3>
          <p className="text-gray-500 mb-4">Record your first payment to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Record Payment
          </button>
        </div>
      )}
    </div>
  );
}