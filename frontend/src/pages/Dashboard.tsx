import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Users, 
  FileText, 
  DollarSign, 
  AlertTriangle,
  Edit,
  TrendingUp,
  Calendar,
  ArrowUpRight
} from 'lucide-react';
import { dashboardAPI, invoicesAPI, handleApiError } from '../utils/api';
import type { DashboardStats, Invoice } from '../types';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [statsData, overdueData] = await Promise.all([
          dashboardAPI.getStats(),
          invoicesAPI.getOverdueInvoices()
        ]);
        
        setStats(statsData);
        setOverdueInvoices(overdueData.slice(0, 5)); // Show only first 5
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">Error loading dashboard: {error}</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total Customers',
      value: stats?.totalCustomers || 0,
      icon: Users,
      color: 'bg-blue-500',
      link: '/customers'
    },
    {
      title: 'Total Invoices',
      value: stats?.totalInvoices || 0,
      icon: FileText,
      color: 'bg-green-500',
      link: '/invoices'
    },
    {
      title: 'Total Revenue',
      value: `$${(stats?.totalRevenue || 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-purple-500',
      link: '/invoices?status=paid'
    },
    {
      title: 'Overdue Invoices',
      value: stats?.overdueInvoices || 0,
      icon: AlertTriangle,
      color: 'bg-red-500',
      link: '/invoices/reports/overdue'
    }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const getCustomerName = (invoice: Invoice) => {
    if (invoice.company_name) {
      return invoice.company_name;
    }
    if (invoice.first_name && invoice.last_name) {
      return `${invoice.first_name} ${invoice.last_name}`;
    }
    return 'Unknown Customer';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="flex space-x-3">
          <Link
            to="/customers/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            <Users className="h-4 w-4 mr-2" />
            Add Customer
          </Link>
          <Link
            to="/invoices/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Invoice
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Link
            key={stat.title}
            to={stat.link}
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className={`${stat.color} rounded-md p-3`}>
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {stat.title}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-2xl font-semibold text-gray-900">
                        {stat.value}
                      </div>
                    </dd>
                  </dl>
                </div>
                <div className="flex-shrink-0">
                  <ArrowUpRight className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <Link
                to="/invoices/new"
                className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="bg-green-100 rounded-full p-2">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Create New Invoice</p>
                  <p className="text-sm text-gray-500">Generate a new invoice for your customers</p>
                </div>
              </Link>

              <Link
                to="/customers/new"
                className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="bg-blue-100 rounded-full p-2">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">Add New Customer</p>
                  <p className="text-sm text-gray-500">Register a new customer in your system</p>
                </div>
              </Link>

              <Link
                to="/reports"
                className="flex items-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="bg-purple-100 rounded-full p-2">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-900">View Reports</p>
                  <p className="text-sm text-gray-500">Analyze your financial performance</p>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Overdue Invoices */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Overdue Invoices</h3>
            {overdueInvoices.length > 0 && (
              <Link
                to="/invoices/reports/overdue"
                className="text-sm text-blue-600 hover:text-blue-500"
              >
                View all
              </Link>
            )}
          </div>
          <div className="p-6">
            {overdueInvoices.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No overdue invoices</p>
                <p className="text-sm text-gray-400">All invoices are up to date</p>
              </div>
            ) : (
              <div className="space-y-4">
                {overdueInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <AlertTriangle className="h-4 w-4 text-red-500 mr-2" />
                        <Link
                          to={`/invoices/${invoice.id}`}
                          className="text-sm font-medium text-gray-900 hover:text-blue-600"
                        >
                          {invoice.invoice_number}
                        </Link>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{getCustomerName(invoice)}</p>
                      <p className="text-xs text-red-600">
                        Due: {new Date(invoice.due_date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(invoice.balance_due)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;