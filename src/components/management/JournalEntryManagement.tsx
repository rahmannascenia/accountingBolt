import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Edit2, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface JournalEntry {
  id: string;
  entry_number: string;
  date: string;
  description: string;
  reference: string | null;
  total_debit: number;
  total_credit: number;
  status: 'draft' | 'posted';
  entry_type: string | null;
  journal_entry_lines?: JournalEntryLine[];
}

interface JournalEntryLine {
  id: string;
  account_code: string | null;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  debit_amount: number;
  credit_amount: number;
  description: string | null;
}

export function JournalEntryManagement() {
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedReference, setSelectedReference] = useState('');
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    reference: '',
    lines: [
      { account_code: '1000', account_name: 'Cash', account_type: 'asset' as const, debit_amount: 0, credit_amount: 0, description: '' },
      { account_code: '4000', account_name: 'Revenue', account_type: 'revenue' as const, debit_amount: 0, credit_amount: 0, description: '' },
    ],
  });

  useEffect(() => {
    loadJournalEntries();
  }, []);

  const loadJournalEntries = async () => {
    try {
      const { data: entries } = await supabase
        .from('journal_entries')
        .select(`
          *,
          journal_entry_lines(*)
        `)
        .order('created_at', { ascending: false });

      if (entries) {
        setJournalEntries(entries);
      }
    } catch (error) {
      console.error('Error loading journal entries:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLine = () => {
    setFormData({
      ...formData,
      lines: [
        ...formData.lines,
        { account_code: '1000', account_name: '', account_type: 'asset' as const, debit_amount: 0, credit_amount: 0, description: '' },
      ],
    });
  };

  const removeLine = (index: number) => {
    if (formData.lines.length > 2) {
      const newLines = formData.lines.filter((_, i) => i !== index);
      setFormData({ ...formData, lines: newLines });
    }
  };

  const updateLine = (index: number, field: string, value: any) => {
    const newLines = [...formData.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setFormData({ ...formData, lines: newLines });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const totalDebit = formData.lines.reduce((sum, line) => sum + line.debit_amount, 0);
      const totalCredit = formData.lines.reduce((sum, line) => sum + line.credit_amount, 0);
      
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        alert('Journal entry must be balanced (debits must equal credits)');
        return;
      }

      // Generate entry number
      const entryCount = await supabase.from('journal_entries').select('id', { count: 'exact', head: true });
      const year = new Date().getFullYear();
      const entryNumber = `JE-${year}-${String((entryCount.count || 0) + 1).padStart(4, '0')}`;

      const { data: entry, error } = await supabase
        .from('journal_entries')
        .insert([{
          entry_number: entryNumber,
          date: formData.date,
          description: formData.description,
          reference: formData.reference || null,
          total_debit: totalDebit,
          total_credit: totalCredit,
          entry_type: 'manual',
        }])
        .select()
        .single();

      if (error) throw error;

      // Insert journal entry lines
      const linesData = formData.lines.map(line => ({
        journal_entry_id: entry.id,
        account_code: line.account_code,
        account_name: line.account_name,
        account_type: line.account_type,
        debit_amount: line.debit_amount,
        credit_amount: line.credit_amount,
        description: line.description || null,
      }));

      await supabase.from('journal_entry_lines').insert(linesData);

      await loadJournalEntries();
      resetForm();
    } catch (error) {
      console.error('Error creating journal entry:', error);
    }
  };

  const handleStatusUpdate = async (entryId: string, status: 'draft' | 'posted') => {
    try {
      await supabase
        .from('journal_entries')
        .update({ status })
        .eq('id', entryId);
      await loadJournalEntries();
    } catch (error) {
      console.error('Error updating journal entry status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      description: '',
      reference: '',
      lines: [
        { account_code: '1000', account_name: 'Cash', account_type: 'asset' as const, debit_amount: 0, credit_amount: 0, description: '' },
        { account_code: '4000', account_name: 'Revenue', account_type: 'revenue' as const, debit_amount: 0, credit_amount: 0, description: '' },
      ],
    });
    setShowForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'posted': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const totalDebit = formData.lines.reduce((sum, line) => sum + line.debit_amount, 0);
  const totalCredit = formData.lines.reduce((sum, line) => sum + line.credit_amount, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  // Get unique references for filtering
  const references = [...new Set(journalEntries.map(entry => entry.reference).filter(Boolean))];

  // Filter entries by reference
  const filteredEntries = selectedReference 
    ? journalEntries.filter(entry => entry.reference === selectedReference)
    : journalEntries;

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
          <BookOpen className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Journal Entry Management</h2>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedReference}
            onChange={(e) => setSelectedReference(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Entries</option>
            {references.map((ref) => (
              <option key={ref} value={ref}>
                {ref}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{showForm ? 'Cancel' : 'Create Entry'}</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">Create New Journal Entry</h3>
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
                  Reference
                </label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="INV-2024-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Balance Check
                </label>
                <div className={`px-3 py-2 rounded-md text-sm font-medium ${
                  isBalanced ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {isBalanced ? 'Balanced' : `Out of balance: ${(totalDebit - totalCredit).toFixed(2)}`}
                </div>
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
                placeholder="Journal entry description"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-md font-semibold">Journal Entry Lines</h4>
                <button
                  type="button"
                  onClick={addLine}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Add Line
                </button>
              </div>

              <div className="space-y-3">
                {formData.lines.map((line, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-7 gap-2 p-3 bg-gray-50 rounded border">
                    <div>
                      <input
                        type="text"
                        placeholder="Account Code"
                        value={line.account_code}
                        onChange={(e) => updateLine(index, 'account_code', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        required
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Account Name"
                        value={line.account_name}
                        onChange={(e) => updateLine(index, 'account_name', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        required
                      />
                    </div>
                    <div>
                      <select
                        value={line.account_type}
                        onChange={(e) => updateLine(index, 'account_type', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="asset">Asset</option>
                        <option value="liability">Liability</option>
                        <option value="equity">Equity</option>
                        <option value="revenue">Revenue</option>
                        <option value="expense">Expense</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Debit"
                        value={line.debit_amount || ''}
                        onChange={(e) => updateLine(index, 'debit_amount', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Credit"
                        value={line.credit_amount || ''}
                        onChange={(e) => updateLine(index, 'credit_amount', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Description"
                        value={line.description}
                        onChange={(e) => updateLine(index, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      {formData.lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="w-full bg-red-600 text-white px-2 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                <div className="text-right">
                  <strong>Total Debits: {totalDebit.toFixed(2)}</strong>
                </div>
                <div className="text-right">
                  <strong>Total Credits: {totalCredit.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={!isBalanced}
              className={`px-6 py-2 rounded-lg ${
                isBalanced
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-400 text-gray-700 cursor-not-allowed'
              }`}
            >
              Create Journal Entry
            </button>
          </form>
        </div>
      )}

      {/* Journal Entries List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entry Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount
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
            {filteredEntries.map((entry) => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{entry.entry_number}</div>
                    <div className="text-sm text-gray-500">{entry.date}</div>
                    {entry.reference && (
                      <div className="text-sm text-blue-600">{entry.reference}</div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{entry.description}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {entry.journal_entry_lines?.map((line, index) => (
                      <div key={index}>
                        {line.account_name}: 
                        {line.debit_amount > 0 && ` Dr ${line.debit_amount.toFixed(2)}`}
                        {line.credit_amount > 0 && ` Cr ${line.credit_amount.toFixed(2)}`}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {entry.total_debit.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(entry.status)}`}>
                    {entry.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {entry.status === 'draft' && (
                    <button
                      onClick={() => handleStatusUpdate(entry.id, 'posted')}
                      className="text-green-600 hover:text-green-900 p-1"
                      title="Post entry"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {journalEntries.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No journal entries yet</h3>
          <p className="text-gray-500 mb-4">Create your first journal entry to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Entry
          </button>
        </div>
      )}
    </div>
  );
}