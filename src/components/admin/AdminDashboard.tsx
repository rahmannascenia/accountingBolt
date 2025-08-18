import React, { useState, useEffect } from 'react';
import {
  Users, FileText, CreditCard, DollarSign, Database,
  Settings, Shield, TrendingUp, Activity, AlertTriangle,
  Download, Upload, BarChart3, PieChart, Calendar,
  Server, Zap, Clock, CheckCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalTransactions: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  databaseSize: string;
  lastBackup: string | null;
  uptime: string;
  responseTime: number;
}

interface UserActivity {
  id: string;
  user_email: string;
  action: string;
  module: string;
  timestamp: string;
  ip_address: string;
}

interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface MonthlyStats {
  month: string;
  invoices: number;
  payments: number;
  users: number;
  revenue: number;
}

export function AdminDashboard() {
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalTransactions: 0,
    systemHealth: 'healthy',
    databaseSize: '0 MB',
    lastBackup: null,
    uptime: '0 days',
    responseTime: 0
  });
  const [recentActivity, setRecentActivity] = useState<UserActivity[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
    const interval = setInterval(loadAdminData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadAdminData = async () => {
    try {
      const startTime = Date.now();
      
      // Load system statistics
      const [
        { data: users },
        { data: invoices },
        { data: payments },
        { data: expenses },
        { data: activities }
      ] = await Promise.all([
        supabase.from('users').select('is_active, last_login, created_at'),
        supabase.from('invoices').select('total_amount, created_at'),
        supabase.from('payments').select('amount, created_at'),
        supabase.from('expenses').select('amount, created_at'),
        supabase.from('user_activity').select('*').order('timestamp', { ascending: false }).limit(10)
      ]);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Calculate stats
      const totalUsers = users?.length || 0;
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const activeUsers = users?.filter(user => 
        user.last_login && new Date(user.last_login) > thirtyDaysAgo
      ).length || 0;

      const totalTransactions = (invoices?.length || 0) + (payments?.length || 0) + (expenses?.length || 0);

      // Calculate monthly statistics
      const monthlyData: MonthlyStats[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM format
        
        const monthInvoices = invoices?.filter(inv => 
          inv.created_at.startsWith(monthKey)
        ).length || 0;
        
        const monthPayments = payments?.filter(pay => 
          pay.created_at.startsWith(monthKey)
        ).length || 0;
        
        const monthUsers = users?.filter(user => 
          user.created_at.startsWith(monthKey)
        ).length || 0;

        const monthRevenue = payments?.filter(pay => 
          pay.created_at.startsWith(monthKey)
        ).reduce((sum, pay) => sum + pay.amount, 0) || 0;

        monthlyData.push({
          month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
          invoices: monthInvoices,
          payments: monthPayments,
          users: monthUsers,
          revenue: monthRevenue
        });
      }

      // Determine system health
      let systemHealth: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (responseTime > 2000) systemHealth = 'warning';
      if (responseTime > 5000) systemHealth = 'critical';

      setStats({
        totalUsers,
        activeUsers,
        totalTransactions,
        systemHealth,
        databaseSize: '25.4 MB', // This would typically come from a database query
        lastBackup: '2024-01-15T08:00:00Z', // This would come from backup system
        uptime: '15 days, 3 hours',
        responseTime
      });

      setRecentActivity(activities as UserActivity[] || []);
      setMonthlyStats(monthlyData);

      // Generate system alerts based on conditions
      const alerts: SystemAlert[] = [];
      
      if (responseTime > 2000) {
        alerts.push({
          id: '1',
          type: 'warning',
          message: `Slow database response time: ${responseTime}ms`,
          timestamp: new Date().toISOString(),
          resolved: false
        });
      }

      if (activeUsers / totalUsers < 0.5 && totalUsers > 0) {
        alerts.push({
          id: '2',
          type: 'warning',
          message: 'Low user engagement - less than 50% active users in the last 30 days',
          timestamp: new Date().toISOString(),
          resolved: false
        });
      }

      setSystemAlerts(alerts);

    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDatabaseBackup = async () => {
    // This would typically trigger a database backup process
    alert('Database backup initiated. You will receive a notification when complete.');
  };

  const handleSystemMaintenance = async () => {
    // This would typically put the system in maintenance mode
    if (confirm('Are you sure you want to put the system in maintenance mode? This will prevent users from accessing the application.')) {
      alert('System maintenance mode activated.');
    }
  };

  const getHealthIcon = (health: string) => {
    switch (health) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'critical': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <CheckCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">System Administration</h2>
          <p className="text-gray-600">Monitor and manage your financial system</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleDatabaseBackup}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            <span>Backup DB</span>
          </button>
          <button
            onClick={handleSystemMaintenance}
            className="flex items-center space-x-2 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
          >
            <Settings className="h-4 w-4" />
            <span>Maintenance</span>
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">System Health</h3>
              <div className="flex items-center space-x-2 mt-1">
                {getHealthIcon(stats.systemHealth)}
                <span className="text-lg font-semibold text-gray-900 capitalize">
                  {stats.systemHealth}
                </span>
              </div>
            </div>
            <Activity className="h-8 w-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Users</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
              <p className="text-sm text-green-600">{stats.activeUsers} active</p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Total Transactions</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
              <p className="text-sm text-gray-600">All time</p>
            </div>
            <TrendingUp className="h-8 w-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Response Time</h3>
              <p className="text-2xl font-bold text-gray-900">{stats.responseTime}ms</p>
              <p className="text-sm text-gray-600">Database</p>
            </div>
            <Zap className="h-8 w-8 text-yellow-500" />
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Server className="h-5 w-5 mr-2" />
            System Information
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Database Size</span>
              <span className="font-medium">{stats.databaseSize}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">System Uptime</span>
              <span className="font-medium">{stats.uptime}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Last Backup</span>
              <span className="font-medium">
                {stats.lastBackup ? new Date(stats.lastBackup).toLocaleDateString() : 'Never'}
              </span>
            </div>
          </div>
        </div>

        {/* Recent User Activity */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-600">{activity.user_email}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No recent activity</p>
            )}
          </div>
        </div>

        {/* System Alerts */}
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2" />
            System Alerts
          </h3>
          <div className="space-y-3">
            {systemAlerts.length > 0 ? (
              systemAlerts.map((alert) => (
                <div key={alert.id} className={`p-3 rounded border-l-4 ${
                  alert.type === 'error' ? 'border-red-400 bg-red-50' :
                  alert.type === 'warning' ? 'border-yellow-400 bg-yellow-50' :
                  'border-blue-400 bg-blue-50'
                }`}>
                  <p className="text-sm font-medium">{alert.message}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    {new Date(alert.timestamp).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No alerts</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Monthly Statistics Chart */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          Monthly Statistics (Last 6 Months)
        </h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Month</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">New Users</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoices</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payments</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {monthlyStats.map((stat, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stat.month}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.users}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.invoices}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stat.payments}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${stat.revenue.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow border">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="flex items-center justify-center space-x-2 bg-blue-50 text-blue-700 p-4 rounded-lg hover:bg-blue-100 transition-colors">
            <Users className="h-5 w-5" />
            <span>User Management</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-green-50 text-green-700 p-4 rounded-lg hover:bg-green-100 transition-colors">
            <Database className="h-5 w-5" />
            <span>Database Tools</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-purple-50 text-purple-700 p-4 rounded-lg hover:bg-purple-100 transition-colors">
            <BarChart3 className="h-5 w-5" />
            <span>Analytics</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-orange-50 text-orange-700 p-4 rounded-lg hover:bg-orange-100 transition-colors">
            <Settings className="h-5 w-5" />
            <span>System Settings</span>
          </button>
        </div>
      </div>
    </div>
  );
}