import React, { useState, useEffect } from 'react';
import { TrendingUp, Plus, Edit2, History, AlertCircle, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface FXRate {
  id: string;
  date: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  created_by: string;
  created_at: string;
  modified_by: string | null;
  modified_at: string;
  is_active: boolean;
  notes: string | null;
}

interface Currency {
  id: string;
  code: string;
  name: string;
}

export function FXRateManagement() {
  const [fxRates, setFxRates] = useState<FXRate[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingRate, setEditingRate] = useState<FXRate | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    currency: '',
    startDate: '',
    endDate: '',
    source: '',
  });

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    from_currency: 'USD',
    to_currency: 'BDT',
    rate: '',
    source: 'Manual',
    notes: '',
  });

  const [affectedRecords, setAffectedRecords] = useState<string[]>([]);
  const [showImpactWarning, setShowImpactWarning] = useState(false);
  const [pendingRateChange, setPendingRateChange] = useState<Partial<FXRate> | null>(null);
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      let query = supabase
        .from('fx_rates')
        .select('*')
        .eq('is_active', true)
        .order('date', { ascending: false });

      if (filters.currency) {
        query = query.eq('from_currency', filters.currency);
      }
      if (filters.startDate) {
        query = query.gte('date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('date', filters.endDate);
      }
      if (filters.source) {
        query = query.eq('source', filters.source);
      }

      const [ratesResult, currenciesResult] = await Promise.all([
        query,
        supabase.from('currencies').select('*').order('code')
      ]);

      if (ratesResult.data) setFxRates(ratesResult.data);
      if (currenciesResult.data) setCurrencies(currenciesResult.data);
    } catch (error) {
      console.error('Error loading FX rates:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters, loadData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Check for existing rate and potential impact
      if (editingRate) {
        await checkRateChangeImpact();
        return;
      }

      const rateData = {
        ...formData,
        rate: parseFloat(formData.rate),
      };

      if (editingRate) {
        await supabase
          .from('fx_rates')
          .update({
            ...rateData,
            modified_at: new Date().toISOString(),
          })
          .eq('id', editingRate.id);
      } else {
        await supabase.from('fx_rates').insert([rateData]);
      }

      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving FX rate:', error);
    }
  };

  const checkRateChangeImpact = async () => {
    if (!editingRate) return;

    try {
      // Check for affected invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('invoice_number, status')
        .eq('currency', editingRate.from_currency)
        .eq('status', 'sent');

      // Check for affected payments
      const { data: payments } = await supabase
        .from('payments')
        .select('payment_number, status')
        .eq('currency', editingRate.from_currency)
        .eq('status', 'cleared');

      const affected: string[] = [];
      
      if (invoices) {
        affected.push(...invoices.map(inv => `Invoice: ${inv.invoice_number}`));
      }
      
      if (payments) {
        affected.push(...payments.map(pay => `Payment: ${pay.payment_number}`));
      }

      if (affected.length > 0) {
        setAffectedRecords(affected);
        setPendingRateChange({
          ...formData,
          rate: parseFloat(formData.rate),
        });
        setShowImpactWarning(true);
      } else {
        await proceedWithRateChange();
      }
    } catch (error) {
      console.error('Error checking rate impact:', error);
    }
  };

  const proceedWithRateChange = async () => {
    if (!editingRate || !pendingRateChange) return;

    try {
      await supabase
        .from('fx_rates')
        .update({
          ...pendingRateChange,
          modified_at: new Date().toISOString(),
        })
        .eq('id', editingRate.id);

      // Log the change in audit trail
      await supabase.from('audit_trail').insert({
        table_name: 'fx_rates',
        record_id: editingRate.id,
        operation_type: 'UPDATE',
        old_values: { rate: editingRate.rate },
        new_values: { rate: pendingRateChange.rate },
        description: `FX rate changed from ${editingRate.rate} to ${pendingRateChange.rate}. Affected records: ${affectedRecords.join(', ')}`,
      });

      await loadData();
      resetForm();
      setShowImpactWarning(false);
      setPendingRateChange(null);
      setAffectedRecords([]);
    } catch (error) {
      console.error('Error updating FX rate:', error);
    }
  };
  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      from_currency: 'USD',
      to_currency: 'BDT',
      rate: '',
      source: 'Manual',
      notes: '',
    });
    setEditingRate(null);
    setShowForm(false);
  };

  const editRate = (rate: FXRate) => {
    setEditingRate(rate);
    setFormData({
      date: rate.date,
      from_currency: rate.from_currency,
      to_currency: rate.to_currency,
      rate: rate.rate.toString(),
      source: rate.source,
      notes: rate.notes || '',
    });
    setShowForm(true);
  };

  const deactivateRate = async (id: string) => {
    if (confirm('Are you sure you want to deactivate this FX rate? This will affect all related transactions.')) {
      try {
        await supabase
          .from('fx_rates')
          .update({ 
            is_active: false,
            modified_by: (await supabase.auth.getUser()).data.user?.id,
            modified_at: new Date().toISOString(),
          })
          .eq('id', id);
        await loadData();
      } catch (error) {
        console.error('Error deactivating FX rate:', error);
      }
    }
  };


  const copyRate = (rate: FXRate) => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      from_currency: rate.from_currency,
      to_currency: rate.to_currency,
      rate: rate.rate.toString(),
      source: 'Manual',
      notes: `Copied from ${rate.date}`,
    });
    setShowForm(true);
  };

  const sources = ['Manual', 'Bangladesh Bank', 'API', 'Market Rate', 'Other'];

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
          <TrendingUp className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">FX Rate Management</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? 'Cancel' : 'Add FX Rate'}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={filters.currency}
              onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Currencies</option>
              {currencies.filter(c => c.code !== 'BDT').map((currency) => (
                <option key={currency.id} value={currency.code}>{currency.code}</option>
              ))}
            </select>
          </div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
            <select
              value={filters.source}
              onChange={(e) => setFilters({ ...filters, source: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Sources</option>
              {sources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">
            {editingRate ? 'Edit FX Rate' : 'Add New FX Rate'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  From Currency *
                </label>
                <select
                  required
                  value={formData.from_currency}
                  onChange={(e) => setFormData({ ...formData, from_currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {currencies.filter(c => c.code !== 'BDT').map((currency) => (
                    <option key={currency.id} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Currency
                </label>
                <input
                  type="text"
                  value={formData.to_currency}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exchange Rate *
                </label>
                <input
                  type="number"
                  step="0.000001"
                  required
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="110.500000"
                />
                <p className="text-xs text-gray-500 mt-1">
                  1 {formData.from_currency} = {formData.rate || '0'} BDT
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source *
                </label>
                <select
                  required
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {sources.map((source) => (
                    <option key={source} value={source}>{source}</option>
                  ))}
                </select>
              </div>
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
                placeholder="Additional notes about this rate..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingRate ? 'Update Rate' : 'Add Rate'}
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

      {/* Rate Change Impact Warning */}
      {showImpactWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 bg-red-50 border-b">
              <h3 className="text-lg font-semibold text-red-900">FX Rate Change Impact Warning</h3>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
              <div className="flex items-start mb-4">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-red-800">
                    This rate change will affect existing posted transactions
                  </h4>
                  <p className="text-sm text-red-700 mt-1">
                    Changing this FX rate may impact the following records. Posted transactions will NOT be automatically updated.
                  </p>
                </div>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <h5 className="font-medium text-gray-900 mb-2">Affected Records ({affectedRecords.length})</h5>
                <div className="max-h-40 overflow-y-auto">
                  {affectedRecords.map((record, index) => (
                    <div key={index} className="text-sm text-gray-700 py-1">
                      {record}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <h5 className="font-medium text-yellow-800 mb-1">Important Notes:</h5>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Posted transactions will retain their original FX rates</li>
                  <li>• Only new transactions will use the updated rate</li>
                  <li>• This change will be logged in the audit trail</li>
                  <li>• Consider the impact on financial reporting</li>
                </ul>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={proceedWithRateChange}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                >
                  Proceed with Change
                </button>
                <button
                  onClick={() => {
                    setShowImpactWarning(false);
                    setPendingRateChange(null);
                    setAffectedRecords([]);
                  }}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* FX Rates Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Currency Pair
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Modified
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {fxRates.map((rate) => (
              <tr key={rate.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {rate.date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {rate.from_currency}/{rate.to_currency}
                  </div>
                  <div className="text-sm text-gray-500">
                    1 {rate.from_currency} = {rate.rate.toFixed(6)} {rate.to_currency}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {rate.rate.toFixed(6)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    rate.source === 'Manual' ? 'bg-blue-100 text-blue-800' :
                    rate.source === 'Bangladesh Bank' ? 'bg-green-100 text-green-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {rate.source}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(rate.modified_at).toLocaleDateString()}
                  {rate.modified_by && (
                    <div className="text-xs text-gray-400">
                      Modified by user
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => editRate(rate)}
                      className="text-blue-600 hover:text-blue-900 p-1"
                      title="Edit rate"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => copyRate(rate)}
                      className="text-green-600 hover:text-green-900 p-1"
                      title="Copy rate for new date"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setShowHistory(showHistory === rate.id ? null : rate.id)}
                      className="text-purple-600 hover:text-purple-900 p-1"
                      title="View history"
                    >
                      <History className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deactivateRate(rate.id)}
                      className="text-red-600 hover:text-red-900 p-1"
                      title="Deactivate rate"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {fxRates.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No FX rates found</h3>
          <p className="text-gray-500 mb-4">Add your first exchange rate to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add FX Rate
          </button>
        </div>
      )}

      {/* Rate Impact Warning */}
      {editingRate && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
            <div>
              <h4 className="text-sm font-medium text-yellow-800">
                Rate Modification Impact
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                Modifying this exchange rate will affect all transactions using {editingRate.from_currency} 
                on {editingRate.date}. This includes invoices, payments, and journal entries. 
                The change will be tracked in the audit trail.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}