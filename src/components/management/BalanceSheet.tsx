import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface BalanceSheetAccount {
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity';
  balance: number;
  bdt_balance: number;
  currency?: string;
}


interface UnrealizedFXItem {
  account: string;
  currency: string;
  original_amount: number;
  historical_rate: number;
  current_rate: number;
  gain_loss: number;
}

export function BalanceSheet() {
  const [balanceSheet, setBalanceSheet] = useState<{
    assets: BalanceSheetAccount[];
    liabilities: BalanceSheetAccount[];
    equity: BalanceSheetAccount[];
  }>({ assets: [], liabilities: [], equity: [] });
  const [unrealizedFX, setUnrealizedFX] = useState<UnrealizedFXItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [missingRates, setMissingRates] = useState<string[]>([]);
  const [rateInputs, setRateInputs] = useState<Record<string, string>>({});
  const [showFXModal, setShowFXModal] = useState(false);
  const [showVirtualJournal, setShowVirtualJournal] = useState(false);

  useEffect(() => {
    loadBalanceSheet();
  }, [asOfDate, loadBalanceSheet]);

  const loadBalanceSheet = async () => {
    setLoading(true);
    try {
      // Get all journal entry lines up to the specified date
      const { data: journalLines } = await supabase
        .from('journal_entry_lines')
        .select(`
          *,
          journal_entries!inner(date, status)
        `)
        .lte('journal_entries.date', asOfDate)
        .eq('journal_entries.status', 'posted');

      // Get chart of accounts
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .in('account_type', ['asset', 'liability', 'equity']);

      if (!journalLines || !accounts) return;

      // Calculate balances for each account
      const accountBalances = new Map<string, { debit: number; credit: number; bdtDebit: number; bdtCredit: number }>();

      journalLines.forEach(line => {
        const accountCode = line.account_code;
        if (!accountCode) return;

        const current = accountBalances.get(accountCode) || { debit: 0, credit: 0, bdtDebit: 0, bdtCredit: 0 };
        current.debit += line.debit_amount || 0;
        current.credit += line.credit_amount || 0;
        current.bdtDebit += line.bdt_debit_amount || line.debit_amount || 0;
        current.bdtCredit += line.bdt_credit_amount || line.credit_amount || 0;
        accountBalances.set(accountCode, current);
      });

      // Build balance sheet accounts
      const assets: BalanceSheetAccount[] = [];
      const liabilities: BalanceSheetAccount[] = [];
      const equity: BalanceSheetAccount[] = [];

      accounts.forEach(account => {
        const balance = accountBalances.get(account.account_code) || { debit: 0, credit: 0, bdtDebit: 0, bdtCredit: 0 };
        
        let netBalance = 0;
        let bdtNetBalance = 0;

        if (account.account_type === 'asset') {
          netBalance = balance.debit - balance.credit;
          bdtNetBalance = balance.bdtDebit - balance.bdtCredit;
        } else {
          netBalance = balance.credit - balance.debit;
          bdtNetBalance = balance.bdtCredit - balance.bdtDebit;
        }

        const balanceSheetAccount: BalanceSheetAccount = {
          account_code: account.account_code,
          account_name: account.account_name,
          account_type: account.account_type,
          balance: netBalance,
          bdt_balance: bdtNetBalance,
        };

        if (account.account_type === 'asset') {
          assets.push(balanceSheetAccount);
        } else if (account.account_type === 'liability') {
          liabilities.push(balanceSheetAccount);
        } else {
          equity.push(balanceSheetAccount);
        }
      });

      setBalanceSheet({ assets, liabilities, equity });

      // Calculate unrealized FX gains/losses
      await calculateUnrealizedFX();

    } catch (error) {
      console.error('Error loading balance sheet:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateUnrealizedFX = async () => {
    try {
      // Get foreign currency positions
      const { data: foreignInvoices } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          currency,
          total_amount,
          exchange_rate,
          customers!inner(customer_type)
        `)
        .neq('currency', 'BDT')
        .eq('status', 'sent')
        .eq('customers.customer_type', 'foreign');

      const unrealizedItems: UnrealizedFXItem[] = [];
      const missing: string[] = [];

      if (foreignInvoices) {
        for (const invoice of foreignInvoices) {
          // Get payment allocations
          const { data: allocations } = await supabase
            .from('payment_allocations')
            .select('allocated_amount')
            .eq('invoice_id', invoice.id);

          const totalAllocated = allocations?.reduce((sum, alloc) => sum + alloc.allocated_amount, 0) || 0;
          const remainingAmount = invoice.total_amount - totalAllocated;

          if (remainingAmount > 0.01) {
            // Get current FX rate
            const { data: currentRate } = await supabase
              .from('fx_rates')
              .select('rate')
              .eq('from_currency', invoice.currency)
              .eq('to_currency', 'BDT')
              .lte('date', asOfDate)
              .eq('is_active', true)
              .order('date', { ascending: false })
              .limit(1);

            if (currentRate?.[0] && invoice.exchange_rate) {
              const historicalValue = remainingAmount * invoice.exchange_rate;
              const currentValue = remainingAmount * currentRate[0].rate;
              const gainLoss = currentValue - historicalValue;

              unrealizedItems.push({
                account: `AR - ${invoice.invoice_number}`,
                currency: invoice.currency,
                original_amount: remainingAmount,
                historical_rate: invoice.exchange_rate,
                current_rate: currentRate[0].rate,
                gain_loss: gainLoss,
              });
            } else if (!currentRate?.[0]) {
              if (!missing.includes(invoice.currency)) {
                missing.push(invoice.currency);
              }
            }
          }
        }
      }

      setUnrealizedFX(unrealizedItems);
      setMissingRates(missing);
      if (missing.length > 0) {
        setShowFXModal(true);
      }

    } catch (error) {
      console.error('Error calculating unrealized FX:', error);
    }
  };

  const handleRateInput = (currency: string, rate: string) => {
    setRateInputs({ ...rateInputs, [currency]: rate });
  };

  const applyManualRates = async () => {
    try {
      // Insert manual rates
      for (const currency of missingRates) {
        if (rateInputs[currency]) {
          await supabase.from('fx_rates').insert({
            from_currency: currency,
            to_currency: 'BDT',
            rate: parseFloat(rateInputs[currency]),
            date: asOfDate,
            source: 'Manual',
          });
        }
      }

      setShowFXModal(false);
      setMissingRates([]);
      await calculateUnrealizedFX();
    } catch (error) {
      console.error('Error applying manual rates:', error);
    }
  };

  const exportToCSV = () => {
    const headers = ['Account Type', 'Account Code', 'Account Name', 'BDT Balance'];
    const rows: string[] = [];

    // Add assets
    balanceSheet.assets.forEach(account => {
      rows.push([
        'Asset',
        account.account_code,
        `"${account.account_name}"`,
        account.bdt_balance.toFixed(2)
      ].join(','));
    });

    // Add liabilities
    balanceSheet.liabilities.forEach(account => {
      rows.push([
        'Liability',
        account.account_code,
        `"${account.account_name}"`,
        account.bdt_balance.toFixed(2)
      ].join(','));
    });

    // Add equity
    balanceSheet.equity.forEach(account => {
      rows.push([
        'Equity',
        account.account_code,
        `"${account.account_name}"`,
        account.bdt_balance.toFixed(2)
      ].join(','));
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-sheet-${asOfDate}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const generateVirtualJournal = () => {
    const journalEntries: Array<{
      account: string;
      debit: number;
      credit: number;
      description: string;
    }> = [];

    let totalGain = 0;
    let totalLoss = 0;

    unrealizedFX.forEach(item => {
      if (Math.abs(item.gain_loss) > 0.01) {
        if (item.gain_loss > 0) {
          // Unrealized gain
          journalEntries.push({
            account: item.account,
            debit: item.gain_loss,
            credit: 0,
            description: `Unrealized FX gain on ${item.account}`,
          });
          totalGain += item.gain_loss;
        } else {
          // Unrealized loss
          journalEntries.push({
            account: item.account,
            debit: 0,
            credit: Math.abs(item.gain_loss),
            description: `Unrealized FX loss on ${item.account}`,
          });
          totalLoss += Math.abs(item.gain_loss);
        }
      }
    });

    // Add offsetting entries
    if (totalGain > 0) {
      journalEntries.push({
        account: 'Unrealized FX Gain',
        debit: 0,
        credit: totalGain,
        description: 'Unrealized foreign exchange gains',
      });
    }

    if (totalLoss > 0) {
      journalEntries.push({
        account: 'Unrealized FX Loss',
        debit: totalLoss,
        credit: 0,
        description: 'Unrealized foreign exchange losses',
      });
    }

    return journalEntries;
  };

  const virtualJournal = generateVirtualJournal();
  const totalAssets = balanceSheet.assets.reduce((sum, account) => sum + account.bdt_balance, 0);
  const totalLiabilities = balanceSheet.liabilities.reduce((sum, account) => sum + account.bdt_balance, 0);
  const totalEquity = balanceSheet.equity.reduce((sum, account) => sum + account.bdt_balance, 0);
  const totalUnrealizedFX = unrealizedFX.reduce((sum, item) => sum + item.gain_loss, 0);

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
          <BarChart3 className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Balance Sheet</h2>
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
          <h3 className="text-lg font-semibold text-blue-900">Total Assets</h3>
          <p className="text-2xl font-bold text-blue-600">BDT {totalAssets.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-red-900">Total Liabilities</h3>
          <p className="text-2xl font-bold text-red-600">BDT {totalLiabilities.toLocaleString()}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-purple-900">Total Equity</h3>
          <p className="text-2xl font-bold text-purple-600">BDT {totalEquity.toLocaleString()}</p>
        </div>
        <div className={`p-4 rounded-lg ${
          totalUnrealizedFX > 0 ? 'bg-green-50' : totalUnrealizedFX < 0 ? 'bg-red-50' : 'bg-gray-50'
        }`}>
          <h3 className={`text-lg font-semibold ${
            totalUnrealizedFX > 0 ? 'text-green-900' : totalUnrealizedFX < 0 ? 'text-red-900' : 'text-gray-900'
          }`}>
            Unrealized FX
          </h3>
          <p className={`text-2xl font-bold ${
            totalUnrealizedFX > 0 ? 'text-green-600' : totalUnrealizedFX < 0 ? 'text-red-600' : 'text-gray-600'
          }`}>
            BDT {Math.abs(totalUnrealizedFX).toLocaleString()}
            {totalUnrealizedFX !== 0 && (
              <span className="text-sm ml-1">
                {totalUnrealizedFX > 0 ? '(Gain)' : '(Loss)'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Balance Sheet */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-blue-50 border-b">
            <h3 className="text-lg font-semibold text-blue-900">Assets</h3>
          </div>
          <div className="p-6">
            <div className="space-y-3">
              {balanceSheet.assets.map((account) => (
                <div key={account.account_code} className="flex justify-between items-center">
                  <div>
                    <span className="font-medium text-gray-900">{account.account_name}</span>
                    <span className="text-sm text-gray-500 ml-2">({account.account_code})</span>
                  </div>
                  <span className="font-medium text-gray-900">
                    BDT {account.bdt_balance.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="border-t pt-3 mt-3">
                <div className="flex justify-between items-center font-bold text-lg">
                  <span>Total Assets</span>
                  <span>BDT {totalAssets.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Liabilities & Equity */}
        <div className="space-y-6">
          {/* Liabilities */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-red-50 border-b">
              <h3 className="text-lg font-semibold text-red-900">Liabilities</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {balanceSheet.liabilities.map((account) => (
                  <div key={account.account_code} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-gray-900">{account.account_name}</span>
                      <span className="text-sm text-gray-500 ml-2">({account.account_code})</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      BDT {account.bdt_balance.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center font-bold">
                    <span>Total Liabilities</span>
                    <span>BDT {totalLiabilities.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Equity */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-purple-50 border-b">
              <h3 className="text-lg font-semibold text-purple-900">Equity</h3>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {balanceSheet.equity.map((account) => (
                  <div key={account.account_code} className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-gray-900">{account.account_name}</span>
                      <span className="text-sm text-gray-500 ml-2">({account.account_code})</span>
                    </div>
                    <span className="font-medium text-gray-900">
                      BDT {account.bdt_balance.toLocaleString()}
                    </span>
                  </div>
                ))}
                <div className="border-t pt-3 mt-3">
                  <div className="flex justify-between items-center font-bold">
                    <span>Total Equity</span>
                    <span>BDT {totalEquity.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unrealized FX Section */}
      {unrealizedFX.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-yellow-50 border-b flex justify-between items-center">
            <h3 className="text-lg font-semibold text-yellow-900">Unrealized Foreign Exchange Gains/Losses</h3>
            <button
              onClick={() => setShowVirtualJournal(!showVirtualJournal)}
              className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
            >
              {showVirtualJournal ? 'Hide' : 'Show'} Virtual Journal
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Currency
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
                    Gain/Loss
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unrealizedFX.map((item, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.account}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {item.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.original_amount.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.historical_rate.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {item.current_rate.toFixed(4)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                      <span className={`font-medium ${
                        item.gain_loss > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        BDT {Math.abs(item.gain_loss).toLocaleString()}
                        {item.gain_loss > 0 ? ' (G)' : ' (L)'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Virtual Journal */}
      {showVirtualJournal && virtualJournal.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b">
            <h3 className="text-lg font-semibold">Virtual Journal Entry (Non-Posting)</h3>
            <p className="text-sm text-gray-600">This entry shows the impact of FX rate changes but does not affect your books.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Account
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
                      {entry.account}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {entry.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {entry.debit > 0 ? entry.debit.toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                      {entry.credit > 0 ? entry.credit.toLocaleString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FX Rate Input Modal */}
      {showFXModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 bg-yellow-50 border-b">
              <h3 className="text-lg font-semibold text-yellow-900">Missing Exchange Rates</h3>
            </div>
            <div className="p-6">
              <p className="text-gray-600 mb-4">
                Please provide exchange rates for {asOfDate} to calculate unrealized FX gains/losses:
              </p>
              <div className="space-y-4">
                {missingRates.map(currency => (
                  <div key={currency}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {currency} to BDT Rate
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      value={rateInputs[currency] || ''}
                      onChange={(e) => handleRateInput(currency, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500"
                      placeholder={`Enter ${currency} rate`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={applyManualRates}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
                  disabled={missingRates.some(currency => !rateInputs[currency])}
                >
                  Apply Rates
                </button>
                <button
                  onClick={() => setShowFXModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  Skip
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Important Notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 mr-3" />
          <div>
            <h4 className="text-sm font-medium text-blue-800">
              Balance Sheet Information
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              All amounts are shown in BDT. Unrealized FX gains/losses are calculated for informational purposes only and do not affect your accounting records. The virtual journal entry is provided for reference and will not be posted to your books.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}