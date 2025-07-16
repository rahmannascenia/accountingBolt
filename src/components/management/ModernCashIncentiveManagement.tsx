import React, { useState, useEffect } from 'react';
import { DollarSign, Clock, CheckCircle, AlertTriangle, Upload, FileText, Filter, Shield } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';

interface CashIncentive {
  id: string;
  payment_id: string;
  customer_id: string;
  eligible_amount: number;
  incentive_rate: number;
  expected_incentive: number;
  actual_incentive: number | null;
  submission_deadline: string;
  status: 'pending' | 'documents_prepared' | 'submitted' | 'received' | 'expired' | 'rejected';
  documents_submitted: boolean;
  submission_date: string | null;
  received_date: string | null;
  notes: string | null;
  customers?: { name: string } | null;
  payments?: { payment_number: string; currency: string } | null;
}

interface WorkflowAction {
  id: string;
  status: string;
  action_date: string;
  user_id: string;
  notes: string | null;
  document_url: string | null;
}

interface StatusOption {
  value: string;
  label: string;
  color: string;
  icon: React.ComponentType<{ className: string }>;
  description: string;
}

const statusOptions: StatusOption[] = [
  {
    value: 'documents_prepared',
    label: 'Documents Ready',
    color: 'bg-yellow-500 hover:bg-yellow-600',
    icon: FileText,
    description: 'All required documents have been prepared and are ready for submission'
  },
  {
    value: 'submitted',
    label: 'Sent to Bank',
    color: 'bg-blue-500 hover:bg-blue-600',
    icon: Upload,
    description: 'Documents have been submitted to the bank for processing'
  },
  {
    value: 'received',
    label: 'Received',
    color: 'bg-green-500 hover:bg-green-600',
    icon: CheckCircle,
    description: 'Cash incentive has been received from the bank'
  },
  {
    value: 'rejected',
    label: 'Rejected',
    color: 'bg-red-500 hover:bg-red-600',
    icon: AlertTriangle,
    description: 'Application was rejected by the bank'
  }
];

export function ModernCashIncentiveManagement() {
  const [incentives, setIncentives] = useState<CashIncentive[]>([]);
  const [selectedIncentive, setSelectedIncentive] = useState<CashIncentive | null>(null);
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowAction[]>([]);
  const [showWorkflow, setShowWorkflow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionNotes, setActionNotes] = useState('');
  const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0]);
  const [actualAmount, setActualAmount] = useState('');
  const [filters, setFilters] = useState({
    status: ''
  });
  const { user } = useAuth();
  const [currentUserRole, setCurrentUserRole] = useState<string>('');

  useEffect(() => {
    loadIncentives();
    loadUserRole();
  }, [loadIncentives, loadUserRole]);

  useEffect(() => {
    loadIncentives();
  }, [filters, loadIncentives]);

  const loadUserRole = async () => {
    try {
      const { data } = await supabase
        .from('users')
        .select('role')
        .eq('auth_user_id', user?.id)
        .single();
      
      if (data) {
        setCurrentUserRole(data.role);
      }
    } catch (error) {
      console.error('Error loading user role:', error);
    }
  };
  const loadIncentives = async () => {
    try {
      let query = supabase
        .from('cash_incentives')
        .select(`
          *,
          customers!inner(name),
          payments!inner(payment_number, currency)
        `)
        .order('created_at', { ascending: false });

      // Apply status filter if selected
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data } = await query;

      if (data) setIncentives(data);
    } catch (error) {
      console.error('Error loading incentives:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadWorkflowHistory = async (incentiveId: string) => {
    try {
      const { data } = await supabase
        .from('cash_incentive_workflow')
        .select('*')
        .eq('incentive_id', incentiveId)
        .order('action_date', { ascending: false });

      if (data) setWorkflowHistory(data);
    } catch (error) {
      console.error('Error loading workflow history:', error);
    }
  };

  const handleStatusUpdate = async (incentive: CashIncentive, _newStatus: string) => {
    setSelectedIncentive(incentive);
    setActionNotes('');
    setActionDate(new Date().toISOString().split('T')[0]);
    setActualAmount(incentive.expected_incentive.toString());
    
    await loadWorkflowHistory(incentive.id);
    setShowWorkflow(true);
  };

  const handleOverrideStatus = async (incentive: CashIncentive) => {
    setSelectedIncentive(incentive);
    setActionNotes('');
    setActionDate(new Date().toISOString().split('T')[0]);
    setActualAmount(incentive.expected_incentive.toString());
    
    await loadWorkflowHistory(incentive.id);
    setShowWorkflow(true);
  };

  const confirmStatusUpdate = async (newStatus: string) => {
    if (!selectedIncentive) return;

    try {
      const updateData: Partial<CashIncentive> = { status: newStatus as CashIncentive['status'] };
      
      // Set specific fields based on status
      switch (newStatus) {
        case 'documents_prepared':
          updateData.documents_submitted = true;
          break;
        case 'submitted':
          updateData.submission_date = actionDate;
          break;
        case 'received':
          updateData.received_date = actionDate;
          updateData.actual_incentive = parseFloat(actualAmount);
          break;
      }

      // Update the incentive
      await supabase
        .from('cash_incentives')
        .update(updateData)
        .eq('id', selectedIncentive.id);

      // Log the workflow action
      await supabase
        .from('cash_incentive_workflow')
        .insert({
          incentive_id: selectedIncentive.id,
          status: newStatus,
          action_date: actionDate,
          notes: actionNotes || null,
        });

      // Log audit trail
      await supabase.rpc('log_audit_trail', {
        p_table_name: 'cash_incentives',
        p_record_id: selectedIncentive.id,
        p_operation_type: 'UPDATE',
        p_new_values: JSON.stringify(updateData),
        p_description: `Cash incentive status updated to ${newStatus}`,
        p_module: 'cash_incentives'
      });

      setShowWorkflow(false);
      setSelectedIncentive(null);
      await loadIncentives();
    } catch (error) {
      console.error('Error updating incentive status:', error);
    }
  };

  const calculateDaysRemaining = (deadline: string) => {
    const today = new Date();
    const deadlineDate = new Date(deadline);
    return Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'received': return 'bg-green-100 text-green-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'documents_prepared': return 'bg-yellow-100 text-yellow-800';
      case 'pending': return 'bg-orange-100 text-orange-800';
      case 'expired': return 'bg-red-100 text-red-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertColor = (daysRemaining: number) => {
    if (daysRemaining <= 10) return 'text-red-600 font-bold';
    if (daysRemaining <= 30) return 'text-yellow-600 font-semibold';
    return 'text-green-600';
  };

  const getAvailableActions = (status: string) => {
    switch (status) {
      case 'pending':
        return statusOptions.filter(opt => opt.value === 'documents_prepared');
      case 'documents_prepared':
        return statusOptions.filter(opt => ['submitted', 'rejected'].includes(opt.value));
      case 'submitted':
        return statusOptions.filter(opt => ['received', 'rejected'].includes(opt.value));
      default:
        return [];
    }
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
          <DollarSign className="h-8 w-8 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-900">Modern Cash Incentive Management</h2>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="documents_prepared">Documents Ready</option>
            <option value="submitted">Submitted</option>
            <option value="received">Received</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {/* Summary Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-orange-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-orange-900">Pending</h3>
              <p className="text-2xl font-bold text-orange-600">
                {incentives.filter(i => i.status === 'pending').length}
              </p>
            </div>
            <Clock className="h-8 w-8 text-orange-600" />
          </div>
        </div>
        
        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-yellow-900">Documents Ready</h3>
              <p className="text-2xl font-bold text-yellow-600">
                {incentives.filter(i => i.status === 'documents_prepared').length}
              </p>
            </div>
            <FileText className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
        
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-blue-900">Submitted</h3>
              <p className="text-2xl font-bold text-blue-600">
                {incentives.filter(i => i.status === 'submitted').length}
              </p>
            </div>
            <Upload className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-green-900">Received</h3>
              <p className="text-2xl font-bold text-green-600">
                {incentives.filter(i => i.status === 'received').length}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-red-900">Rejected/Expired</h3>
              <p className="text-2xl font-bold text-red-600">
                {incentives.filter(i => ['rejected', 'expired'].includes(i.status)).length}
              </p>
            </div>
            <AlertTriangle className="h-8 w-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Incentives Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {incentives.map((incentive) => {
          const daysRemaining = calculateDaysRemaining(incentive.submission_deadline);
          const availableActions = getAvailableActions(incentive.status);
          
          return (
            <div key={incentive.id} className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {incentive.customers?.name || 'Unknown Customer'}
                    </h3>
                    <p className="text-sm text-gray-600">
                      Payment: {incentive.payments?.payment_number || 'Unknown'}
                    </p>
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(incentive.status)}`}>
                    {incentive.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Eligible Amount:</span>
                    <span className="text-sm font-medium">
                      {incentive.payments?.currency} {incentive.eligible_amount.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Expected Incentive:</span>
                    <span className="text-sm font-medium text-green-600">
                      ${incentive.expected_incentive.toFixed(2)}
                    </span>
                  </div>
                  
                  {incentive.actual_incentive && (
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Actual Incentive:</span>
                      <span className="text-sm font-medium text-blue-600">
                        ${incentive.actual_incentive.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Deadline:</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">{incentive.submission_deadline}</div>
                      <div className={`text-xs ${getAlertColor(daysRemaining)}`}>
                        {daysRemaining > 0 
                          ? `${daysRemaining} days remaining`
                          : `${Math.abs(daysRemaining)} days overdue`
                        }
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                {availableActions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 mb-2">Available Actions:</p>
                    {availableActions.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={action.value}
                          onClick={() => handleStatusUpdate(incentive, action.value)}
                          className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors ${action.color}`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{action.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* View History Button */}
                <button
                  onClick={() => handleStatusUpdate(incentive, 'view_history')}
                  className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  View History
                </button>

                {/* Admin Override Button */}
                {incentive.status === 'rejected' && currentUserRole === 'admin' && (
                  <button
                    onClick={() => handleOverrideStatus(incentive)}
                    className="w-full mt-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Shield className="h-4 w-4" />
                    <span>Admin Override</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Workflow Modal */}
      {showWorkflow && selectedIncentive && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b flex justify-between items-center">
              <h3 className="text-lg font-semibold">
                Cash Incentive Workflow - {selectedIncentive.customers?.name}
              </h3>
              <button
                onClick={() => setShowWorkflow(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 overflow-auto max-h-[calc(90vh-120px)]">
              {/* Current Status */}
              <div className="mb-6">
                <h4 className="text-md font-semibold mb-2">Current Status</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getStatusColor(selectedIncentive.status)}`}>
                      {selectedIncentive.status.replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-600">
                      Expected: ${selectedIncentive.expected_incentive.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Available Actions */}
              {getAvailableActions(selectedIncentive.status).length > 0 && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold mb-3">Update Status</h4>
                  <div className="space-y-3">
                    {getAvailableActions(selectedIncentive.status).map((action) => {
                      const Icon = action.icon;
                      return (
                        <div key={action.value} className="border rounded-lg p-4">
                          <div className="flex items-center space-x-3 mb-2">
                            <Icon className="h-5 w-5 text-gray-600" />
                            <span className="font-medium">{action.label}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{action.description}</p>
                          
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Action Date
                              </label>
                              <input
                                type="date"
                                value={actionDate}
                                onChange={(e) => setActionDate(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            
                            {action.value === 'received' && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Actual Amount Received
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={actualAmount}
                                  onChange={(e) => setActualAmount(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  placeholder="Enter actual amount"
                                />
                              </div>
                            )}
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Notes (Optional)
                              </label>
                              <textarea
                                value={actionNotes}
                                onChange={(e) => setActionNotes(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="Add any relevant notes..."
                              />
                            </div>
                          </div>
                          
                          <button
                            onClick={() => confirmStatusUpdate(action.value)}
                            className={`w-full mt-3 px-4 py-2 rounded-lg text-white font-medium transition-colors ${action.color}`}
                          >
                            Confirm {action.label}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Admin Override Actions for Rejected Status */}
              {selectedIncentive.status === 'rejected' && currentUserRole === 'admin' && (
                <div className="mb-6">
                  <h4 className="text-md font-semibold mb-3 text-red-900">Admin Override Actions</h4>
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center space-x-3 mb-3">
                      <Shield className="h-5 w-5 text-red-600" />
                      <span className="font-medium text-red-900">Override Rejection</span>
                    </div>
                    <p className="text-sm text-red-700 mb-4">
                      As an admin, you can override the rejection and move this incentive to a different status.
                    </p>
                    
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Override Date
                        </label>
                        <input
                          type="date"
                          value={actionDate}
                          onChange={(e) => setActionDate(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Override Notes
                        </label>
                        <textarea
                          value={actionNotes}
                          onChange={(e) => setActionNotes(e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                          placeholder="Explain the reason for overriding the rejection..."
                        />
                      </div>
                    </div>
                    
                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={() => confirmStatusUpdate('documents_prepared')}
                        className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        Override to Documents Ready
                      </button>
                      <button
                        onClick={() => confirmStatusUpdate('submitted')}
                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Override to Submitted
                      </button>
                      <button
                        onClick={() => confirmStatusUpdate('received')}
                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                      >
                        Override to Received
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Workflow History */}
              {workflowHistory.length > 0 && (
                <div>
                  <h4 className="text-md font-semibold mb-3">Workflow History</h4>
                  <div className="space-y-3">
                    {workflowHistory.map((action) => (
                      <div key={action.id} className="border-l-4 border-blue-500 pl-4 py-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(action.status)}`}>
                              {action.status.replace('_', ' ')}
                            </span>
                            <p className="text-sm text-gray-600 mt-1">
                              {new Date(action.action_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        {action.notes && (
                          <p className="text-sm text-gray-700 mt-2">{action.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {incentives.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No cash incentives yet</h3>
          <p className="text-gray-500 mb-4">
            Incentives are automatically created when foreign customer payments are cleared.
          </p>
        </div>
      )}
    </div>
  );
}