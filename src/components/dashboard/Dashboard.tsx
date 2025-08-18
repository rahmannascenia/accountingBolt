import React, { useState, useEffect } from 'react';
import { Users, FileText, CreditCard, DollarSign, AlertTriangle, Shield, TrendingUp, Activity } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface DashboardStats {
  totalCustomers: number;
  localCustomers: number;
  foreignCustomers: number;
  totalInvoices: number;
  outstandingInvoices: number;
  totalPayments: number;
  pendingIncentives: number;
  upcomingDeadlines: number;
  totalOutstanding: number;
  totalReceived: number;
}

interface RecentInvoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
  customer_name: string;
}

interface CashIncentiveAlert {
  id: string;
  customer_name: string;
  expected_incentive: number;
  days_remaining: number;
  alert_level: 'red' | 'yellow' | 'green';
}

export function Dashboard() {
  const { userProfile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0,
    localCustomers: 0,
    foreignCustomers: 0,
    totalInvoices: 0,
    outstandingInvoices: 0,
    totalPayments: 0,
    pendingIncentives: 0,
    upcomingDeadlines: 0,
    totalOutstanding: 0,
    totalReceived: 0,
  });
  const [recentInvoices, setRecentInvoices] = useState<RecentInvoice[]>([]);
  const [incentiveAlerts, setIncentiveAlerts] = useState<CashIncentiveAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsInitialization, setNeedsInitialization] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load dashboard statistics
      const [
        { data: customers },
        { data: invoices },
        { data: payments },
        { data: incentives },
        { data: services }
      ] = await Promise.all([
        supabase.from('customers').select('customer_type'),
        supabase.from('invoices').select('status, total_amount'),
        supabase.from('payments').select('status, amount'),
        supabase.from('cash_incentives').select('status, expected_incentive, submission_deadline'),
        supabase.from('services').select('id').limit(1)
      ]);

      // Calculate statistics
      const totalCustomers = customers?.length || 0;
      const localCustomers = customers?.filter(c => c.customer_type === 'local').length || 0;
      const foreignCustomers = customers?.filter(c => c.customer_type === 'foreign').length || 0;
      const totalInvoices = invoices?.length || 0;
      const outstandingInvoices = invoices?.filter(i => i.status === 'sent').length || 0;
      const totalPayments = payments?.length || 0;
      const pendingIncentives = incentives?.filter(i => i.status === 'pending').length || 0;
      
      const totalOutstanding = invoices?.filter(i => i.status === 'sent')
        .reduce((sum, i) => sum + i.total_amount, 0) || 0;
      const totalReceived = payments?.filter(p => p.status === 'cleared')
        .reduce((sum, p) => sum + p.amount, 0) || 0;

      // Calculate upcoming deadlines
      const today = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(today.getDate() + 30);
      
      const upcomingDeadlines = incentives?.filter(i => {
        if (i.status !== 'pending') return false;
        const deadline = new Date(i.submission_deadline);
        return deadline <= thirtyDaysFromNow;
      }).length || 0;

      setStats({
        totalCustomers,
        localCustomers,
        foreignCustomers,
        totalInvoices,
        outstandingInvoices,
        totalPayments,
        pendingIncentives,
        upcomingDeadlines,
        totalOutstanding,
        totalReceived,
      });

      // Load recent invoices
      const { data: recentInvoicesData } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          total_amount,
          status,
          customers!inner(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      const formattedInvoices: RecentInvoice[] = recentInvoicesData?.map((invoice: any) => ({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        total_amount: invoice.total_amount,
        status: invoice.status,
        customer_name: invoice.customers?.name || 'Unknown Customer'
      })) || [];

      setRecentInvoices(formattedInvoices);

      // Load cash incentive alerts
      const { data: incentiveAlertsData } = await supabase
        .from('cash_incentives')
        .select(`
          id,
          expected_incentive,
          submission_deadline,
          customers!inner(name)
        `)
        .eq('status', 'pending')
        .order('submission_deadline', { ascending: true })
        .limit(5);

      const formattedAlerts: CashIncentiveAlert[] = incentiveAlertsData?.map((incentive: any) => {
        const deadline = new Date(incentive.submission_deadline);
        const daysRemaining = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let alertLevel: 'red' | 'yellow' | 'green' = 'green';
        if (daysRemaining <= 10) alertLevel = 'red';
        else if (daysRemaining <= 30) alertLevel = 'yellow';

        return {
          id: incentive.id,
          customer_name: incentive.customers?.name || 'Unknown Customer',
          expected_incentive: incentive.expected_incentive,
          days_remaining: daysRemaining,
          alert_level: alertLevel
        };
      }).filter(alert => alert.days_remaining <= 30) || [];

      setIncentiveAlerts(formattedAlerts);

      // Check if initialization is needed
      setNeedsInitialization(!services || services.length === 0);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeSampleData = async () => {
    try {
      // Initialize sample services
      const sampleServices = [
        {
          name: 'Web Development',
          description: 'Custom web application development',
          default_price: 5000,
          currency: 'USD',
          category: 'Development',
          is_recurring: false
        },
        {
          name: 'Software Maintenance',
          description: 'Monthly software maintenance and support',
          default_price: 1000,
          currency: 'USD',
          category: 'Support',
          is_recurring: true
        }
      ];

      await supabase.from('services').insert(sampleServices);
      setNeedsInitialization(false);
      await loadDashboardData();
    } catch (error) {
      console.error('Error initializing sample data:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const getDashboardTitle = () => {
    const role = userProfile?.role || 'user';
    switch (role) {
      case 'admin': return 'Admin Dashboard';
      case 'accountant': return 'Accounting Dashboard';
      case 'user': return 'User Dashboard';
      case 'viewer': return 'Financial Overview';
      default: return 'Dashboard';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{getDashboardTitle()}</h2>
          <p className="text-gray-600">
            Welcome back, {userProfile?.full_name || 'User'}! Here's your financial overview.
          </p>
        </div>
        <div className="flex space-x-3">
          {isAdmin && (
            <button
              onClick={() => window.location.href = '#admin-dashboard'}
              className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
            >
              <Shield className="h-4 w-4" />
              <span>Admin View</span>
            </button>
          )}
          {needsInitialization && (
            <button
              onClick={handleInitializeSampleData}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Initialize Sample Data
            </button>
          )}
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-blue-50 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900">Total Customers</h3>
              <p className="text-3xl font-bold text-blue-600">{stats.totalCustomers}</p>
              <p className="text-sm text-blue-700">
                {stats.localCustomers} Local, {stats.foreignCustomers} Foreign
              </p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-green-50 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-green-900">Outstanding Invoices</h3>
              <p className="text-3xl font-bold text-green-600">{stats.outstandingInvoices}</p>
              <p className="text-sm text-green-700">
                ${stats.totalOutstanding.toLocaleString()} total
              </p>
            </div>
            <FileText className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-purple-50 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-purple-900">Total Received</h3>
              <p className="text-3xl font-bold text-purple-600">${stats.totalReceived.toLocaleString()}</p>
              <p className="text-sm text-purple-700">
                {stats.totalPayments} payments
              </p>
            </div>
            <CreditCard className="h-8 w-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-orange-50 p-6 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-orange-900">Cash Incentives</h3>
              <p className="text-3xl font-bold text-orange-600">{stats.pendingIncentives}</p>
              <p className="text-sm text-orange-700">
                {stats.upcomingDeadlines} deadlines approaching
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Recent Invoices</h3>
          <div className="space-y-2">
            {recentInvoices.map((invoice) => (
              <div key={invoice.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{invoice.invoice_number}</p>
                  <p className="text-sm text-gray-600">{invoice.customer_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">${invoice.total_amount.toLocaleString()}</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    invoice.status === 'sent' ? "bg-green-100 text-green-800" :
                    invoice.status === 'draft' ? "bg-yellow-100 text-yellow-800" :
                    "bg-gray-100 text-gray-800"
                  }`}>
                    {invoice.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Cash Incentive Alerts</h3>
          <div className="space-y-2">
            {incentiveAlerts.length > 0 ? (
              incentiveAlerts.map((incentive) => (
                <div key={incentive.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                  <div>
                    <p className="font-medium">{incentive.customer_name}</p>
                    <p className="text-sm text-gray-600">
                      ${incentive.expected_incentive.toFixed(2)} expected
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${
                      incentive.alert_level === 'red' ? "text-red-600" :
                      incentive.alert_level === 'yellow' ? "text-yellow-600" :
                      "text-green-600"
                    }`}>
                      {incentive.days_remaining} days
                    </p>
                    <p className="text-xs text-gray-600">remaining</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>No upcoming deadlines</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}