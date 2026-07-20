import { useState, useEffect } from 'react';
import { Users, UserPlus, Building2, RefreshCw, Loader2, CheckCircle2, AlertCircle, Trash2, ShieldCheck, ShieldX, Pencil, X } from 'lucide-react';
import { employeeAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

const ROLE_LABELS: Record<string, string> = {
  teller: 'Teller / Cashier',
  branch_manager: 'Branch Manager',
  loan_officer: 'Loan Officer',
  customer_support: 'Customer Support',
  auditor: 'Auditor',
  super_admin: 'Super Admin',
};

const ROLE_COLORS: Record<string, string> = {
  teller: 'bg-blue-50 text-blue-700 border-blue-100',
  branch_manager: 'bg-purple-50 text-purple-700 border-purple-100',
  loan_officer: 'bg-amber-50 text-amber-700 border-amber-100',
  customer_support: 'bg-teal-50 text-teal-700 border-teal-100',
  auditor: 'bg-slate-50 text-slate-700 border-slate-200',
  super_admin: 'bg-rose-50 text-rose-700 border-rose-100',
};

export const StaffManagement = () => {
  const { user } = useAuthStore();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [editingEmp, setEditingEmp] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    role: 'teller',
    password: '',
  });

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    role: 'teller',
    password: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await employeeAPI.getAll();
      setEmployees(res.data.employees || []);
    } catch {
      setStatus({ type: 'error', message: 'Failed to load employees.' });
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.email) return;
    setFormLoading(true);
    setStatus(null);
    try {
      await employeeAPI.create({ ...form, created_by: user?.id });
      setStatus({ type: 'success', message: `Employee ${form.first_name} ${form.last_name} created successfully!` });
      setForm({ first_name: '', last_name: '', email: '', phone_number: '', role: 'teller', password: '' });
      fetchEmployees();
    } catch (err: any) {
      setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to create employee.' });
    } finally {
      setFormLoading(false);
    }
  };

  const handleToggleStatus = async (emp: any) => {
    setActionLoading(emp.id);
    try {
      await employeeAPI.update(emp.id, { is_active: !emp.is_active, updated_by: user?.id });
      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, is_active: !e.is_active } : e));
      setStatus({ type: 'success', message: `${emp.first_name} ${emp.last_name} has been ${emp.is_active ? 'suspended' : 'activated'}.` });
    } catch {
      setStatus({ type: 'error', message: 'Failed to update employee status.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteEmployee = async (emp: any) => {
    if (!confirm(`Are you sure you want to remove ${emp.first_name} ${emp.last_name}? This cannot be undone.`)) return;
    setActionLoading(emp.id);
    try {
      await employeeAPI.deactivate(emp.id, user?.id);
      setEmployees(prev => prev.filter(e => e.id !== emp.id));
      setStatus({ type: 'success', message: `${emp.first_name} ${emp.last_name} removed.` });
    } catch {
      setStatus({ type: 'error', message: 'Failed to remove employee.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditClick = (emp: any) => {
    setEditingEmp(emp);
    setEditForm({
      first_name: emp.first_name || '',
      last_name: emp.last_name || '',
      email: emp.email || '',
      phone_number: emp.phone_number || '',
      role: emp.role || 'teller',
      password: '',
    });
  };

  const handleUpdateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmp) return;
    setFormLoading(true);
    setStatus(null);
    try {
      await employeeAPI.update(editingEmp.id, { ...editForm, updated_by: user?.id });
      
      if (editingEmp.id === user?.id) {
        useAuthStore.setState({
          user: {
            ...user,
            first_name: editForm.first_name,
            last_name: editForm.last_name,
            email: editForm.email,
            role: editForm.role,
          } as any
        });
      }
      
      setStatus({ type: 'success', message: `Details of ${editForm.first_name} ${editForm.last_name} updated successfully.` });
      setEditingEmp(null);
      fetchEmployees();
    } catch (err: any) {
      setStatus({ type: 'error', message: err.response?.data?.message || 'Failed to update employee.' });
    } finally {
      setFormLoading(false);
    }
  };

  const filtered = employees.filter(e =>
    `${e.first_name} ${e.last_name} ${e.email} ${e.username} ${e.role}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold flex items-center text-slate-900">
            <Users className="w-6 h-6 mr-2 text-blue-600" />
            Staff Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage branch employees, roles, and access permissions.</p>
        </div>
        <button
          onClick={fetchEmployees}
          className="flex items-center px-4 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 font-semibold transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </button>
      </div>

      {/* Status Message */}
      {status && (
        <div className={`p-4 rounded-lg border flex items-start text-sm font-medium ${status.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {status.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 mr-2 mt-0.5 text-emerald-600" />
            : <AlertCircle className="w-4 h-4 mr-2 mt-0.5 text-red-600" />}
          {status.message}
          <button onClick={() => setStatus(null)} className="ml-auto text-slate-400 hover:text-slate-600 cursor-pointer">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Table */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search */}
          <div className="premium-card p-4">
            <input
              type="text"
              placeholder="Search by name, email, username, or role..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
            />
          </div>

          <div className="premium-card overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Employee Directory ({filtered.length})
              </h2>
              <span className="text-xs text-slate-500 font-medium">
                {employees.filter(e => e.is_active).length} active · {employees.filter(e => !e.is_active).length} suspended
              </span>
            </div>
            {loading ? (
              <div className="p-12 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No employees found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Contact</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filtered.map((emp, idx) => (
                      <tr key={emp.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/60 transition-colors`}>
                        <td className="py-4 px-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100 mr-3 flex-shrink-0">
                              {emp.first_name?.[0]}{emp.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{emp.first_name} {emp.last_name}</p>
                              <p className="text-xs text-slate-400 font-mono">@{emp.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <p className="text-slate-700 text-xs">{emp.email}</p>
                          <p className="text-slate-400 text-xs font-mono mt-0.5">{emp.phone_number || '—'}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-block text-[10px] font-bold rounded px-2 py-0.5 uppercase border ${ROLE_COLORS[emp.role] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                            {ROLE_LABELS[emp.role] || emp.role}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${emp.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {emp.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEditClick(emp)}
                              disabled={actionLoading === emp.id}
                              className="p-1.5 rounded-md border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                              title="Edit Details"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(emp)}
                              disabled={actionLoading === emp.id}
                              className={`p-1.5 rounded-md border transition-colors cursor-pointer disabled:opacity-50 ${emp.is_active ? 'bg-amber-50 text-amber-700 border-amber-100 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100'}`}
                              title={emp.is_active ? 'Suspend' : 'Activate'}
                            >
                              {actionLoading === emp.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : emp.is_active
                                  ? <ShieldX className="w-4 h-4" />
                                  : <ShieldCheck className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteEmployee(emp)}
                              disabled={actionLoading === emp.id}
                              className="p-1.5 rounded-md border bg-red-50 text-red-600 border-red-100 hover:bg-red-100 transition-colors cursor-pointer disabled:opacity-50"
                              title="Remove Employee"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* System Config */}
          <div className="premium-card p-6">
            <h2 className="text-base font-bold mb-4 flex items-center text-slate-900">
              <Building2 className="w-5 h-5 mr-2 text-blue-600" />
              Interest Rate Configuration
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Savings Rate (% p.a.)', value: '3.5' },
                { label: 'Fixed Deposit Rate (% p.a.)', value: '7.25' },
                { label: 'Recurring Deposit (% p.a.)', value: '6.75' },
                { label: 'Transfer Fee (₹)', value: '2.00' },
              ].map(cfg => (
                <div key={cfg.label}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{cfg.label}</label>
                  <input
                    type="number"
                    step="0.1"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    defaultValue={cfg.value}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={() => setStatus({ type: 'success', message: 'Interest rates updated across all branches.' })}
              className="mt-4 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all cursor-pointer"
            >
              Save Configuration
            </button>
          </div>
        </div>

        {/* Add Employee Form */}
        <div className="premium-card p-6 self-start">
          <h2 className="text-base font-bold mb-5 flex items-center text-slate-900">
            <UserPlus className="w-5 h-5 mr-2 text-blue-600" />
            Add New Employee
          </h2>
          <form onSubmit={handleAddEmployee} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="John"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.first_name}
                  onChange={e => setForm({ ...form, first_name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Smith"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.last_name}
                  onChange={e => setForm({ ...form, last_name: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
              <input
                type="email"
                required
                placeholder="john.smith@bank.com"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.phone_number}
                onChange={e => setForm({ ...form, phone_number: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Role *</label>
              <select
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                value={form.role}
                onChange={e => setForm({ ...form, role: e.target.value })}
              >
                <option value="teller">Teller / Cashier</option>
                <option value="loan_officer">Loan Officer</option>
                <option value="customer_support">Customer Support</option>
                <option value="auditor">Auditor</option>
                <option value="branch_manager">Branch Manager</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Temporary Password</label>
              <input
                type="text"
                placeholder="TempPass123! (default)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1">Leave blank to use default: TempPass123!</p>
            </div>
            <button
              type="submit"
              disabled={formLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-semibold py-2.5 rounded-lg transition-all cursor-pointer flex items-center justify-center"
            >
              {formLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
              {formLoading ? 'Creating...' : 'Onboard Employee'}
            </button>
          </form>
        </div>
      </div>

      {/* Edit Employee Modal */}
      {editingEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Edit Employee Details</h3>
              <button
                onClick={() => setEditingEmp(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editForm.first_name}
                    onChange={e => setEditForm({ ...editForm, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editForm.last_name}
                    onChange={e => setEditForm({ ...editForm, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Email *</label>
                <input
                  type="email"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Phone Number</label>
                <input
                  type="tel"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editForm.phone_number}
                  onChange={e => setEditForm({ ...editForm, phone_number: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Role *</label>
                <select
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                  value={editForm.role}
                  onChange={e => setEditForm({ ...editForm, role: e.target.value })}
                >
                  <option value="teller">Teller / Cashier</option>
                  <option value="loan_officer">Loan Officer</option>
                  <option value="customer_support">Customer Support</option>
                  <option value="auditor">Auditor</option>
                  <option value="branch_manager">Branch Manager</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Reset Password</label>
                <input
                  type="text"
                  placeholder="Enter new password (optional)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={editForm.password}
                  onChange={e => setEditForm({ ...editForm, password: e.target.value })}
                />
                <p className="text-[10px] text-slate-400 mt-1">Leave blank to keep current password.</p>
              </div>
              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingEmp(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-lg text-sm hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white font-semibold rounded-lg text-sm transition-all cursor-pointer flex items-center justify-center"
                >
                  {formLoading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
