import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Service {
  id: string;
  name: string;
  description: string | null;
  default_price: number;
  currency: string;
  category: string;
  is_recurring: boolean;
  is_active: boolean;
}

interface Currency {
  id: string;
  code: string;
  name: string;
}

export function ServiceManagement() {
  const [services, setServices] = useState<Service[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    default_price: '',
    currency: 'USD',
    category: '',
    is_recurring: false,
  });

  const categories = [
    'Web Development',
    'Mobile App Development',
    'Software Consulting',
    'Maintenance & Support',
    'Hosting Services',
    'Custom Software',
    'API Development',
    'Database Design',
    'UI/UX Design',
    'Other'
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [servicesResult, currenciesResult] = await Promise.all([
        supabase.from('services').select('*').order('created_at', { ascending: false }),
        supabase.from('currencies').select('*').order('code')
      ]);

      if (servicesResult.data) setServices(servicesResult.data);
      if (currenciesResult.data) setCurrencies(currenciesResult.data);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const serviceData = {
        ...formData,
        default_price: parseFloat(formData.default_price),
        description: formData.description || null,
      };

      if (editingService) {
        await supabase
          .from('services')
          .update(serviceData)
          .eq('id', editingService.id);
      } else {
        await supabase
          .from('services')
          .insert([serviceData]);
      }

      await loadData();
      resetForm();
    } catch (error) {
      console.error('Error saving service:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this service?')) {
      try {
        await supabase.from('services').delete().eq('id', id);
        await loadData();
      } catch (error) {
        console.error('Error deleting service:', error);
      }
    }
  };

  const toggleStatus = async (id: string, isActive: boolean) => {
    try {
      await supabase
        .from('services')
        .update({ is_active: !isActive })
        .eq('id', id);
      await loadData();
    } catch (error) {
      console.error('Error updating service status:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      default_price: '',
      currency: 'USD',
      category: '',
      is_recurring: false,
    });
    setEditingService(null);
    setShowForm(false);
  };

  const editService = (service: Service) => {
    setFormData({
      name: service.name,
      description: service.description || '',
      default_price: service.default_price.toString(),
      currency: service.currency,
      category: service.category,
      is_recurring: service.is_recurring,
    });
    setEditingService(service);
    setShowForm(true);
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
          <Package className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Service Management</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? 'Cancel' : 'Add Service'}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">
            {editingService ? 'Edit Service' : 'Add New Service'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Web Development"
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
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Default Price *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.default_price}
                  onChange={(e) => setFormData({ ...formData, default_price: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1000.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Currency *
                </label>
                <select
                  required
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {currencies.map((currency) => (
                    <option key={currency.id} value={currency.code}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Detailed description of the service..."
              />
            </div>

            <div>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700">Recurring Service (Monthly billing)</span>
              </label>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingService ? 'Update Service' : 'Create Service'}
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

      {/* Services List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
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
              {services.map((service) => (
                <tr key={service.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{service.name}</div>
                      {service.description && (
                        <div className="text-sm text-gray-500">{service.description}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {service.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {service.currency} {service.default_price.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      service.is_recurring 
                        ? "bg-purple-100 text-purple-800" 
                        : "bg-gray-100 text-gray-800"
                    }`}>
                      {service.is_recurring ? "Recurring" : "One-time"}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleStatus(service.id, service.is_active)}
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        service.is_active 
                          ? "bg-green-100 text-green-800 hover:bg-green-200" 
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      } transition-colors`}
                    >
                      {service.is_active ? "Active" : "Inactive"}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => editService(service)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Edit service"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(service.id)}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete service"
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

      {services.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No services yet</h3>
          <p className="text-gray-500 mb-4">Add your first service to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Service
          </button>
        </div>
      )}
    </div>
  );
}