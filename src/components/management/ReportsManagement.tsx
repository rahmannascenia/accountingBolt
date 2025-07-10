import React, { useState, useEffect } from 'react';
import { PieChart, TrendingUp, FileText, Calculator } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ReportData {
  revenue: Record<string, number>;
  expenses: Record<string, number>;
  totalRevenue: number;
  totalExpenses: number;
  netIncome: number;
  period: string;
}

interface TaxReportData {
  localInvoices: any[];
  exportInvoices: any[];
  totalTDS: number;
  totalVDS: number;
  totalVAT: number;
  totalExportRevenue: number;
  period: string;
}

export function ReportsManagement() {
  const [activeReport, setActiveReport] = useState('income');
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
    endDate: new Date().toISOString().split('T')[0], // Today
  });

  const [incomeStatement, setIncomeStatement] = useState<ReportData | null>(null);
  const [taxReport, setTaxReport] = useState<TaxReportData | null>(null);

  const reports = [
    { id: 'income', label: 'Income Statement', icon: TrendingUp },
    { id: 'tax', label: 'Tax Report', icon: Calculator },
  ];

  useEffect(() => {
    if (activeReport === 'income') {
      loadIncomeStatement();
    } else if (activeReport === 'tax') {
      loadTaxReport();
    }
  }, [activeReport, dateRange]);

  const loadIncomeStatement = async () => {
    setLoading(true);
    try {
      // Get invoices in date range
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          *,
          customers!inner(customer_type)
        `)
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate)
        .eq('status', 'sent');

      // Get expenses in date range
      const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate)
        .eq('status', 'paid');

      // Calculate revenue by type
      const revenue: Record<string, number> = {};
      let totalRevenue = 0;

      if (invoices) {
        invoices.forEach(invoice => {
          const isLocal = (invoice.customers as any)?.customer_type === 'local';
          const category = isLocal ? 'Local Services Revenue' : 'Export Services Revenue';
          revenue[category] = (revenue[category] || 0) + invoice.total_amount;
          totalRevenue += invoice.total_amount;
        });
      }

      // Calculate expenses by category
      const expensesByCategory: Record<string, number> = {};
      let totalExpenses = 0;

      if (expenses) {
        expenses.forEach(expense => {
          expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
          totalExpenses += expense.amount;
        });
      }

      const netIncome = totalRevenue - totalExpenses;

      setIncomeStatement({
        revenue,
        expenses: expensesByCategory,
        totalRevenue,
        totalExpenses,
        netIncome,
        period: `${dateRange.startDate} to ${dateRange.endDate}`,
      });
    } catch (error) {
      console.error('Error loading income statement:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTaxReport = async () => {
    setLoading(true);
    try {
      // Get all invoices in the period with customer details
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          *,
          customers!inner(name, customer_type)
        `)
        .gte('date', dateRange.startDate)
        .lte('date', dateRange.endDate)
        .neq('status', 'cancelled');

      if (invoices) {
        const localInvoices = invoices.filter(inv => (inv.customers as any)?.customer_type === 'local');
        const exportInvoices = invoices.filter(inv => (inv.customers as any)?.customer_type === 'foreign');

        const totalTDS = localInvoices.reduce((sum, inv) => sum + (inv.tds_amount || 0), 0);
        const totalVDS = localInvoices.reduce((sum, inv) => sum + (inv.vds_amount || 0), 0);
        const totalVAT = localInvoices.reduce((sum, inv) => sum + (inv.vat_amount || 0), 0);
        const totalExportRevenue = exportInvoices.reduce((sum, inv) => sum + inv.total_amount, 0);

        setTaxReport({
          localInvoices,
          exportInvoices,
          totalTDS,
          totalVDS,
          totalVAT,
          totalExportRevenue,
          period: `${dateRange.startDate} to ${dateRange.endDate}`,
        });
      }
    } catch (error) {
      console.error('Error loading tax report:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <PieChart className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Financial Reports</h2>
        </div>
      </div>

      {/* Report Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {reports.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.id}
                onClick={() => setActiveReport(report.id)}
                className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeReport === report.id
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{report.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Date Range Selector */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Report Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {activeReport === 'income' && incomeStatement && (
              <div>
                <h3 className="text-xl font-bold mb-4">Income Statement</h3>
                <p className="text-gray-600 mb-6">{incomeStatement.period}</p>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-green-700 mb-3">Revenue</h4>
                    <div className="space-y-2">
                      {Object.entries(incomeStatement.revenue).map(([account, amount]) => (
                        <div key={account} className="flex justify-between">
                          <span>{account}</span>
                          <span className="font-medium">{amount.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Total Revenue</span>
                        <span>{incomeStatement.totalRevenue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-red-700 mb-3">Expenses</h4>
                    <div className="space-y-2">
                      {Object.entries(incomeStatement.expenses).map(([account, amount]) => (
                        <div key={account} className="flex justify-between">
                          <span>{account}</span>
                          <span className="font-medium">{amount.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Total Expenses</span>
                        <span>{incomeStatement.totalExpenses.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t-2 pt-4">
                    <div className={`flex justify-between text-xl font-bold ${
                      incomeStatement.netIncome >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      <span>Net Income</span>
                      <span>{incomeStatement.netIncome.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeReport === 'tax' && taxReport && (
              <div>
                <h3 className="text-xl font-bold mb-4">Tax Report</h3>
                <p className="text-gray-600 mb-6">{taxReport.period}</p>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div>
                    <h4 className="text-lg font-semibold text-blue-700 mb-3">Local Transactions</h4>
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded">
                        <div className="flex justify-between mb-2">
                          <span>Total TDS Deducted</span>
                          <span className="font-bold">BDT {taxReport.totalTDS.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                          <span>Total VDS Deducted</span>
                          <span className="font-bold">BDT {taxReport.totalVDS.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total VAT Collected</span>
                          <span className="font-bold">BDT {taxReport.totalVAT.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-medium mb-2">Local Invoices ({taxReport.localInvoices.length})</h5>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {taxReport.localInvoices.map((invoice) => (
                            <div key={invoice.id} className="text-sm flex justify-between">
                              <span>{invoice.invoice_number}</span>
                              <span>BDT {invoice.total_amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-lg font-semibold text-green-700 mb-3">Export Transactions</h4>
                    <div className="space-y-4">
                      <div className="bg-gray-50 p-4 rounded">
                        <div className="flex justify-between">
                          <span>Total Export Revenue</span>
                          <span className="font-bold">USD {taxReport.totalExportRevenue.toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <div>
                        <h5 className="font-medium mb-2">Export Invoices ({taxReport.exportInvoices.length})</h5>
                        <div className="max-h-40 overflow-y-auto space-y-1">
                          {taxReport.exportInvoices.map((invoice) => (
                            <div key={invoice.id} className="text-sm flex justify-between">
                              <span>{invoice.invoice_number}</span>
                              <span>{invoice.currency} {invoice.total_amount.toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}