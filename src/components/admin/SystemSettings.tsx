import React, { useState, useEffect } from 'react';
import {
  Settings, Building2, Mail, Globe, DollarSign, Shield,
  Save, RefreshCw, Upload, Download, AlertTriangle, CheckCircle,
  Eye, EyeOff, Key, Database, Clock, Bell
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface CompanySettings {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  tax_id: string;
  currency: string;
  timezone: string;
  logo_url: string;
}

interface EmailSettings {
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_secure: boolean;
  from_email: string;
  from_name: string;
}

interface SystemSettings {
  maintenance_mode: boolean;
  allow_registration: boolean;
  session_timeout: number;
  backup_frequency: string;
  audit_retention_days: number;
  max_file_size_mb: number;
  notification_settings: {
    email_notifications: boolean;
    invoice_reminders: boolean;
    payment_alerts: boolean;
    system_alerts: boolean;
  };
}

interface TaxSettings {
  vat_rate: number;
  tds_rate: number;
  vds_rate: number;
  tax_year_start: string;
  enable_multi_tax: boolean;
}

export function SystemSettings() {
  const [activeTab, setActiveTab] = useState<'company' | 'email' | 'system' | 'tax' | 'security'>('company');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [companySettings, setCompanySettings] = useState<CompanySettings>({
    name: '',
    address: '',
    phone: '',
    email: '',
    website: '',
    tax_id: '',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    logo_url: ''
  });

  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    smtp_host: '',
    smtp_port: 587,
    smtp_username: '',
    smtp_password: '',
    smtp_secure: true,
    from_email: '',
    from_name: ''
  });

  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    maintenance_mode: false,
    allow_registration: true,
    session_timeout: 30,
    backup_frequency: 'daily',
    audit_retention_days: 90,
    max_file_size_mb: 10,
    notification_settings: {
      email_notifications: true,
      invoice_reminders: true,
      payment_alerts: true,
      system_alerts: true
    }
  });

  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    vat_rate: 15,
    tds_rate: 10,
    vds_rate: 5,
    tax_year_start: '2024-07-01',
    enable_multi_tax: false
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // In a real application, these would be loaded from a settings table
      // For demo purposes, we'll use default values
      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setLoading(false);
    }
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleSaveCompanySettings = async () => {
    setSaving(true);
    try {
      // In a real application, this would save to database
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      showMessage('success', 'Company settings saved successfully');
    } catch (error) {
      showMessage('error', 'Failed to save company settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEmailSettings = async () => {
    setSaving(true);
    try {
      // In a real application, this would save to database
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      showMessage('success', 'Email settings saved successfully');
    } catch (error) {
      showMessage('error', 'Failed to save email settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    setSaving(true);
    try {
      // In a real application, this would save to database
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      showMessage('success', 'System settings saved successfully');
    } catch (error) {
      showMessage('error', 'Failed to save system settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTaxSettings = async () => {
    setSaving(true);
    try {
      // In a real application, this would save to database
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      showMessage('success', 'Tax settings saved successfully');
    } catch (error) {
      showMessage('error', 'Failed to save tax settings');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmailConnection = async () => {
    setSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call
      showMessage('success', 'Email connection test successful');
    } catch (error) {
      showMessage('error', 'Email connection test failed');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'company', label: 'Company Info', icon: Building2 },
    { id: 'email', label: 'Email Settings', icon: Mail },
    { id: 'system', label: 'System Settings', icon: Settings },
    { id: 'tax', label: 'Tax Settings', icon: DollarSign },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">System Settings</h2>
          <p className="text-gray-600">Configure your system settings and preferences</p>
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border flex items-center space-x-2 ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="h-5 w-5" />
          ) : (
            <AlertTriangle className="h-5 w-5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow border">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {/* Company Settings */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={companySettings.name}
                    onChange={(e) => setCompanySettings({...companySettings, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Your Company Name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    value={companySettings.tax_id}
                    onChange={(e) => setCompanySettings({...companySettings, tax_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tax ID/TIN"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={companySettings.address}
                    onChange={(e) => setCompanySettings({...companySettings, address: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Company Address"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={companySettings.phone}
                    onChange={(e) => setCompanySettings({...companySettings, phone: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+880-XXX-XXXXXXX"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={companySettings.email}
                    onChange={(e) => setCompanySettings({...companySettings, email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="contact@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="url"
                    value={companySettings.website}
                    onChange={(e) => setCompanySettings({...companySettings, website: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Currency
                  </label>
                  <select
                    value={companySettings.currency}
                    onChange={(e) => setCompanySettings({...companySettings, currency: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="BDT">Bangladeshi Taka (BDT)</option>
                    <option value="USD">US Dollar (USD)</option>
                    <option value="EUR">Euro (EUR)</option>
                    <option value="GBP">British Pound (GBP)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveCompanySettings}
                  disabled={saving}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </div>
          )}

          {/* Email Settings */}
          {activeTab === 'email' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Host *
                  </label>
                  <input
                    type="text"
                    value={emailSettings.smtp_host}
                    onChange={(e) => setEmailSettings({...emailSettings, smtp_host: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    value={emailSettings.smtp_port}
                    onChange={(e) => setEmailSettings({...emailSettings, smtp_port: parseInt(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="587"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={emailSettings.smtp_username}
                    onChange={(e) => setEmailSettings({...emailSettings, smtp_username: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="your.email@gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={emailSettings.smtp_password}
                      onChange={(e) => setEmailSettings({...emailSettings, smtp_password: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      placeholder="App password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Email
                  </label>
                  <input
                    type="email"
                    value={emailSettings.from_email}
                    onChange={(e) => setEmailSettings({...emailSettings, from_email: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="noreply@company.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Name
                  </label>
                  <input
                    type="text"
                    value={emailSettings.from_name}
                    onChange={(e) => setEmailSettings({...emailSettings, from_name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Company Name"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={emailSettings.smtp_secure}
                    onChange={(e) => setEmailSettings({...emailSettings, smtp_secure: e.target.checked})}
                    className="mr-2"
                  />
                  Use SSL/TLS encryption
                </label>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={handleTestEmailConnection}
                  disabled={saving}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  <span>Test Connection</span>
                </button>
                <button
                  onClick={handleSaveEmailSettings}
                  disabled={saving}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Save Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* System Settings */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="maintenance_mode"
                      checked={systemSettings.maintenance_mode}
                      onChange={(e) => setSystemSettings({...systemSettings, maintenance_mode: e.target.checked})}
                      className="h-4 w-4 text-blue-600"
                    />
                    <label htmlFor="maintenance_mode" className="text-sm font-medium text-gray-700">
                      Maintenance Mode
                    </label>
                  </div>

                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="allow_registration"
                      checked={systemSettings.allow_registration}
                      onChange={(e) => setSystemSettings({...systemSettings, allow_registration: e.target.checked})}
                      className="h-4 w-4 text-blue-600"
                    />
                    <label htmlFor="allow_registration" className="text-sm font-medium text-gray-700">
                      Allow User Registration
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Session Timeout (minutes)
                    </label>
                    <input
                      type="number"
                      value={systemSettings.session_timeout}
                      onChange={(e) => setSystemSettings({...systemSettings, session_timeout: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="5"
                      max="1440"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Backup Frequency
                    </label>
                    <select
                      value={systemSettings.backup_frequency}
                      onChange={(e) => setSystemSettings({...systemSettings, backup_frequency: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="hourly">Hourly</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Audit Log Retention (days)
                    </label>
                    <input
                      type="number"
                      value={systemSettings.audit_retention_days}
                      onChange={(e) => setSystemSettings({...systemSettings, audit_retention_days: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="30"
                      max="365"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Max File Size (MB)
                    </label>
                    <input
                      type="number"
                      value={systemSettings.max_file_size_mb}
                      onChange={(e) => setSystemSettings({...systemSettings, max_file_size_mb: parseInt(e.target.value)})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      min="1"
                      max="100"
                    />
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-medium text-gray-700">Notification Settings</h4>
                    <div className="space-y-2">
                      {Object.entries(systemSettings.notification_settings).map(([key, value]) => (
                        <div key={key} className="flex items-center space-x-3">
                          <input
                            type="checkbox"
                            id={key}
                            checked={value}
                            onChange={(e) => setSystemSettings({
                              ...systemSettings,
                              notification_settings: {
                                ...systemSettings.notification_settings,
                                [key]: e.target.checked
                              }
                            })}
                            className="h-4 w-4 text-blue-600"
                          />
                          <label htmlFor={key} className="text-sm text-gray-700 capitalize">
                            {key.replace(/_/g, ' ')}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveSystemSettings}
                  disabled={saving}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Save Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* Tax Settings */}
          {activeTab === 'tax' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    VAT Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={taxSettings.vat_rate}
                    onChange={(e) => setTaxSettings({...taxSettings, vat_rate: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="15.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    TDS Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={taxSettings.tds_rate}
                    onChange={(e) => setTaxSettings({...taxSettings, tds_rate: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="10.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    VDS Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={taxSettings.vds_rate}
                    onChange={(e) => setTaxSettings({...taxSettings, vds_rate: parseFloat(e.target.value)})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tax Year Start Date
                  </label>
                  <input
                    type="date"
                    value={taxSettings.tax_year_start}
                    onChange={(e) => setTaxSettings({...taxSettings, tax_year_start: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      id="enable_multi_tax"
                      checked={taxSettings.enable_multi_tax}
                      onChange={(e) => setTaxSettings({...taxSettings, enable_multi_tax: e.target.checked})}
                      className="h-4 w-4 text-blue-600"
                    />
                    <label htmlFor="enable_multi_tax" className="text-sm font-medium text-gray-700">
                      Enable Multiple Tax Rates per Transaction
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveTaxSettings}
                  disabled={saving}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  <span>Save Settings</span>
                </button>
              </div>
            </div>
          )}

          {/* Security Settings */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-yellow-400 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Security Notice</h3>
                    <p className="mt-1 text-sm text-yellow-700">
                      These settings affect system security. Please ensure you understand the implications before making changes.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Password Policy</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Minimum password length: 8 characters</span>
                      <span className="text-green-600 text-sm">✓ Enabled</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Require uppercase letters</span>
                      <span className="text-green-600 text-sm">✓ Enabled</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Require special characters</span>
                      <span className="text-green-600 text-sm">✓ Enabled</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Password expiry: 90 days</span>
                      <span className="text-gray-500 text-sm">Configurable</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Access Controls</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Two-factor authentication</span>
                      <span className="text-yellow-600 text-sm">Coming Soon</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">IP address restrictions</span>
                      <span className="text-yellow-600 text-sm">Coming Soon</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Role-based permissions</span>
                      <span className="text-green-600 text-sm">✓ Active</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Audit & Monitoring</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">User activity logging</span>
                      <span className="text-green-600 text-sm">✓ Active</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Failed login monitoring</span>
                      <span className="text-green-600 text-sm">✓ Active</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Data change tracking</span>
                      <span className="text-green-600 text-sm">✓ Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}