import React, { useState, useEffect } from 'react';
import { BarChart3, Calendar, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface TrialBalanceAccount {
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  level: number;
  parent_account_id: string | null;
  debit_balance: number;
  credit_balance: number;
  net_balance: number;
  children?: TrialBalanceAccount[];
}

interface AccountLedger {
  id: string;
  date: string;
  description: string;
  reference: string | null;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  source_document_type: string | null;
  source_document_id: string | null;
}

export function TrialBalance() {
  const [trialBalance, setTrialBalance] = useState<TrialBalanceAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<TrialBalanceAccount | null>(null);
  const [accountLedger, setAccountLedger] = useState<AccountLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [filters, setFilters] = useState({
    accountType: '',
    showZeroBalances: false,
    currency: '',
    dateRange: {
      start: '',
      end: '',
    }
  });

  useEffect(() => {
    loadTrialBalance();
  }, [asOfDate, loadTrialBalance]);

  const loadTrialBalance = async () => {
    setLoading(true);
    try {
      // Get all chart of accounts
      const { data: accounts } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .eq('is_active', true)
        .order('account_code');

      if (!accounts) return;

      // Get all journal entry lines up to the specified date
      const { data: journalLines } = await supabase
        .from('journal_entry_lines')
        .select(`
          *,
          journal_entries!inner(date, status)
        `)
        .lte('journal_entries.date', asOfDate)
        .eq('journal_entries.status', 'posted');

      // Calculate balances for each account
      const accountBalances = new Map<string, { debit: number; credit: number }>();

      journalLines?.forEach(line => {
        const accountCode = line.account_code;
        if (!accountCode) return;

        const current = accountBalances.get(accountCode) || { debit: 0, credit: 0 };
        current.debit += line.bdt_debit_amount || line.debit_amount || 0;
        current.credit += line.bdt_credit_amount || line.credit_amount || 0;
        accountBalances.set(accountCode, current);
      });

      // Build trial balance with hierarchy
      const trialBalanceData: TrialBalanceAccount[] = accounts.map(account => {
        const balance = accountBalances.get(account.account_code) || { debit: 0, credit: 0 };
        const debitBalance = balance.debit;
        const creditBalance = balance.credit;
        
        // Calculate net balance based on account type
        let netBalance = 0;
        if (['asset', 'expense'].includes(account.account_type)) {
          netBalance = debitBalance - creditBalance;
        } else {
          netBalance = creditBalance - debitBalance;
        }

        return {
          account_code: account.account_code,
          account_name: account.account_name,
          account_type: account.account_type,
          level: account.level || 1,
          parent_account_id: account.parent_account_id,
          debit_balance: debitBalance,
          credit_balance: creditBalance,
          net_balance: netBalance,
        };
      });

      // Build hierarchy
      const hierarchicalData = buildAccountHierarchy(trialBalanceData);
      setTrialBalance(hierarchicalData);

    } catch (error) {
      console.error('Error loading trial balance:', error);
    } finally {
      setLoading(false);
    }
  };

  const buildAccountHierarchy = (accounts: TrialBalanceAccount[]): TrialBalanceAccount[] => {
    const accountMap = new Map<string, TrialBalanceAccount>();
    const rootAccounts: TrialBalanceAccount[] = [];

    // Create map of all accounts
    accounts.forEach(account => {
      accountMap.set(account.account_code, { ...account, children: [] });
    });

    // Build hierarchy
    accounts.forEach(account => {
      const accountWithChildren = accountMap.get(account.account_code)!;
      
      if (account.parent_account_id) {
        const parentCode = accounts.find(a => a.parent_account_id === account.parent_account_id)?.account_code;
        const parent = accountMap.get(parentCode || '');
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(accountWithChildren);
        } else {
          rootAccounts.push(accountWithChildren);
        }
      } else {
        rootAccounts.push(accountWithChildren);
      }
    });

    return rootAccounts;
  };

  const loadAccountLedger = async (account: TrialBalanceAccount) => {
    setLedgerLoading(true);
    setSelectedAccount(account);
    
    try {
      const { data: journalLines } = await supabase
        .from('journal_entry_lines')
        .select(`
          *,
          journal_entries!inner(
            id,
            date,
            description,
            reference,
            status,
            source_document_type,
            source_document_id
          )
        `)
        .eq('account_code', account.account_code)
        .lte('journal_entries.date', asOfDate)
        .eq('journal_entries.status', 'posted')
        .order('journal_entries.date', { ascending: true });

      if (journalLines) {
        let runningBalance = 0;
        const ledgerEntries: AccountLedger[] = journalLines.map(line => {
          const debitAmount = line.bdt_debit_amount || line.debit_amount || 0;
          const creditAmount = line.bdt_credit_amount || line.credit_amount || 0;
          
          // Calculate running balance based on account type
          if (['asset', 'expense'].includes(account.account_type)) {
            runningBalance += debitAmount - creditAmount;
          } else {
            runningBalance += creditAmount - debitAmount;
          }

          return {
            id: line.id,
            date: (line.journal_entries as { date: string }).date,
            description: (line.journal_entries as { description: string }).description,
            reference: (line.journal_entries as { reference: string | null }).reference,
            debit_amount: debitAmount,
            credit_amount: creditAmount,
            running_balance: runningBalance,
            source_document_type: (line.journal_entries as { source_document_type: string | null }).source_document_type,
            source_document_id: (line.journal_entries as { source_document_id: string | null }).source_document_id,
          };
        });

        setAccountLedger(ledgerEntries);
        setShowLedger(true);
      }
    } catch (error) {
      console.error('Error loading account ledger:', error);
    } finally {
      setLedgerLoading(false);
    }
  };

  const renderAccountRow = (account: TrialBalanceAccount, depth = 0) => {
    const indent = depth * 20;
    const showAccount = !filters.accountType || account.account_type === filters.accountType;
    const hasBalance = filters.showZeroBalances || Math.abs(account.net_balance) > 0.01;

    if (!showAccount || !hasBalance) return null;

    return (
      <React.Fragment key={account.account_code}>
        <tr className={`hover:bg-gray-50 ${depth === 0 ? 'bg-gray-100 font-semibold' : ''}`}>
          <td className="px-6 py-3 whitespace-nowrap">
            <div style={{ paddingLeft: `${indent}px` }} className="flex items-center">
              <span className="text-sm text-gray-900">{account.account_code}</span>
            </div>
          </td>
          <td className="px-6 py-3">
            <div style={{ paddingLeft: `${indent}px` }}>
              <span className={`text-sm ${depth === 0 ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                {account.account_name}
              </span>
            </div>
          </td>
          <td className="px-6 py-3 whitespace-nowrap">
            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
              account.account_type === 'asset' ? 'bg-blue-100 text-blue-800' :
              account.account_type === 'liability' ? 'bg-red-100 text-red-800' :
              account.account_type === 'equity' ? 'bg-purple-100 text-purple-800' :
              account.account_type === 'revenue' ? 'bg-green-100 text-green-800' :
              'bg-orange-100 text-orange-800'
            }`}>
              {account.account_type}
            </span>
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
            {account.debit_balance > 0 ? account.debit_balance.toLocaleString() : '-'}
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-right text-sm text-gray-900">
            {account.credit_balance > 0 ? account.credit_balance.toLocaleString() : '-'}
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-right text-sm">
            <span className={`font-medium ${
              account.net_balance > 0 ? 'text-green-600' : 
              account.net_balance < 0 ? 'text-red-600' : 'text-gray-500'
            }`}>
              {Math.abs(account.net_balance).toLocaleString()}
            </span>
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-sm font-medium">
            {depth > 0 && Math.abs(account.net_balance) > 0.01 && (
              <button
                onClick={() => loadAccountLedger(account)}
                className="text-blue-600 hover:text-blue-900 p-1"
                title="View ledger"
                disabled={ledgerLoading}
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
          </td>
        </tr>
        {account.children?.map(child => renderAccountRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const calculateTotals = () => {
    let totalDebits = 0;
    let totalCredits = 0;

    const calculateAccountTotals = (accounts: TrialBalanceAccount[]) => {
      accounts.forEach(account => {
        totalDebits += account.debit_balance;
        totalCredits += account.credit_balance;
        if (account.children) {
          calculateAccountTotals(account.children);
        }
      });
    };

    calculateAccountTotals(trialBalance);
    return { totalDebits, totalCredits };
  };

  const totals = calculateTotals();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-200 rounded"></div>
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
          <h2 className="text-2xl font-bold text-gray-900">Trial Balance</h2>
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
              <option value="asset">Assets</option>
              <option value="liability">Liabilities</option>
              <option value="equity">Equity</option>
              <option value="revenue">Revenue</option>
              <option value="expense">Expenses</option>
            </select>
          </div>
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={filters.showZeroBalances}
              onChange={(e) => setFilters({ ...filters, showZeroBalances: e.target.checked })}
              className="mr-2"
            />
            <label className="text-sm font-medium text-gray-700">Show Zero Balances</label>
          </div>
        </div>
      </div>

      {/* Trial Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-blue-900">Total Debits</h3>
          <p className="text-2xl font-bold text-blue-600">BDT {totals.totalDebits.toLocaleString()}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <h3 className="text-lg font-semibold text-green-900">Total Credits</h3>
          <p className="text-2xl font-bold text-green-600">BDT {totals.totalCredits.toLocaleString()}</p>
        </div>
        <div className={`p-4 rounded-lg ${
          Math.abs(totals.totalDebits - totals.totalCredits) < 0.01 
            ? 'bg-green-50' 
            : 'bg-red-50'
        }`}>
          <h3 className={`text-lg font-semibold ${
            Math.abs(totals.totalDebits - totals.totalCredits) < 0.01 
              ? 'text-green-900' 
              : 'text-red-900'
          }`}>
            Balance Check
          </h3>
          <p className={`text-2xl font-bold ${
            Math.abs(totals.totalDebits - totals.totalCredits) < 0.01 
              ? 'text-green-600' 
              : 'text-red-600'
          }`}>
            {Math.abs(totals.totalDebits - totals.totalCredits) < 0.01 
              ? 'Balanced' 
              : `Out by ${Math.abs(totals.totalDebits - totals.totalCredits).toLocaleString()}`
            }
          </p>
        </div>
      </div>

      {/* Trial Balance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h3 className="text-lg font-semibold">Trial Balance as of {asOfDate}</h3>
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
                  Type
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debit Balance
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credit Balance
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Net Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trialBalance.map(account => renderAccountRow(account))}
              <tr className="bg-gray-100 font-bold">
                <td colSpan={3} className="px-6 py-3 text-sm text-gray-900">
                  TOTALS
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">
                  {totals.totalDebits.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">
                  {totals.totalCredits.toLocaleString()}
                </td>
                <td className="px-6 py-3 text-right text-sm text-gray-900">
                  {(totals.totalDebits - totals.totalCredits).toLocaleString()}
                </td>
                <td className="px-6 py-3"></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Account Ledger Modal */}
      {showLedger && selectedAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Account Ledger: {selectedAccount.account_code} - {selectedAccount.account_name}
              </h3>
              <button
                onClick={() => setShowLedger(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="overflow-auto max-h-[calc(90vh-120px)]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reference
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Debit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Credit
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {accountLedger.map((entry) => (
                    <tr key={entry.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {entry.date}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {entry.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {entry.reference || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {entry.debit_amount > 0 ? entry.debit_amount.toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900">
                        {entry.credit_amount > 0 ? entry.credit_amount.toLocaleString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <span className={`${
                          entry.running_balance > 0 ? 'text-green-600' : 
                          entry.running_balance < 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {Math.abs(entry.running_balance).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {trialBalance.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No trial balance data</h3>
          <p className="text-gray-500 mb-4">
            No posted journal entries found for the selected date.
          </p>
        </div>
      )}
    </div>
  );
}