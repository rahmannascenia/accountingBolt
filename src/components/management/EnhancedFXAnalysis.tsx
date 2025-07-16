import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Calculator, AlertCircle, Download, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ForeignPosition {
  id: string;
  source_type: 'invoice' | 'payment' | 'bank_account';
  source_reference: string;
  currency: string;
  original_amount: number;
  historical_rate: number;
  historical_bdt_value: number;
  current_rate: number | null;
  current_bdt_value: number | null;
  unrealized_gain_loss: number | null;
  as_of_date: string;
}

interface VirtualJournalEntry {
  account_code: string;
  account_name: string;
  debit_amount: number;
  credit_amount: number;
  description: string;
  currency: string;
  fx_impact: number;
}

interface MissingRate {
  currency: string;
  positions_count: number;
  total_amount: number;
}

export function EnhancedFXAnalysis() {
  const [positions, setPositions] = useState<ForeignPosition[]>([]);
  const [virtualJournal, setVirtualJournal] = useState<VirtualJournalEntry[]>([]);
  const [missingRates, setMissingRates] = useState<MissingRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [showVirtualJournal, setShowVirtualJournal] = useState(false);
  const [showRateModal, setShowRateModal] = useState(false);

  useEffect(() => {
    loadFXAnalysis();
  }, [asOfDate, loadFXAnalysis]);

  const loadFXAnalysis = async () => {
    setLoading(true);
    try {
      // Get foreign currency positions from various sources
      const foreignPositions: ForeignPosition[] = [];
      
      // 1. Outstanding invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          currency,
          total_amount,
          exchange_rate,
          date,
          customers!inner(customer_type)
        `)
        .neq('currency', 'BDT')
        .eq('status', 'sent')
        .eq('customers.customer_type', 'foreign')
        .lte('date', asOfDate);

      if (invoices) {
        for (const invoice of invoices) {
          // Get payment allocations
          const { data: allocations } = await supabase
            .from('payment_allocations')
            .select('allocated_amount')
            .eq('invoice_id', invoice.id);

          const totalAllocated = allocations?.reduce((sum, alloc) => sum + alloc.allocated_amount, 0) || 0;
          const remainingAmount = invoice.total_amount - totalAllocated;

          if (remainingAmount > 0.01) {
            // Get current FX rate
            const currentRate = await getCurrentFXRate(invoice.currency, asOfDate);
            
            const historicalRate = invoice.exchange_rate || 0;
            const historicalBdtValue = remainingAmount * historicalRate;
            const currentBdtValue = currentRate ? remainingAmount * currentRate : null;
            const unrealizedGainLoss = currentBdtValue ? currentBdtValue - historicalBdtValue : null;

            foreignPositions.push({
              id: invoice.id,
              source_type: 'invoice',
              source_reference: invoice.invoice_number,
              currency: invoice.currency,
              original_amount: remainingAmount,
              historical_rate: historicalRate,
              historical_bdt_value: historicalBdtValue,
              current_rate: currentRate,
              current_bdt_value: currentBdtValue,
              unrealized_gain_loss: unrealizedGainLoss,
              as_of_date: asOfDate,
            });
          }
        }
      }

      // 2. Foreign currency bank balances
      const { data: bankAccounts } = await supabase
        .from('bank_accounts')
        .select('*')
        .neq('currency', 'BDT')
        .eq('is_active', true);

      if (bankAccounts) {
        for (const account of bankAccounts) {
          if (account.balance > 0.01) {
            const currentRate = await getCurrentFXRate(account.currency, asOfDate);
            
            // For bank accounts, use a reference rate (could be from account opening or last valuation)
            const referenceRate = currentRate || 1.0; // Simplified for demo
            const currentBdtValue = currentRate ? account.balance * currentRate : null;

            foreignPositions.push({
              id: account.id,
              source_type: 'bank_account',
              source_reference: account.name,
              currency: account.currency,
              original_amount: account.balance,
              historical_rate: referenceRate,
              historical_bdt_value: account.balance * referenceRate,
              current_rate: currentRate,
              current_bdt_value: currentBdtValue,
              unrealized_gain_loss: 0, // Bank accounts don't have unrealized gains in this context
              as_of_date: asOfDate,
            });
          }
        }
      }

      setPositions(foreignPositions);

      // Identify missing rates
      const missing = identifyMissingRates(foreignPositions);
      setMissingRates(missing);

      if (missing.length > 0) {
        setShowRateModal(true);
      } else {
        generateVirtualJournal(foreignPositions);
      }

    } catch (error) {
      console.error('Error loading FX analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentFXRate = async (currency: string, date: string): Promise<number | null> => {
    try {
      const { data } = await supabase
        .from('fx_rates')
        .select('rate')
        .eq('from_currency', currency)
        .eq('to_currency', 'BDT')
        .lte('date', date)
        .eq('is_active', true)
        .order('date', { ascending: false })
        .limit(1);

      return data?.[0]?.rate || null;
    } catch (error) {
      console.error('Error fetching FX rate:', error);
      return null;
    }
  };

  const identifyMissingRates = (positions: ForeignPosition[]): MissingRate[] => {
    const missingByCurrency = new Map<string, { count: number; total: number }>();

    positions.forEach(position => {
      if (position.current_rate === null) {
        const existing = missingByCurrency.get(position.currency) || { count: 0, total: 0 };
        existing.count += 1;
        existing.total += position.original_amount;
        missingByCurrency.set(position.currency, existing);
      }
    });

    return Array.from(missingByCurrency.entries()).map(([currency, data]) => ({
      currency,
      positions_count: data.count,
      total_amount: data.total,
    }));
  };

  const applyManualRates = async () => {
    try {
      // Insert manual rates into fx_rates table
      for (const missing of missingRates) {
        if (rateInputs[missing.currency]) {
          await supabase.from('fx_rates').insert({
            from_currency: missing.currency,
            to_currency: 'BDT',
            rate: parseFloat(rateInputs[missing.currency]),
            date: asOfDate,
            source: 'Manual - FX Analysis',
            notes: `Manual rate input for FX analysis on ${asOfDate}`,
          });
        }
      }

      setShowRateModal(false);
      setMissingRates([]);
      await loadFXAnalysis(); // Reload with new rates
    } catch (error) {
      console.error('Error applying manual rates:', error);
    }
  };

  const generateVirtualJournal = (positions: ForeignPosition[]) => {
    const journalEntries: VirtualJournalEntry[] = [];
    let totalGain = 0;
    let totalLoss = 0;

    positions.forEach(position => {
      if (position.unrealized_gain_loss && Math.abs(position.unrealized_gain_loss) > 0.01) {
        const accountCode = position.source_type === 'invoice' ? '1400' : '1200';
        const accountName = position.source_type === 'invoice' ? 'AR - Foreign Customers' : 'Bank - Foreign Currency';

        if (position.unrealized_gain_loss > 0) {
          // Unrealized gain
          journalEntries.push({
            account_code: accountCode,
            account_name: accountName,
            debit_amount: position.unrealized_gain_loss,
            credit_amount: 0,
            description: `Unrealized FX gain on ${position.source_reference}`,
            currency: position.currency,
            fx_impact: position.unrealized_gain_loss,
          });
          totalGain += position.unrealized_gain_loss;
        } else {
          // Unrealized loss
          journalEntries.push({
            account_code: accountCode,
            account_name: accountName,
            debit_amount: 0,
            credit_amount: Math.abs(position.unrealized_gain_loss),
            description: `Unrealized FX loss on ${position.source_reference}`,
            currency: position.currency,
            fx_impact: position.unrealized_gain_loss,
          });
          totalLoss += Math.abs(position.unrealized_gain_loss);
        }
      }
    });

    // Add offsetting entries
    if (totalGain > 0) {
      journalEntries.push({
        account_code: '4300',
        account_name: 'Unrealized FX Gain',
        debit_amount: 0,
        credit_amount: totalGain,
        description: 'Unrealized foreign exchange gains',
        currency: 'BDT',
        fx_impact: totalGain,
      });
    }

    if (totalLoss > 0) {
      journalEntries.push({
        account_code: '5700',
        account_name: 'Unrealized FX Loss',
        debit_amount: totalLoss,
        credit_amount: 0,
        description: 'Unrealized foreign exchange losses',
        currency: 'BDT',
        fx_impact: -totalLoss,
      });
    }

    setVirtualJournal(journalEntries);
  };

  const exportAnalysis = () => {
    const headers = [
      'Source Type',
      'Reference',
      'Currency',
      'Original Amount',
      'Historical Rate',
      'Current Rate',
      'Historical BDT Value',
      'Current BDT Value',
      'Unrealized Gain/Loss'
    ];

    const csvContent = [
      headers.join(','),
      ...positions.map(pos => [
        pos.source_type,
        `"${pos.source_reference}"`,
        pos.currency,
        pos.original_amount.toFixed(2),
        pos.historical_rate.toFixed(6),
        pos.current_rate?.toFixed(6) || 'N/A',
        pos.historical_bdt_value.toFixed(2),
        pos.current_bdt_value?.toFixed(2) || 'N/A',
        pos.unrealized_gain_loss?.toFixed(2) || 'N/A'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fx-analysis-${asOfDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalUnrealizedGainLoss = positions.reduce((sum, pos) => sum + (pos.unrealized_gain_loss || 0), 0);

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
          <h2 className="text-2xl font-bold text-gray-900">Enhanced FX Analysis</h2>
        </div>
        <div className="flex items-center space-x-4">
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={exportAnalysis}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className={`p-4 rounded-lg ${
          totalUnrealizedGainLoss > 0 ? 'bg-green-50' : 
          totalUnrealizedGainLoss < 0 ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-lg font-semibold ${
                totalUnrealizedGainLoss > 0 ? 'text-green-900' : 
                totalUnrealizedGainLoss < 0 ? 'text-red-900' : 'text-gray-900'
              }`}>
                Net Unrealized Gain/Loss
              </h3>
              <p className={`text-2xl font-bold ${
                totalUnrealizedGainLoss > 0 ? 'text-green-600' : 
                totalUnrealizedGainLoss < 0 ? 'text-red-600' : 'text-gray-600'
              }`}>
                BDT {Math.abs(totalUnrealizedGainLoss).toLocaleString()}
                {totalUnrealizedGainLoss !== 0 && (
                  <span className="text-sm ml-1">
                    {totalUnrealizedGainLoss > 0 ? '(Gain)' : '(Loss)'}
                  </span>
                )}
              </p>
            </div>
            {totalUnrealizedGainLoss > 0 ? (
              <TrendingUp className="h-8 w-8 text-green-600" />
            ) : totalUnrealizedGainLoss < 0 ? (
              <TrendingDown className="h-8 w-8 text-red-600" />
            ) : (
              <Calculator className="h-8 w-8 text-gray-600" />
            )}
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900">Total Positions</h3>
          <p className="text-2xl font-bold text-blue-600">{positions.length}</p>
          <p className="text-sm text-blue-700">Foreign currency exposures</p>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-900">Currencies</h3>
          <p className="text-2xl font-bold text-purple-600">
            {[...new Set(positions.map(p => p.currency))].length}
          </p>
          <p className="text-sm text-purple-700">Different currencies</p>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-yellow-900">Missing Rates</h3>
          <p className="text-2xl font-bold text-yellow-600">{missingRates.length}</p>
          <p className="text-sm text-yellow-700">Need manual input</p>
        </div>
      </div>

      {/* FX Positions Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
          <h3 className="text-lg font-semibold">Foreign Currency Positions as of {asOfDate}</h3>
          {virtualJournal.length > 0 && (
            <button
              onClick={() => setShowVirtualJournal(!showVirtualJournal)}
              className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              <Eye className="h-4 w-4" />
              <span>{showVirtualJournal ? 'Hide' : 'Show'} Virtual Journal</span>
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Historical Rate
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Rate
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Historical BDT
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current BDT
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Gain/Loss
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {positions.map((position) => (
                <tr key={position.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      position.source_type === 'invoice' ? 'bg-blue-100 text-blue-800' :
                      position.source_type === 'payment' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {position.source_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {position.source_reference}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {position.currency} {position.original_amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {position.historical_rate.toFixed(6)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {position.current_rate ? position.current_rate.toFixed(6) : 
                     <span className="text-red-600">Missing</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    BDT {position.historical_bdt_value.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                    {position.current_bdt_value ? 
                     `BDT ${position.current_bdt_value.toLocaleString()}` : 
                     <span className="text-gray-400">N/A</span>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {position.unrealized_gain_loss !== null ? (
                      <span className={`font-medium ${
                        position.unrealized_gain_loss > 0 ? 'text-green-600' : 
                        position.unrealized_gain_loss < 0 ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        BDT {Math.abs(position.unrealized_gain_loss).toLocaleString()}
                        {position.unrealized_gain_loss !== 0 && (
                          <span className="text-xs ml-1">
                            {position.unrealized_gain_loss > 0 ? '(G)' : '(L)'}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-400">N/A</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Virtual Journal Preview */}
      {showVirtualJournal && virtualJournal.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-yellow-50 border-b">
            <h3 className="text-lg font-semibold text-yellow-900">Virtual Journal Entry (Non-Posting)</h3>
            <p className="text-sm text-yellow-700 mt-1">
              This preview shows the accounting impact of FX rate changes. This entry is not posted to your books.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debit
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {virtualJournal.map((entry, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {entry.account_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {entry.account_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {entry.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {entry.debit_amount > 0 ? entry.debit_amount.toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {entry.credit_amount > 0 ? entry.credit_amount.toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-100">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-sm font-medium text-gray-900">
                    TOTALS
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                    {virtualJournal.reduce((sum, entry) => sum + entry.debit_amount, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-bold text-gray-900">
                    {virtualJournal.reduce((sum, entry) => sum + entry.credit_amount, 0).toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Missing Rates Modal */}
      {showRateModal && missingRates.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4">
            <div className="px-6 py-4 bg-yellow-50 border-b">
              <h3 className="text-lg font-semibold text-yellow-900">Missing Exchange Rates</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Please provide exchange rates for {asOfDate} to complete the FX analysis:
              </p>
              <div className="space-y-4">
                {missingRates.map(missing => (
                  <div key={missing.currency} className="border rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-medium">{missing.currency} to BDT</h4>
                      <span className="text-sm text-gray-500">
                        {missing.positions_count} positions, {missing.currency} {missing.total_amount.toLocaleString()}
                      </span>
                    </div>
                    <input
                      type="number"
                      step="0.000001"
                      value={rateInputs[missing.currency] || ''}
                      onChange={(e) => setRateInputs({ ...rateInputs, [missing.currency]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder={`Enter ${missing.currency} to BDT rate`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={applyManualRates}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
                  disabled={missingRates.some(missing => !rateInputs[missing.currency])}
                >
                  Apply Rates & Analyze
                </button>
                <button
                  onClick={() => setShowRateModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  Skip Analysis
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">
              Enhanced FX Analysis
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              This analysis shows unrealized foreign exchange gains and losses based on current vs. historical rates. 
              The virtual journal entry is for informational purposes only and does not affect your accounting records. 
              Missing rates can be input manually to complete the analysis.
            </p>
          </div>
        </div>
      </div>

      {positions.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No foreign currency positions</h3>
          <p className="text-gray-500 mb-4">
            No foreign currency exposures found for the selected date.
          </p>
        </div>
      )}
    </div>
  );
}