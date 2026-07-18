import { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Loader2, Download } from 'lucide-react';
import { auditAPI } from '../services/api';

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  warning: 'bg-amber-50 text-amber-700 border-amber-100',
  failure: 'bg-red-50 text-red-700 border-red-100',
  error: 'bg-red-50 text-red-700 border-red-100',
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  branch_manager: 'Branch Manager',
  teller: 'Teller',
  customer: 'Customer',
  loan_officer: 'Loan Officer',
  customer_support: 'Support',
  auditor: 'Auditor',
  system: 'System',
};

export const AuditLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await auditAPI.getLogs({ limit: 200 });
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = logs.filter(log => {
    const matchRole = filterRole ? log.role === filterRole : true;
    const matchStatus = filterStatus ? log.status === filterStatus : true;
    const matchSearch = search
      ? log.action?.toLowerCase().includes(search.toLowerCase()) ||
        log.user?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        log.user?.last_name?.toLowerCase().includes(search.toLowerCase()) ||
        log.ip_address?.includes(search)
      : true;
    return matchRole && matchStatus && matchSearch;
  });

  const exportCSV = () => {
    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'IP Address', 'Status'];
    const rows = filtered.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System',
      ROLE_LABELS[log.role] || log.role,
      `"${log.action?.replace(/"/g, "'")}"`,
      log.ip_address,
      log.status,
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueRoles = [...new Set(logs.map(l => l.role))];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold flex items-center text-slate-900">
            <ShieldAlert className="w-6 h-6 mr-2 text-blue-600" />
            System Audit Logs
          </h1>
          <p className="text-sm text-slate-500 mt-1">Complete trail of all actions performed across the banking system.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportCSV}
            className="flex items-center px-4 py-2 text-sm text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-semibold cursor-pointer"
          >
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center px-4 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 font-semibold cursor-pointer disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Entries', value: logs.length, color: 'slate' },
          { label: 'Success', value: logs.filter(l => l.status === 'success').length, color: 'emerald' },
          { label: 'Warnings', value: logs.filter(l => l.status === 'warning').length, color: 'amber' },
          { label: 'Failures', value: logs.filter(l => l.status === 'failure' || l.status === 'error').length, color: 'red' },
        ].map(stat => (
          <div key={stat.label} className="premium-card p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-900">{stat.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="premium-card p-4">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search actions, actors, or IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
          />
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="">All Roles</option>
            {uniqueRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500 text-slate-700"
          >
            <option value="">All Status</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="failure">Failure</option>
          </select>
          {(filterRole || filterStatus || search) && (
            <button onClick={() => { setFilterRole(''); setFilterStatus(''); setSearch(''); }} className="px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg cursor-pointer hover:bg-red-100 font-medium">
              Clear Filters
            </button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">Showing {filtered.length} of {logs.length} entries</p>
      </div>

      {/* Logs Table */}
      <div className="premium-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ShieldAlert className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No audit log entries found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                  <th className="px-5 py-3">Timestamp</th>
                  <th className="px-5 py-3">Actor</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Action</th>
                  <th className="px-5 py-3">IP Address</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((log, idx) => (
                  <tr key={log.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} hover:bg-slate-50 transition-colors`}>
                    <td className="px-5 py-3 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-5 py-3">
                      {log.user ? (
                        <div>
                          <p className="font-semibold text-slate-900 text-xs">{log.user.first_name} {log.user.last_name}</p>
                          <p className="text-slate-400 text-[10px] font-mono">@{log.user.username}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-xs italic">System</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                        {ROLE_LABELS[log.role] || log.role}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-slate-700 max-w-sm">
                      <p className="text-xs leading-relaxed truncate" title={log.action}>{log.action}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-500">{log.ip_address}</td>
                    <td className="px-5 py-3">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${STATUS_COLORS[log.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
