import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, UserCheck, UserX, Key } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface User {
  id: string;
  auth_user_id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'accountant' | 'user' | 'viewer';
  permissions: Record<string, boolean>;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

interface Permission {
  key: string;
  label: string;
  description: string;
  category: string;
}

const availablePermissions: Permission[] = [
  // Invoice permissions
  { key: 'invoices.create', label: 'Create Invoices', description: 'Can create new invoices', category: 'Invoices' },
  { key: 'invoices.edit', label: 'Edit Invoices', description: 'Can edit existing invoices', category: 'Invoices' },
  { key: 'invoices.delete', label: 'Delete Invoices', description: 'Can delete invoices', category: 'Invoices' },
  { key: 'invoices.send', label: 'Send Invoices', description: 'Can send invoices to customers', category: 'Invoices' },
  
  // Payment permissions
  { key: 'payments.create', label: 'Record Payments', description: 'Can record new payments', category: 'Payments' },
  { key: 'payments.edit', label: 'Edit Payments', description: 'Can edit payment details', category: 'Payments' },
  { key: 'payments.delete', label: 'Delete Payments', description: 'Can delete payments', category: 'Payments' },
  { key: 'payments.clear', label: 'Clear Payments', description: 'Can mark payments as cleared', category: 'Payments' },
  
  // Journal permissions
  { key: 'journals.create', label: 'Create Journal Entries', description: 'Can create manual journal entries', category: 'Journals' },
  { key: 'journals.edit', label: 'Edit Journal Entries', description: 'Can edit journal entries', category: 'Journals' },
  { key: 'journals.post', label: 'Post Journal Entries', description: 'Can post journal entries', category: 'Journals' },
  { key: 'journals.reverse', label: 'Reverse Journal Entries', description: 'Can reverse posted entries', category: 'Journals' },
  
  // FX permissions
  { key: 'fx.edit', label: 'Edit FX Rates', description: 'Can modify exchange rates', category: 'FX Rates' },
  { key: 'fx.delete', label: 'Delete FX Rates', description: 'Can delete exchange rates', category: 'FX Rates' },
  
  // Expense permissions
  { key: 'expenses.create', label: 'Create Expenses', description: 'Can record new expenses', category: 'Expenses' },
  { key: 'expenses.edit', label: 'Edit Expenses', description: 'Can edit expense details', category: 'Expenses' },
  { key: 'expenses.delete', label: 'Delete Expenses', description: 'Can delete expenses', category: 'Expenses' },
  
  // Report permissions
  { key: 'reports.view', label: 'View Reports', description: 'Can access financial reports', category: 'Reports' },
  { key: 'reports.export', label: 'Export Reports', description: 'Can export reports to CSV', category: 'Reports' },
  
  // Admin permissions
  { key: 'users.manage', label: 'Manage Users', description: 'Can create, edit, and delete users', category: 'Administration' },
  { key: 'audit.view', label: 'View Audit Trail', description: 'Can access audit trail', category: 'Administration' },
  { key: 'system.configure', label: 'System Configuration', description: 'Can modify system settings', category: 'Administration' },
];

const rolePermissions: Record<string, string[]> = {
  admin: availablePermissions.map(p => p.key),
  accountant: [
    'invoices.create', 'invoices.edit', 'invoices.send',
    'payments.create', 'payments.edit', 'payments.clear',
    'journals.create', 'journals.edit', 'journals.post',
    'fx.edit', 'expenses.create', 'expenses.edit',
    'reports.view', 'reports.export', 'audit.view'
  ],
  user: [
    'invoices.create', 'invoices.edit',
    'payments.create', 'payments.edit',
    'expenses.create', 'expenses.edit',
    'reports.view'
  ],
  viewer: [
    'reports.view'
  ]
};

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'user' as 'admin' | 'accountant' | 'user' | 'viewer',
    permissions: {} as Record<string, boolean>,
    password: '',
  });

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    // Update permissions when role changes
    const defaultPermissions: Record<string, boolean> = {};
    availablePermissions.forEach(permission => {
      defaultPermissions[permission.key] = rolePermissions[formData.role].includes(permission.key);
    });
    setFormData(prev => ({ ...prev, permissions: defaultPermissions }));
  }, [formData.role]);

  const loadUsers = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update existing user
        await supabase
          .from('users')
          .update({
            full_name: formData.full_name,
            role: formData.role,
            permissions: formData.permissions,
          })
          .eq('id', editingUser.id);
      } else {
        // Create new user
        const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
          email: formData.email,
          password: formData.password,
          email_confirm: true,
        });

        if (authError) throw authError;

        // Create user profile
        await supabase
          .from('users')
          .insert({
            auth_user_id: authUser.user.id,
            email: formData.email,
            full_name: formData.full_name,
            role: formData.role,
            permissions: formData.permissions,
          });
      }

      await loadUsers();
      resetForm();
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error saving user. Please try again.');
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      const user = users.find(u => u.id === userId);
      if (user) {
        // Delete from auth
        await supabase.auth.admin.deleteUser(user.auth_user_id);
        
        // Delete from users table (should cascade)
        await supabase
          .from('users')
          .delete()
          .eq('id', userId);
      }

      await loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error deleting user. Please try again.');
    }
  };

  const toggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await supabase
        .from('users')
        .update({ is_active: !isActive })
        .eq('id', userId);

      await loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
    }
  };

  const resetPassword = async (user: User) => {
    const newPassword = prompt('Enter new password for ' + user.email + ':');
    if (!newPassword) return;

    try {
      await supabase.auth.admin.updateUserById(user.auth_user_id, {
        password: newPassword
      });

      alert('Password updated successfully');
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Error resetting password. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      email: '',
      full_name: '',
      role: 'user',
      permissions: {},
      password: '',
    });
    setEditingUser(null);
    setShowForm(false);
  };

  const editUser = (user: User) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions || {},
      password: '',
    });
    setShowForm(true);
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800';
      case 'accountant': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-green-100 text-green-800';
      case 'viewer': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const groupedPermissions = availablePermissions.reduce((groups: Record<string, Permission[]>, permission) => {
    if (!groups[permission.category]) {
      groups[permission.category] = [];
    }
    groups[permission.category].push(permission);
    return groups;
  }, {});

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
          <Users className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">User Management</h2>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>{showForm ? 'Cancel' : 'Add User'}</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-lg shadow border">
          <h3 className="text-lg font-semibold mb-4">
            {editingUser ? 'Edit User' : 'Add New User'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="user@example.com"
                  disabled={!!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">Viewer</option>
                  <option value="user">User</option>
                  <option value="accountant">Accountant</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    required={!editingUser}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                    minLength={6}
                  />
                </div>
              )}
            </div>

            {/* Permissions */}
            <div>
              <h4 className="text-md font-semibold mb-3">Permissions</h4>
              <div className="space-y-4">
                {Object.entries(groupedPermissions).map(([category, permissions]) => (
                  <div key={category} className="border rounded-lg p-4">
                    <h5 className="font-medium text-gray-900 mb-3">{category}</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {permissions.map((permission) => (
                        <label key={permission.key} className="flex items-start space-x-3">
                          <input
                            type="checkbox"
                            checked={formData.permissions[permission.key] || false}
                            onChange={(e) => setFormData({
                              ...formData,
                              permissions: {
                                ...formData.permissions,
                                [permission.key]: e.target.checked
                              }
                            })}
                            className="mt-1"
                          />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{permission.label}</div>
                            <div className="text-xs text-gray-500">{permission.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                {editingUser ? 'Update User' : 'Create User'}
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

      {/* Users List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => toggleUserStatus(user.id, user.is_active)}
                      className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full transition-colors ${
                        user.is_active 
                          ? "bg-green-100 text-green-800 hover:bg-green-200" 
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      }`}
                    >
                      {user.is_active ? (
                        <>
                          <UserCheck className="h-3 w-3 mr-1" />
                          Active
                        </>
                      ) : (
                        <>
                          <UserX className="h-3 w-3 mr-1" />
                          Inactive
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => editUser(user)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="Edit user"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => resetPassword(user)}
                        className="text-yellow-600 hover:text-yellow-900 p-1"
                        title="Reset password"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete user"
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

      {users.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No users yet</h3>
          <p className="text-gray-500 mb-4">Create your first user to get started.</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add User
          </button>
        </div>
      )}
    </div>
  );
}