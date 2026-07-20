import { useState, useEffect } from 'react';
import {
  FileText, BarChart3, TrendingUp, IndianRupee, Shield,
  Printer, Calendar, Filter, Loader2, RefreshCcw
} from 'lucide-react';
import { reportAPI, branchAPI } from '../services/api';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtN = (n: number) => Number(n || 0).toLocaleString('en-IN');

type ReportType = 'daily' | 'monthly' | 'loans' | 'cash' | 'audit';

const REPORT_TYPES = [
  { id: 'daily' as ReportType, label: 'Daily Transactions', icon: FileText, color: 'text-blue-600' },
  { id: 'monthly' as ReportType, label: 'Monthly Summary', icon: BarChart3, color: 'text-indigo-600' },
  { id: 'loans' as ReportType, label: 'Loan Report', icon: TrendingUp, color: 'text-emerald-600' },
  { id: 'cash' as ReportType, label: 'Cash & Balances', icon: IndianRupee, color: 'text-amber-600' },
  { id: 'audit' as ReportType, label: 'Audit Report', icon: Shield, color: 'text-purple-600' },
];

const TX_COLORS: Record<string, string> = {
  deposit: 'text-emerald-600', withdrawal: 'text-red-600',
  transfer: 'text-blue-600', bill_payment: 'text-amber-600',
};

const LOAN_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-indigo-100 text-indigo-700',
  disbursed: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-red-100 text-red-700',
  closed: 'bg-slate-100 text-slate-700',
};

export const ReportsModule = () => {
  const [activeReport, setActiveReport] = useState<ReportType>('daily');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [branches, setBranches] = useState<any[]>([]);

  // Filters
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [branchId, setBranchId] = useState('');
  const [fromDate, setFromDate] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    branchAPI.getAll().then((r) => setBranches(r.data.branches || []));
  }, []);

  useEffect(() => { fetchReport(); }, [activeReport]);

  const fetchReport = async () => {
    setLoading(true);
    setData(null);
    try {
      let res;
      if (activeReport === 'daily') res = await reportAPI.daily({ date, branch_id: branchId || undefined });
      else if (activeReport === 'monthly') res = await reportAPI.monthly({ month, year });
      else if (activeReport === 'loans') res = await reportAPI.loans();
      else if (activeReport === 'cash') res = await reportAPI.cash({ branch_id: branchId || undefined });
      else if (activeReport === 'audit') res = await reportAPI.audit({ from_date: fromDate, to_date: toDate });
      if (res) setData(res.data);
    } catch (err) {
      console.error('Report error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports & Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Generate and export banking reports</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchReport}
            className="flex items-center gap-2 px-3 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 text-sm"
          >
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.id}
            onClick={() => setActiveReport(rt.id)}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border text-sm font-medium transition-all ${
              activeReport === rt.id
                ? 'bg-blue-600 text-white border-blue-600 shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-blue-300'
            }`}
          >
            <rt.icon className={`w-5 h-5 ${activeReport === rt.id ? 'text-white' : rt.color}`} />
            <span className="text-xs text-center leading-tight">{rt.label}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <Filter className="w-4 h-4 text-slate-500" />
          {activeReport === 'daily' && (
            <>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <input
                  type="date"
                  className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <select
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="">All Branches</option>
                {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </>
          )}
          {activeReport === 'monthly' && (
            <>
              <select
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={String(i + 1)}>
                    {new Date(2000, i).toLocaleString('en-IN', { month: 'long' })}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-24"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                min="2020" max="2030"
              />
            </>
          )}
          {(activeReport === 'audit') && (
            <>
              <input
                type="date"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </>
          )}
          {(activeReport === 'cash') && (
            <select
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              <option value="">All Branches</option>
              {branches.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button
            onClick={fetchReport}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
          >
            Generate
          </button>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-slate-500">Generating report...</span>
        </div>
      ) : !data ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200">
          <p className="text-slate-400">Click Generate to load the report.</p>
        </div>
      ) : (
        <>
          {/* ─── Daily Report ─────────────────────────────────────── */}
          {activeReport === 'daily' && (
            <div className="space-y-5 print:block">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Deposits', value: fmt(data.total_deposits), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'Total Withdrawals', value: fmt(data.total_withdrawals), color: 'text-red-600', bg: 'bg-red-50' },
                  { label: 'Total Transfers', value: fmt(data.total_transfers), color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Bill Payments', value: fmt(data.total_bill_payments), color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white`}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200">
                  <h3 className="font-semibold text-slate-900">
                    Transaction Log — {data.report_date} ({data.total_transactions} records)
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Ref #', 'Type', 'Description', 'Amount', 'Channel', 'Time'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.transactions || []).slice(0, 100).map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{tx.reference_number?.slice(0, 8).toUpperCase()}</td>
                          <td className="px-4 py-3">
                            <span className={`capitalize font-medium ${TX_COLORS[tx.transaction_type] || 'text-slate-700'}`}>
                              {tx.transaction_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{tx.description || '—'}</td>
                          <td className={`px-4 py-3 font-semibold ${TX_COLORS[tx.transaction_type] || 'text-slate-700'}`}>
                            ₹{Number(tx.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-3 text-slate-500 capitalize">{tx.channel}</td>
                          <td className="px-4 py-3 text-slate-500 text-xs">{new Date(tx.created_at).toLocaleTimeString('en-IN')}</td>
                        </tr>
                      ))}
                      {data.transactions?.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No transactions found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── Monthly Report ───────────────────────────────────── */}
          {activeReport === 'monthly' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Volume', value: fmt(data.total_volume), color: 'text-blue-600', bg: 'bg-blue-50' },
                  { label: 'Total Transactions', value: fmtN(data.total_transactions), color: 'text-slate-700', bg: 'bg-slate-50' },
                  { label: 'New Customers', value: fmtN(data.new_customers), color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  { label: 'New Loans', value: fmtN(data.new_loans), color: 'text-amber-600', bg: 'bg-amber-50' },
                ].map((s) => (
                  <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-xs text-slate-600 mt-1 font-medium">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b"><h3 className="font-semibold">Monthly Transactions ({data.report_period})</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Date', 'Type', 'Description', 'Amount', 'Status'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.transactions || []).map((tx: any) => (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-xs text-slate-500">{new Date(tx.created_at).toLocaleDateString('en-IN')}</td>
                          <td className="px-4 py-2.5 capitalize text-slate-700 font-medium">{tx.transaction_type.replace('_', ' ')}</td>
                          <td className="px-4 py-2.5 text-slate-600">{tx.description || '—'}</td>
                          <td className="px-4 py-2.5 font-semibold text-slate-900">₹{Number(tx.amount).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              tx.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>{tx.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── Loan Report ──────────────────────────────────────── */}
          {activeReport === 'loans' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xl font-bold text-blue-600">{fmtN(data.total_loans)}</p>
                  <p className="text-xs text-slate-600 mt-1">Total Loan Applications</p>
                </div>
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-xl font-bold text-emerald-600">{fmt(data.total_disbursed)}</p>
                  <p className="text-xs text-slate-600 mt-1">Total Disbursed</p>
                </div>
                {Object.entries(data.by_status || {}).map(([s, c]: any) => (
                  <div key={s} className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xl font-bold text-slate-900">{c}</p>
                    <p className="text-xs text-slate-600 mt-1 capitalize">{s.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b"><h3 className="font-semibold">All Loans ({data.total_loans})</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Customer', 'Type', 'Amount', 'Duration', 'Rate', 'Status', 'Applied On'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.loans || []).map((loan: any) => (
                        <tr key={loan.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-slate-900">{loan.user?.first_name} {loan.user?.last_name}</p>
                            <p className="text-xs text-slate-500">{loan.user?.email}</p>
                          </td>
                          <td className="px-4 py-3 capitalize text-slate-700">{loan.loan_type}</td>
                          <td className="px-4 py-3 font-semibold text-slate-900">₹{Number(loan.amount).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-slate-600">{loan.duration_months}m</td>
                          <td className="px-4 py-3 text-slate-600">{Number(loan.rate)}%</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LOAN_STATUS_COLORS[loan.status] || 'bg-slate-100 text-slate-700'}`}>
                              {loan.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-500">{new Date(loan.created_at).toLocaleDateString('en-IN')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── Cash Report ──────────────────────────────────────── */}
          {activeReport === 'cash' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-50 rounded-xl p-4">
                  <p className="text-xl font-bold text-emerald-600">{fmt(data.total_balance)}</p>
                  <p className="text-xs text-slate-600 mt-1">Total Balance (AUM)</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-xl font-bold text-blue-600">{fmtN(data.account_count)}</p>
                  <p className="text-xs text-slate-600 mt-1">Active Accounts</p>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-xl font-bold text-amber-600">{fmt(data.average_balance)}</p>
                  <p className="text-xs text-slate-600 mt-1">Average Balance</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b"><h3 className="font-semibold">Account Balances (Top 50)</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Account No.', 'Customer', 'Type', 'Branch', 'Balance', 'Status'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.accounts || []).map((acc: any) => (
                        <tr key={acc.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs text-slate-700">{acc.account_number}</td>
                          <td className="px-4 py-3 text-slate-900 font-medium">{acc.user?.first_name} {acc.user?.last_name}</td>
                          <td className="px-4 py-3 text-slate-600 capitalize">{acc.account_type}</td>
                          <td className="px-4 py-3 text-slate-600">{acc.branch?.code || '—'}</td>
                          <td className="px-4 py-3 font-semibold text-emerald-700">{fmt(Number(acc.balance))}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              acc.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                            }`}>{acc.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ─── Audit Report ─────────────────────────────────────── */}
          {activeReport === 'audit' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-purple-50 rounded-xl p-4">
                  <p className="text-xl font-bold text-purple-600">{fmtN(data.total_events)}</p>
                  <p className="text-xs text-slate-600 mt-1">Total Events</p>
                </div>
                {Object.entries(data.by_module || {}).slice(0, 3).map(([mod, cnt]: any) => (
                  <div key={mod} className="bg-slate-50 rounded-xl p-4">
                    <p className="text-xl font-bold text-slate-900">{cnt}</p>
                    <p className="text-xs text-slate-600 mt-1 capitalize">{mod}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b"><h3 className="font-semibold">Audit Trail ({data.total_events} events)</h3></div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Timestamp', 'User', 'Role', 'Module', 'Action', 'Status'].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(data.logs || []).map((log: any) => (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{new Date(log.timestamp).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-2.5 text-slate-800 font-medium">
                            {log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded capitalize">{log.role}</span>
                          </td>
                          <td className="px-4 py-2.5 text-slate-600 capitalize">{log.module}</td>
                          <td className="px-4 py-2.5 text-slate-700">{log.action?.substring(0, 60)}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              log.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                            }`}>{log.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
