import React, { useState, useEffect } from 'react';
import { Users, Calendar, FileText, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ARBreakdownItem {
  id: string;
  customer_name: string;
  invoice_number: string;
  currency: string;
  original_amount: number;
  bdt_converted_amount: number;
  due_date: string;
  status: 'Open' | 'Overdue' | 'Partially Paid';
  days_overdue: number;
  remaining_amount: number;
}

export function AccountsReceivableBreakdown() {
  const [arItems, setArItems] = useState<ARBreakdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [filters, setFilters] = useState({
    customer: '',
    currency: '',
    status: '',
  });

  useEffect(() => {
    loadARBreakdown();
  }, [asOfDate, loadARBreakdown]);

  const loadARBreakdown = async () => {
    setLoading(true);
    try {
      // Get all outstanding invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          currency,
          total_amount,
          due_date,
          exchange_rate,
          bdt_amount,
          customers!inner(name)
        `)
        .eq('status', 'sent')
        .lte('date', asOfDate);

      if (!invoices) return;

      const arBreakdown: ARBreakdownItem[] = [];

      for (const invoice of invoices) {
        // Get payment allocations
        const { data: allocations } = await supabase
          .from('payment_allocations')
          .select('allocated_amount')
          .eq('invoice_id', invoice.id);

        const totalAllocated = allocations?.reduce((sum, alloc) => sum + alloc.allocated_amount, 0) || 0;
        const remainingAmount = invoice.total_amount - totalAllocated;

        if (remainingAmount > 0.01) {
          // Calculate BDT amount
          let bdtAmount = remainingAmount;
          if (invoice.currency !== 'BDT' && invoice.exchange_rate) {
            bdtAmount = remainingAmount * invoice.exchange_rate;
          } else if (invoice.currency !== 'BDT') {
            // Get current FX rate
            const { data: fxRate } = await supabase
              .from('fx_rates')
              .select('rate')
              .eq('from_currency', invoice.currency)
              .eq('to_currency', 'BDT')
              .lte('date', asOfDate)
              .eq('is_active', true)
              .order('date', { ascending: false })
              .limit(1);

            if (fxRate?.[0]) {
              bdtAmount = remainingAmount * fxRate[0].rate;
            }
          }

          // Calculate status
          const dueDate = new Date(invoice.due_date);
          const currentDate = new Date(asOfDate);
          const daysOverdue = Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          let status: 'Open' | 'Overdue' | 'Partially Paid' = 'Open';
          if (totalAllocated > 0) {
            status = 'Partially Paid';
          } else if (daysOverdue > 0) {
            status = 'Overdue';
          }

          arBreakdown.push({
            id: invoice.id,
            customer_name: (invoice.customers as { name: string })?.name || 'Unknown',
            invoice_number: invoice.invoice_number,
            currency: invoice.currency,
            original_amount: remainingAmount,
            bdt_converted_amount: bdtAmount,
            due_date: invoice.due_date,
            status,
            days_overdue: Math.max(0, daysOverdue),
            remaining_amount: remainingAmount,
          });
        }
      }

      setArItems(arBreakdown);
    } catch (error) {
      console.error('Error loading AR breakdown:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Customer Name',
      'Invoice Number',
      'Currency',
      'Original Amount',
      'BDT Converted Amount',
      'Due Date',
      'Status',
      'Days Overdue'
    ];

    const csvContent = [
      headers.join(','),
      ...filteredItems.map(item => [
        `"${item.customer_name}"`,
        item.invoice_number,
        item.currency,
        item.original_amount.toFixed(2),
        item.bdt_converted_amount.toFixed(2),
        item.due_date,
        item.status,
        item.days_overdue
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accounts-receivable-${asOfDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Filter items
  const filteredItems = arItems.filter(item => {
    if (filters.customer && !item.customer_name.toLowerCase().includes(filters.customer.toLowerCase())) return false;
    if (filters.currency && item.currency !== filters.currency) return false;
    if (filters.status && item.status !== filters.status) return false;
    return true;
  });

  const totalBDT = filteredItems.reduce((sum, item) => sum + item.bdt_converted_amount, 0);
  const currencies = [...new Set(arItems.map(item => item.currency))];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
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
          <Users className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Accounts Receivable Breakdown</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900">Total Outstanding</h3>
          <p className="text-2xl font-bold text-blue-600">BDT {totalBDT.toLocaleString()}</p>
          <p className="text-sm text-blue-700">{filteredItems.length} invoices</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900">Overdue</h3>
          <p className="text-2xl font-bold text-red-600">
            {filteredItems.filter(item => item.status === 'Overdue').length}
          </p>
          <p className="text-sm text-red-700">
            BDT {filteredItems.filter(item => item.status === 'Overdue')
              .reduce((sum, item) => sum + item.bdt_converted_amount, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-900">Partially Paid</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {filteredItems.filter(item => item.status === 'Partially Paid').length}
          </p>
          <p className="text-sm text-yellow-700">
            BDT {filteredItems.filter(item => item.status === 'Partially Paid')
              .reduce((sum, item) => sum + item.bdt_converted_amount, 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-900">Current</h3>
          <p className="text-2xl font-bold text-green-600">
            {filteredItems.filter(item => item.status === 'Open').length}
          </p>
          <p className="text-sm text-green-700">
            BDT {filteredItems.filter(item => item.status === 'Open')
              .reduce((sum, item) => sum + item.bdt_converted_amount, 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <input
              type="text"
              value={filters.customer}
              onChange={(e) => setFilters({ ...filters, customer: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search customers..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
            <select
              value={filters.currency}
              onChange={(e) => setFilters({ ...filters, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Currencies</option>
              {currencies.map((currency) => (
                <option key={currency} value={currency}>{currency}</option>
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
              <option value="Open">Open</option>
              <option value="Overdue">Overdue</option>
              <option value="Partially Paid">Partially Paid</option>
            </select>
          </div>
        </div>
      </div>

      {/* AR Breakdown Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold">Accounts Receivable as of {asOfDate}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Currency
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Original Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  BDT Converted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.customer_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.invoice_number}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {item.original_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-gray-900">
                    {item.bdt_converted_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {item.due_date}
                    {item.days_overdue > 0 && (
                      <div className="text-xs text-red-600">
                        {item.days_overdue} days overdue
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      item.status === 'Open' ? 'bg-green-100 text-green-800' :
                      item.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-100">
              <tr>
                <td colSpan={4} className="px-6 py-3 text-sm font-medium text-gray-900">
                  Total Outstanding
                </td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                  BDT {totalBDT.toLocaleString()}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No outstanding receivables</h3>
          <p className="text-gray-500">All invoices have been fully paid as of {asOfDate}.</p>
        </div>
      )}
    </div>
  );
}