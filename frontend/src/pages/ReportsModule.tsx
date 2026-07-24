import { useState, useEffect } from 'react';
import {
  FileText, BarChart3, TrendingUp, IndianRupee, Shield,
  Printer, Loader2, RefreshCcw, BookOpen, Scale, Landmark, ShieldAlert, DollarSign, Calendar, Filter
} from 'lucide-react';
import { reportAPI, branchAPI } from '../services/api';

const fmt = (n: number) =>
  `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const fmtN = (n: number) => Number(n || 0).toLocaleString('en-IN');

type ReportType = 'daily' | 'monthly' | 'loans' | 'cash' | 'audit' | 'trial_balance' | 'profit_loss' | 'balance_sheet' | 'gl' | 'aml';

const REPORT_TYPES = [
  { id: 'daily' as ReportType, label: 'Daily Transactions', icon: FileText, color: 'text-blue-600' },
  { id: 'monthly' as ReportType, label: 'Monthly Summary', icon: BarChart3, color: 'text-indigo-600' },
  { id: 'loans' as ReportType, label: 'Loan Report', icon: TrendingUp, color: 'text-emerald-600' },
  { id: 'cash' as ReportType, label: 'Cash & Balances', icon: IndianRupee, color: 'text-amber-600' },
  { id: 'trial_balance' as ReportType, label: 'Trial Balance', icon: Scale, color: 'text-purple-600' },
  { id: 'profit_loss' as ReportType, label: 'Profit & Loss', icon: DollarSign, color: 'text-teal-600' },
  { id: 'balance_sheet' as ReportType, label: 'Balance Sheet', icon: Landmark, color: 'text-blue-700' },
  { id: 'gl' as ReportType, label: 'General Ledger', icon: BookOpen, color: 'text-slate-700' },
  { id: 'aml' as ReportType, label: 'AML & Risk', icon: ShieldAlert, color: 'text-red-600' },
  { id: 'audit' as ReportType, label: 'Audit Log Report', icon: Shield, color: 'text-slate-600' },
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
    branchAPI.getAll().then((r: any) => setBranches(r.data.branches || []));
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
      else if (activeReport === 'trial_balance') res = await reportAPI.trialBalance();
      else if (activeReport === 'profit_loss') res = await reportAPI.profitLoss();
      else if (activeReport === 'balance_sheet') res = await reportAPI.balanceSheet();
      else if (activeReport === 'gl') res = await reportAPI.gl();
      else if (activeReport === 'aml') res = await reportAPI.aml();
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

          {/* ─── Trial Balance ─────────────────────────────────────── */}
          {activeReport === 'trial_balance' && (
            <div className="space-y-5">
              <div className="flex justify-between items-center p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div>
                  <h3 className="font-bold text-purple-900 text-base">General Ledger Trial Balance</h3>
                  <p className="text-xs text-purple-700 mt-0.5">ACID Double-Entry Debit/Credit Verification</p>
                </div>
                <span className="px-3 py-1 bg-purple-600 text-white rounded-full text-xs font-bold">
                  {data.status}
                </span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">GL Code</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">GL Account Name</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Category</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase">Debit (₹)</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase">Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data.rows || []).map((row: any) => (
                      <tr key={row.code} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{row.code}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{row.name}</td>
                        <td className="px-4 py-3 text-slate-600 capitalize">{row.type}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-blue-700">{row.debit > 0 ? fmt(row.debit) : '—'}</td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">{row.credit > 0 ? fmt(row.credit) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold text-slate-900 border-t border-slate-300">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 uppercase text-xs">Total Trial Balance</td>
                      <td className="px-4 py-3 text-right font-mono text-blue-800 text-base">{fmt(data.total_debit)}</td>
                      <td className="px-4 py-3 text-right font-mono text-emerald-800 text-base">{fmt(data.total_credit)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ─── Profit & Loss ─────────────────────────────────────── */}
          {activeReport === 'profit_loss' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                  <p className="text-xs font-bold text-emerald-700 uppercase">Total Revenue / Income</p>
                  <p className="text-2xl font-black text-emerald-900 mt-1">{fmt(data.total_income)}</p>
                </div>
                <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                  <p className="text-xs font-bold text-red-700 uppercase">Total Interest & Operating Expenses</p>
                  <p className="text-2xl font-black text-red-900 mt-1">{fmt(data.total_expenses)}</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                  <p className="text-xs font-bold text-blue-700 uppercase">Net Operating Profit (Margin: {data.profit_margin})</p>
                  <p className="text-2xl font-black text-blue-900 mt-1">{fmt(data.net_profit)}</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="font-bold text-slate-900 text-base border-b pb-2">Profit & Loss Breakdown</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="font-medium text-slate-700">Loan Interest Income</span>
                    <span className="font-mono font-bold text-emerald-700">{fmt(data.interest_income)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="font-medium text-slate-700">Banking Service Fees & Charges</span>
                    <span className="font-mono font-bold text-emerald-700">{fmt(data.fee_income)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="font-medium text-slate-700">Deposit Interest Expense</span>
                    <span className="font-mono font-bold text-red-600">({fmt(data.interest_expense)})</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="font-medium text-slate-700">Operating & Administrative Expenses</span>
                    <span className="font-mono font-bold text-red-600">({fmt(data.operating_expense)})</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── Balance Sheet ─────────────────────────────────────── */}
          {activeReport === 'balance_sheet' && (
            <div className="space-y-5">
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-blue-900 text-base">Commercial Bank Balance Sheet</h3>
                  <p className="text-xs text-blue-700 mt-0.5">As of {new Date(data.as_of).toLocaleDateString()}</p>
                </div>
                <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-xs font-bold">
                  {data.is_balanced ? 'Assets = Liabilities + Equity' : 'Audit Check'}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Assets */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <h4 className="font-bold text-slate-900 text-base border-b pb-2 text-emerald-700">ASSETS</h4>
                  {(data.assets || []).map((a: any) => (
                    <div key={a.code} className="flex justify-between text-sm py-1 border-b border-slate-100">
                      <span className="text-slate-700">{a.name}</span>
                      <span className="font-mono font-bold text-slate-900">{fmt(a.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-extrabold text-base pt-2 text-emerald-800 border-t border-slate-300">
                    <span>TOTAL ASSETS</span>
                    <span className="font-mono">{fmt(data.total_assets)}</span>
                  </div>
                </div>

                {/* Liabilities & Equity */}
                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
                  <h4 className="font-bold text-slate-900 text-base border-b pb-2 text-blue-700">LIABILITIES & EQUITY</h4>
                  <p className="text-xs font-bold text-slate-500 uppercase">Liabilities</p>
                  {(data.liabilities || []).map((l: any) => (
                    <div key={l.code} className="flex justify-between text-sm py-1 border-b border-slate-100">
                      <span className="text-slate-700">{l.name}</span>
                      <span className="font-mono font-bold text-slate-900">{fmt(l.balance)}</span>
                    </div>
                  ))}
                  <p className="text-xs font-bold text-slate-500 uppercase pt-2">Equity & Capital</p>
                  {(data.equity || []).map((e: any) => (
                    <div key={e.code} className="flex justify-between text-sm py-1 border-b border-slate-100">
                      <span className="text-slate-700">{e.name}</span>
                      <span className="font-mono font-bold text-slate-900">{fmt(e.balance)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-extrabold text-base pt-2 text-blue-800 border-t border-slate-300">
                    <span>TOTAL LIABILITIES & EQUITY</span>
                    <span className="font-mono">{fmt(data.total_liabilities + data.total_equity)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ─── General Ledger ─────────────────────────────────────── */}
          {activeReport === 'gl' && (
            <div className="space-y-5">
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-4 border-b"><h3 className="font-semibold text-slate-900">General Ledger Accounts Summary</h3></div>
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">GL Code</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Account Name</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Type</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase">Current Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data.gl_accounts || []).map((gl: any) => (
                      <tr key={gl.code} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-blue-700 text-xs">{gl.code}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{gl.name}</td>
                        <td className="px-4 py-3 capitalize text-slate-600">{gl.type}</td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{fmt(gl.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ─── AML Report ─────────────────────────────────────── */}
          {activeReport === 'aml' && (
            <div className="space-y-5">
              <div className="p-4 bg-red-50 rounded-xl border border-red-100 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-red-900 text-base">Anti-Money Laundering (AML) Risk Queue</h3>
                  <p className="text-xs text-red-700 mt-0.5">High-Value Transaction Threshold Monitoring ({data.high_risk_threshold})</p>
                </div>
                <span className="px-3 py-1 bg-red-600 text-white rounded-full text-xs font-bold">
                  {data.total_flagged_transactions} Flagged Events
                </span>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Reference #</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Sender</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Receiver</th>
                      <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase">Amount</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Risk Rating</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(data.flagged_transactions || []).map((t: any) => (
                      <tr key={t.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{t.reference_number?.slice(0, 12)}</td>
                        <td className="px-4 py-3 font-semibold text-slate-900">{t.sender}</td>
                        <td className="px-4 py-3 text-slate-700">{t.receiver}</td>
                        <td className="px-4 py-3 text-right font-mono font-extrabold text-slate-900">{fmt(t.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                            t.risk_level.includes('HIGH') ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {t.risk_level}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
