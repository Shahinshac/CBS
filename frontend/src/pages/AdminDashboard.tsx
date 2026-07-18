import React, { useState, useEffect } from 'react';
import {
  Users, Building2, CreditCard, TrendingUp, AlertCircle,
  ArrowUpRight, ArrowDownRight, Activity, DollarSign, Shield,
  CheckCircle2, Clock, Bell, Loader2, RefreshCcw,
  Banknote, UserCheck
} from 'lucide-react';
import { adminAPI, branchAPI, loanAPI, auditAPI, announcementAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtN = (n: number) => n.toLocaleString('en-IN');

export const AdminDashboard = () => {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [pendingLoans, setPendingLoans] = useState<any[]>([]);
  const [recentAudit, setRecentAudit] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Announcements form
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annContent, setAnnContent] = useState('');
  const [annTarget, setAnnTarget] = useState('all');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, branchRes, loansRes, auditRes, annRes] = await Promise.all([
        adminAPI.getStats(),
        branchAPI.getAll(),
        loanAPI.getAll({ status: 'pending' }),
        auditAPI.getLogs({ limit: 15 }),
        announcementAPI.getAll(),
      ]);
      setStats(statsRes.data);
      setBranches(branchRes.data.branches || []);
      setPendingLoans(Array.isArray(loansRes.data) ? loansRes.data : []);
      setRecentAudit(Array.isArray(auditRes.data) ? auditRes.data : []);
      setAnnouncements(annRes.data || []);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleCreateAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!annTitle || !annContent) return;
    try {
      await announcementAPI.create({ title: annTitle, content: annContent, target_roles: annTarget, created_by: user?.id });
      setAnnTitle(''); setAnnContent(''); setAnnTarget('all'); setShowAnnForm(false);
      fetchAll();
    } catch {}
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
        <span className="ml-3 text-slate-600 text-lg">Loading dashboard...</span>
      </div>
    );
  }

  const statCards = [
    {
      label: 'Total Customers',
      value: fmtN(stats?.total_customers || 0),
      icon: Users,
      color: 'bg-blue-600',
      change: '+12 this month',
      positive: true,
    },
    {
      label: 'Total Employees',
      value: fmtN(stats?.total_employees || 0),
      icon: UserCheck,
      color: 'bg-indigo-600',
      change: 'Across all branches',
      positive: true,
    },
    {
      label: 'Active Branches',
      value: fmtN(stats?.total_branches || 0),
      icon: Building2,
      color: 'bg-violet-600',
      change: 'All operational',
      positive: true,
    },
    {
      label: 'Assets Under Mgmt',
      value: fmt(stats?.total_deposits || 0),
      icon: DollarSign,
      color: 'bg-emerald-600',
      change: 'Total deposits',
      positive: true,
    },
    {
      label: 'Vault Reserves',
      value: fmt(stats?.vault_reserves || 0),
      icon: Banknote,
      color: 'bg-amber-600',
      change: '15% CRR maintained',
      positive: true,
    },
    {
      label: 'Active Cards',
      value: fmtN(stats?.active_cards || 0),
      icon: CreditCard,
      color: 'bg-pink-600',
      change: 'Debit + credit cards',
      positive: true,
    },
    {
      label: "Today's Deposits",
      value: fmt(stats?.today_deposits || 0),
      icon: ArrowDownRight,
      color: 'bg-teal-600',
      change: `${fmtN(stats?.today_transactions || 0)} transactions`,
      positive: true,
    },
    {
      label: 'Pending Loans',
      value: fmtN(stats?.pending_loans || 0),
      icon: AlertCircle,
      color: 'bg-red-600',
      change: 'Awaiting review',
      positive: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Super Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Welcome back, {user?.first_name}. Last updated: {lastUpdated.toLocaleTimeString('en-IN')}
          </p>
        </div>
        <button
          onClick={fetchAll}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          <RefreshCcw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2.5 rounded-lg ${card.color}`}>
                <card.icon className="w-5 h-5 text-white" />
              </div>
              {card.positive ? (
                <ArrowUpRight className="w-4 h-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 mb-1">{card.value}</p>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
            <p className={`text-xs mt-1 ${card.positive ? 'text-emerald-600' : 'text-red-500'}`}>{card.change}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Branch Overview */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h2 className="font-semibold text-slate-900">Branch Overview</h2>
            </div>
            <span className="text-xs text-slate-500">{branches.length} branches</span>
          </div>
          <div className="divide-y divide-slate-100">
            {branches.map((branch: any) => (
              <div key={branch.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full ${branch.is_active ? 'bg-emerald-500' : 'bg-red-400'}`} />
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{branch.name}</p>
                    <p className="text-xs text-slate-500">{branch.code} · {branch.city}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-900">{fmt(branch.total_deposits || 0)}</p>
                  <p className="text-xs text-slate-500">{fmtN(branch.customer_count || 0)} customers · {fmtN(branch.employee_count || 0)} staff</p>
                </div>
              </div>
            ))}
            {branches.length === 0 && (
              <div className="p-8 text-center text-slate-400">
                <Building2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p>No branches found</p>
              </div>
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200 flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-slate-900">Pending Loans</h2>
            {pendingLoans.length > 0 && (
              <span className="ml-auto bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {pendingLoans.length}
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {pendingLoans.map((loan: any) => (
              <div key={loan.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-slate-900 text-sm">
                      {loan.user?.first_name} {loan.user?.last_name}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{loan.loan_type} loan</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">₹{Number(loan.amount).toLocaleString('en-IN')}</p>
                    <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Pending</span>
                  </div>
                </div>
              </div>
            ))}
            {pendingLoans.length === 0 && (
              <div className="p-6 text-center text-slate-400">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No pending loans</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Transactions */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200 flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <h2 className="font-semibold text-slate-900">Recent Transactions</h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {(stats?.recent_transactions || []).map((tx: any) => (
              <div key={tx.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-full ${
                    tx.transaction_type === 'deposit' ? 'bg-emerald-100' :
                    tx.transaction_type === 'withdrawal' ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    {tx.transaction_type === 'deposit' ? (
                      <ArrowDownRight className="w-3 h-3 text-emerald-600" />
                    ) : tx.transaction_type === 'withdrawal' ? (
                      <ArrowUpRight className="w-3 h-3 text-red-600" />
                    ) : (
                      <TrendingUp className="w-3 h-3 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 capitalize">{tx.transaction_type}</p>
                    <p className="text-xs text-slate-500">{tx.description?.substring(0, 25) || '—'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${
                    tx.transaction_type === 'deposit' ? 'text-emerald-600' :
                    tx.transaction_type === 'withdrawal' ? 'text-red-600' : 'text-blue-600'
                  }`}>
                    {tx.transaction_type === 'deposit' ? '+' : tx.transaction_type === 'withdrawal' ? '-' : ''}
                    ₹{Number(tx.amount).toLocaleString('en-IN')}
                  </p>
                  <p className="text-xs text-slate-400">{new Date(tx.created_at).toLocaleDateString('en-IN')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="p-5 border-b border-slate-200 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            <h2 className="font-semibold text-slate-900">Recent Audit Events</h2>
          </div>
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {recentAudit.map((log: any) => (
              <div key={log.id} className="p-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-800">{log.action?.substring(0, 60)}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'} · {log.module}
                    </p>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {log.status}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{new Date(log.timestamp).toLocaleString('en-IN')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Announcements */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-600" />
            <h2 className="font-semibold text-slate-900">System Announcements</h2>
          </div>
          <button
            onClick={() => setShowAnnForm(!showAnnForm)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            + New Announcement
          </button>
        </div>

        {showAnnForm && (
          <form onSubmit={handleCreateAnnouncement} className="p-5 border-b border-slate-200 bg-slate-50 space-y-3">
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Announcement title"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              required
            />
            <textarea
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20"
              placeholder="Announcement content"
              value={annContent}
              onChange={(e) => setAnnContent(e.target.value)}
              required
            />
            <div className="flex items-center gap-3">
              <select
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={annTarget}
                onChange={(e) => setAnnTarget(e.target.value)}
              >
                <option value="all">All Users</option>
                <option value="customer">Customers Only</option>
                <option value="employee">Employees Only</option>
                <option value="manager">Managers Only</option>
              </select>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
                Publish
              </button>
              <button type="button" onClick={() => setShowAnnForm(false)} className="text-sm text-slate-500 hover:text-slate-700">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-slate-100">
          {announcements.map((ann: any) => (
            <div key={ann.id} className="p-4 flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-medium text-slate-900 text-sm">{ann.title}</p>
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded capitalize">{ann.target_roles}</span>
                </div>
                <p className="text-xs text-slate-600">{ann.content}</p>
                <p className="text-[10px] text-slate-400 mt-1">
                  By {ann.author?.first_name} {ann.author?.last_name} · {new Date(ann.published_at).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
          ))}
          {announcements.length === 0 && (
            <div className="p-6 text-center text-slate-400">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No active announcements</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
