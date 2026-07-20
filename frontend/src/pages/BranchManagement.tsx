import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Edit2, Trash2, MapPin, Phone, Mail,
  Loader2, X, Search
} from 'lucide-react';
import { branchAPI, employeeAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

export const BranchManagement = () => {
  const { user } = useAuthStore();
  const [branches, setBranches] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [form, setForm] = useState({
    name: '', code: '', address: '', city: '', phone: '', email: '', manager_id: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [branchRes, empRes] = await Promise.all([
        branchAPI.getAll(),
        employeeAPI.getAll({ role: 'branch_manager' }),
      ]);
      setBranches(branchRes.data.branches || []);
      setManagers(empRes.data.employees || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => {
    setEditingBranch(null);
    setForm({ name: '', code: '', address: '', city: '', phone: '', email: '', manager_id: '' });
    setShowForm(true);
    setStatus(null);
  };

  const openEdit = (branch: any) => {
    setEditingBranch(branch);
    setForm({
      name: branch.name,
      code: branch.code,
      address: branch.address || '',
      city: branch.city || '',
      phone: branch.phone || '',
      email: branch.email || '',
      manager_id: branch.manager_id || '',
    });
    setShowForm(true);
    setStatus(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    try {
      if (editingBranch) {
        await branchAPI.update(editingBranch.id, { ...form, updated_by: user?.id });
        setStatus({ type: 'success', message: 'Branch updated successfully.' });
      } else {
        await branchAPI.create({ ...form, created_by: user?.id });
        setStatus({ type: 'success', message: 'Branch created successfully.' });
      }
      await fetchData();
      setTimeout(() => { setShowForm(false); setStatus(null); }, 1500);
    } catch (err: any) {
      setStatus({ type: 'error', message: err.response?.data?.message || 'Operation failed.' });
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Deactivate branch "${name}"? This will not delete any data.`)) return;
    try {
      await branchAPI.deactivate(id, user?.id);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to deactivate branch.');
    }
  };

  const filtered = branches.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.code.toLowerCase().includes(search.toLowerCase()) ||
    (b.city || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Branch Management</h1>
          <p className="text-slate-500 text-sm mt-0.5">{branches.length} branches in the network</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Add Branch
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="Search by name, code, or city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((branch: any) => (
            <div
              key={branch.id}
              className={`bg-white rounded-xl border shadow-sm hover:shadow-md transition-shadow ${
                !branch.is_active ? 'opacity-60 border-red-200' : 'border-slate-200'
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-blue-600 rounded-lg">
                      <Building2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm leading-tight">{branch.name}</h3>
                      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{branch.code}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(branch)}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {branch.is_active && (
                      <button
                        onClick={() => handleDeactivate(branch.id, branch.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm text-slate-600 mb-4">
                  {branch.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <span className="text-xs">{branch.address}, {branch.city}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-slate-400" />
                      <span className="text-xs">{branch.phone}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-400" />
                      <span className="text-xs">{branch.email}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">{branch.customer_count || 0}</p>
                    <p className="text-[10px] text-slate-500">Customers</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">{branch.employee_count || 0}</p>
                    <p className="text-[10px] text-slate-500">Staff</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">{fmt(branch.total_deposits || 0)}</p>
                    <p className="text-[10px] text-slate-500">Deposits</p>
                  </div>
                </div>

                {branch.manager_name && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                      Manager: <span className="font-medium text-slate-700">{branch.manager_name}</span>
                    </p>
                  </div>
                )}

                <div className="mt-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    branch.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {branch.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No branches found</p>
            </div>
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingBranch ? 'Edit Branch' : 'Create New Branch'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {status && (
                <div className={`p-3 rounded-lg text-sm font-medium ${
                  status.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {status.message}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Branch Name *</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Branch Code *</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="MUM001"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Address</label>
                <input
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">City</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Phone</label>
                  <input
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email</label>
                <input
                  type="email"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Branch Manager</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.manager_id}
                  onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
                >
                  <option value="">— Select Manager —</option>
                  {managers.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {editingBranch ? 'Update Branch' : 'Create Branch'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
