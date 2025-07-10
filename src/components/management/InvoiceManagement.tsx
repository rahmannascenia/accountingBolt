import React, { useState, useEffect } from 'react';
import { FileText, Plus, Edit2, Trash2, Send, DollarSign } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string;
  date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  bdt_amount: number | null;
  exchange_rate: number | null;
  status: 'draft' | 'sent' | 'cancelled';
  invoice_type: 'custom' | 'recurring';
  tds_rate: number | null;
  tds_amount: number | null;
  vds_rate: number | null;
  vds_amount: number | null;
  vat_rate: number | null;
  vat_amount: number | null;
  net_receivable: number | null;
  notes: string | null;
  customers: { name: string; customer_type: string; country: string } | null;
}

interface Customer {
  id: string;
  name: string;
  currency: string;
  customer_type: 'local' | 'foreign';
  payment_terms: number;
}

interface Service {
  id: string;
  name: string;
  default_price: number;
  currency: string;
  category: string;
}

interface InvoiceItem {
  service_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export function InvoiceManagement() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    customer_id: '',
    status: '',
    start_date: '',
    end_date: '',
  });

  const [formData, setFormData] = useState({
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'USD',
    invoice_type: 'custom' as 'custom' | 'recurring',
    notes: '',
    tds_rate: 0,
    vds_rate: 0,
    vat_rate: 0,
  });

  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([
    { service_id: '', description: '', quantity: 1, unit_price: 0, total_price: 0 }
  ]);

  useEffect(() => {
    loadData();
  }, [filters]);

  const loadData = async () => {
    try {
      let invoicesQuery = supabase
        .from('invoices')
        .select(`
          *,
          customers!inner(name, customer_type, country)
        `)
        .order('created_at', { ascending: false });

      if (filters.customer_id) {
        invoicesQuery = invoicesQuery.eq('customer_id', filters.customer_id);
      }
      if (filters.status) {
        invoicesQuery = invoicesQuery.eq('status', filters.status);
      }
      if (filters.start_date) {
        invoicesQuery = invoicesQuery.gte('date', filters.start_date);
      }
      if (filters.end_date) {
        invoicesQuery = invoicesQuery.lte('date', filters.end_date);
      }

      const [invoicesResult, customersResult, servicesResult] = await Promise.all([
        invoicesQuery,
        supabase.from('customers').select('*').order('name'),
        supabase.from('services').select('*').eq('is_active', true).order('name')
      ]);

      if (invoicesResult.data) setInvoices(invoicesResult.data);
      if (customersResult.data) setCustomers(customersResult.data);
      if (servicesResult.data) setServices(servicesResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotals = () => {
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.total_price, 0);
    const selectedCustomer = customers.find(c => c.id === formData.customer_id);
    const isLocal = selectedCustomer?.customer_type === 'local';

    let tdsAmount = 0;
    let vdsAmount = 0;
    let vatAmount = 0;

    if (isLocal) {
      tdsAmount = subtotal * (formData.tds_rate / 100);
      vdsAmount = subtotal * (formData.vds_rate / 100);
      vatAmount = subtotal * (formData.vat_rate / 100);
    }

    const totalAmount = subtotal + vatAmount;
    const netReceivable = totalAmount - tdsAmount - vdsAmount;

    return { subtotal, tdsAmount, vdsAmount, vatAmount, totalAmount, netReceivable };
  };

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...invoiceItems];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'unit_price') {
      newItems[index].total_price = newItems[index].quantity * newItems[index].unit_price;
    }

    if (field === 'service_id' && value) {
      const service = services.find(s => s.id === value);
      if (service) {
        newItems[index].description = service.name;
        newItems[index].unit_price = service.default_price;
        newItems[index].total_price = newItems[index].quantity * service.default_price;
      }
    }

    setInvoiceItems(newItems);
  };

  const addItem = () => {
    setInvoiceItems([...invoiceItems, {
      service_id: '',
      description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0
    }]);
  };

  const removeItem = (index: number) => {
    if (invoiceItems.length > 1) {
      setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const customer = customers.find(c => c.id === formData.customer_id);
      if (!customer) return;

      const totals = calculateTotals();
      const dueDate = new Date(formData.date);
      dueDate.setDate(dueDate.getDate() + customer.payment_terms);

      // Generate invoice number
      const invoiceCount = await supabase.from('invoices').select('id', { count: 'exact', head: true });
      const year = new Date().getFullYear();
      const invoiceNumber = `INV-${year}-${String((invoiceCount.count || 0) + 1).padStart(4, '0')}`;

      const invoiceData = {
        invoice_number: invoiceNumber,
        customer_id: formData.customer_id,
        date: formData.date,
        due_date: dueDate.toISOString().split('T')[0],
        currency: formData.currency,
        subtotal: totals.subtotal,
        tax_amount: totals.vatAmount,
        total_amount: totals.totalAmount,
        invoice_type: formData.invoice_type,
        tds_rate: customer.customer_type === 'local' ? formData.tds_rate : null,
        tds_amount: customer.customer_type === 'local' ? totals.tdsAmount : null,
        vds_rate: customer.customer_type === 'local' ? formData.vds_rate : null,
        vds_amount: customer.customer_type === 'local' ? totals.vdsAmount : null,
        vat_rate: customer.customer_type === 'local' ? formData.vat_rate : null,
        vat_amount: customer.customer_type === 'local' ? totals.vatAmount : null,
        net_receivable: customer.customer_type === 'local' ? totals.netReceivable : null,
        notes: formData.notes || null,
      };

      const { data: invoice, error } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select()
        .single();

      if (error) throw error;

      // Insert invoice items
      const itemsData = invoiceItems
        .filter(item => item.service_id)
        .map(item => ({
          invoice_id: invoice.id,
          service_id: item.service_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
        }));

      if (itemsData.length > 0) {
        await supabase.from('invoice_items').insert(itemsData);
      }

      await loadData();
      
      // Save FX rate if foreign currency and exchange rate was used
      if (formData.currency !== 'BDT') {
        try {
          // Get the exchange rate that was used for this invoice
          const { data: existingRate } = await supabase
            .from('fx_rates')
            .select('rate')
            .eq('from_currency', formData.currency)
            .eq('to_currency', 'BDT')
            .lte('date', formData.date)
            .eq('is_active', true)
            .order('date', { ascending: false })
            .limit(1);

          if (existingRate?.[0]) {
            await supabase.rpc('upsert_fx_rate', {
              p_from_currency: formData.currency,
              p_to_currency: 'BDT',
              p_date: formData.date,
              p_rate: existingRate[0].rate,
              p_source: 'Invoice',
              p_notes: `From invoice: ${invoiceNumber}`
            });
          }
        } catch (error) {
          console.error('Error saving FX rate from invoice:', error);
        }
      }
      
      resetForm();
    } catch (error) {
      console.error('Error creating invoice:', error);
    }
  };

  const handleStatusUpdate = async (id: string, status: 'draft' | 'sent' | 'cancelled') => {
    try {
      await supabase
        .from('invoices')
        .update({ status })
        .eq('id', id);
      await loadData();
    } catch (error) {
      console.error('Error updating invoice status:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this invoice?')) {
      try {
        await supabase.from('invoices').delete().eq('id', id);
        await loadData();
      } catch (error) {
        console.error('Error deleting invoice:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      date: new Date().toISOString().split('T')[0],
      currency: 'USD',
      invoice_type: 'custom',
      notes: '',
      tds_rate: 0,
      vds_rate: 0,
      vat_rate: 0,
    });
    setInvoiceItems([
      { service_id: '', description: '', quantity: 1, unit_price: 0, total_price: 0 }
    ]);
    setEditingInvoice(null);
    setShowForm(false);
  };

  const totals = calculateTotals();
  const selectedCustomer = customers.find(c => c.id === formData.customer_id);
  const isLocal = selectedCustomer?.customer_type === 'local';

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
          <FileText className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Invoice Management</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? 'Cancel' : 'Create Invoice'}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow border">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
            <select
              value={filters.customer_id}
              onChange={(e) => setFilters({ ...filters, customer_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Customers</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.name}</option>
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
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">Create New Invoice</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
                <select
                  required
                  value={formData.customer_id}
                  onChange={(e) => {
                    const customer = customers.find(c => c.id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      customer_id: e.target.value,
                      currency: customer?.currency || 'USD'
                    });
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} ({customer.customer_type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date *</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <input
                  type="text"
                  value={formData.currency}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>
            </div>

            {/* Tax Configuration for Local Customers */}
            {isLocal && (
              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-3">Tax Configuration (Local Customer)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">TDS Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tds_rate}
                      onChange={(e) => setFormData({ ...formData, tds_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VDS Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.vds_rate}
                      onChange={(e) => setFormData({ ...formData, vds_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.vat_rate}
                      onChange={(e) => setFormData({ ...formData, vat_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Invoice Items */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h4 className="font-medium">Invoice Items</h4>
                <button
                  type="button"
                  onClick={addItem}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  Add Item
                </button>
              </div>
              
              <div className="space-y-3">
                {invoiceItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-3 p-3 bg-gray-50 rounded border">
                    <div>
                      <select
                        value={item.service_id}
                        onChange={(e) => handleItemChange(index, 'service_id', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      >
                        <option value="">Select Service</option>
                        {services.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Unit Price"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Total"
                        value={item.total_price}
                        readOnly
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-gray-100"
                      />
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        className="w-full bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600"
                        disabled={invoiceItems.length === 1}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>{formData.currency} {totals.subtotal.toFixed(2)}</span>
                  </div>
                  {isLocal && (
                    <>
                      <div className="flex justify-between">
                        <span>VAT ({formData.vat_rate}%):</span>
                        <span>{formData.currency} {totals.vatAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>TDS ({formData.tds_rate}%):</span>
                        <span>-{formData.currency} {totals.tdsAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>VDS ({formData.vds_rate}%):</span>
                        <span>-{formData.currency} {totals.vdsAmount.toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between font-medium">
                    <span>Total Amount:</span>
                    <span>{formData.currency} {totals.totalAmount.toFixed(2)}</span>
                  </div>
                  {isLocal && (
                    <div className="flex justify-between font-medium text-green-600">
                      <span>Net Receivable:</span>
                      <span>{formData.currency} {totals.netReceivable.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                Create Invoice
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

      {/* Invoice List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
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
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{invoice.invoice_number}</div>
                      <div className="text-sm text-gray-500">{invoice.date}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{invoice.customers?.name}</div>
                    <div className="text-sm text-gray-500">{invoice.customers?.country}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {invoice.currency} {invoice.total_amount.toLocaleString()}
                    </div>
                    {invoice.net_receivable && (
                      <div className="text-sm text-green-600">
                        Net: {invoice.currency} {invoice.net_receivable.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {invoice.due_date}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      invoice.status === 'sent' ? "bg-green-100 text-green-800" :
                      invoice.status === 'cancelled' ? "bg-red-100 text-red-800" :
                      "bg-blue-100 text-blue-800"
                    }`}>
                      {invoice.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      {invoice.status === 'draft' && (
                        <button
                          onClick={() => handleStatusUpdate(invoice.id, 'sent')}
                          className="text-green-600 hover:text-green-900 p-1"
                          title="Send invoice"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(invoice.id)}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete invoice"
                        disabled={invoice.status === 'sent'}
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
      </div>

      {invoices.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
          <p className="text-gray-500 mb-4">Create your first invoice to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Invoice
          </button>
        </div>
      )}
    </div>
  );
}