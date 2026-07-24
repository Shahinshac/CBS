import { useEffect, useState } from 'react';
import {
  Users, CheckCircle, Activity, Loader2, Landmark,
  ArrowUpDown, RefreshCw, IndianRupee, FileCheck, Clock
} from 'lucide-react';
import { adminAPI, transactionAPI, loanAPI, accountAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

export const ManagerDashboard = () => {
  const { user } = useAuthStore();
  const [customers, setCustomers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [branchCash, setBranchCash] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [loanMsg, setLoanMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);
  const [acctMsg, setAcctMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);
  const [pendingTx, setPendingTx] = useState<any[]>([]);
  const [txAppMsg, setTxAppMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);

  const handleAccountAction = async (accountId: string, action: 'approve' | 'reject') => {
    setActionLoading(accountId);
    setAcctMsg(null);
    try {
      if (action === 'approve') {
        await accountAPI.approve(accountId, { approved_by: user?.id || '' });
        setCustomers(prev => prev.map((c: any) => ({
          ...c,
          accounts: (c.accounts || []).map((a: any) => a.id === accountId ? { ...a, status: 'active' } : a)
        })));
        setAcctMsg({ id: accountId, type: 'success', text: 'Account approved successfully.' });
      } else {
        await accountAPI.update(accountId, { status: 'closed', updated_by: user?.id || '' });
        setCustomers(prev => prev.map((c: any) => ({
          ...c,
          accounts: (c.accounts || []).map((a: any) => a.id === accountId ? { ...a, status: 'closed' } : a)
        })));
        setAcctMsg({ id: accountId, type: 'success', text: 'Account closed.' });
      }
    } catch {
      setAcctMsg({ id: accountId, type: 'error', text: 'Failed to update account status.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleTxApprovalAction = async (txId: string, action: 'approve' | 'reject') => {
    setActionLoading(txId);
    setTxAppMsg(null);
    try {
      if (action === 'approve') {
        await transactionAPI.approve(txId, { approved_by: user?.id || '' });
        setTxAppMsg({ id: txId, type: 'success', text: 'Transaction approved and executed.' });
      } else {
        await transactionAPI.reject(txId, { rejected_by: user?.id || '' });
        setTxAppMsg({ id: txId, type: 'success', text: 'Transaction rejected.' });
      }
      setPendingTx(prev => prev.filter((t: any) => t.id !== txId));
    } catch {
      setTxAppMsg({ id: txId, type: 'error', text: 'Failed to process transaction approval.' });
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [customersRes, txRes, loansRes, statsRes, cashRes, pendingTxRes] = await Promise.all([
        adminAPI.getCustomers(),
        transactionAPI.getAll({ limit: 15 }),
        loanAPI.getAll(),
        adminAPI.getStats(),
        adminAPI.getBranchCash(),
        transactionAPI.getPending(),
      ]);
      setCustomers(customersRes.data.customers || []);
      setTransactions(txRes.data.transactions || []);
      setLoans(loansRes.data || []);
      setStats(statsRes.data);
      setBranchCash(cashRes.data);
      setPendingTx(pendingTxRes.data.transactions || []);
    } catch {
      // partial failures are ok — show what we have
    } finally {
      setLoading(false);
    }
  };

  const handleLoanAction = async (loanId: string, status: 'approved' | 'rejected') => {
    setActionLoading(loanId);
    setLoanMsg(null);
    try {
      await loanAPI.updateStatus(loanId, { status, approved_by: user?.id });
      setLoans(prev => prev.map((l: any) => l.id === loanId ? { ...l, status } : l));
      setLoanMsg({ id: loanId, type: 'success', text: `Loan ${status} successfully.` });
      if (stats) {
        setStats((prev: any) => ({ ...prev, pending_loans: Math.max(0, prev.pending_loans - 1) }));
      }
    } catch {
      setLoanMsg({ id: loanId, type: 'error', text: 'Failed to update loan status.' });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingLoans = loans.filter((l: any) => l.status === 'pending');
  const pendingAccounts: any[] = [];
  customers.forEach((c: any) => {
    (c.accounts || []).forEach((a: any) => {
      if (a.status === 'pending') {
        pendingAccounts.push({ ...a, user: c });
      }
    });
  });
  const activeCustomers = customers.filter(c => c.is_active).length;
  const totalBalance = stats?.total_deposits || 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Activity className="w-6 h-6 mr-2 text-blue-600" />
            Branch Manager Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real-time overview of branch operations, customers, and transactions.</p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center px-4 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 font-semibold transition-all cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {[
              { label: 'Total Customers', value: customers.length, icon: Users, color: 'blue' },
              { label: 'Active Accounts', value: activeCustomers, icon: CheckCircle, color: 'emerald' },
              { label: 'Pending Loans', value: pendingLoans.length, icon: Clock, color: 'amber' },
              { label: 'Total Deposits', value: `₹${(totalBalance / 1000).toFixed(0)}K`, icon: IndianRupee, color: 'purple' },
            ].map(card => (
              <div key={card.label} className="premium-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl bg-${card.color}-50 flex items-center justify-center text-${card.color}-600 border border-${card.color}-100`}>
                    <card.icon className="w-5 h-5" />
                  </div>
                  <span className={`text-xs font-bold text-${card.color}-600 uppercase tracking-wide`}>Live</span>
                </div>
                <p className="text-3xl font-extrabold text-slate-900">{card.value}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Recent Transactions */}
            <div className="xl:col-span-2 premium-card overflow-hidden">
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900 flex items-center">
                  <ArrowUpDown className="w-4 h-4 mr-2 text-blue-600" />
                  Recent Transactions
                </h2>
                <span className="text-xs text-slate-400">{transactions.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.length === 0 ? (
                      <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400">No transactions yet</td></tr>
                    ) : transactions.map((tx, idx) => (
                      <tr key={tx.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} hover:bg-slate-50 transition-colors`}>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-semibold border ${tx.transaction_type === 'deposit' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : tx.transaction_type === 'withdrawal' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{tx.description || '—'}</td>
                        <td className={`px-5 py-3 font-bold ${tx.transaction_type === 'deposit' ? 'text-emerald-600' : tx.transaction_type === 'withdrawal' ? 'text-red-600' : 'text-blue-600'}`}>
                          ₹{parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-3 text-slate-400 text-xs">{new Date(tx.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Branch Reserves */}
              {branchCash && (
                <div className="premium-card p-5">
                  <h3 className="font-bold text-slate-900 mb-4 flex items-center text-sm">
                    <Landmark className="w-4 h-4 mr-2 text-blue-600" />
                    Branch Reserve Vault
                  </h3>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: 'Vault Reserves', value: `₹${parseFloat(branchCash.total_vault_cash || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, highlight: true },
                      { label: 'Total Deposits', value: `₹${parseFloat(branchCash.total_deposits || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, highlight: false },
                    ].map(item => (
                      <div key={item.label} className="flex justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-500">{item.label}</span>
                        <span className={`font-bold ${item.highlight ? 'text-blue-600' : 'text-slate-900'}`}>{item.value}</span>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Liquidity</span>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">{branchCash.status}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Pending Loan Approvals */}
              <div className="premium-card overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 flex items-center text-sm">
                    <FileCheck className="w-4 h-4 mr-2 text-blue-600" />
                    Loan Approvals ({pendingLoans.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {pendingLoans.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">No pending loans</div>
                  ) : pendingLoans.map((loan: any) => (
                    <div key={loan.id} className="p-4">
                      {loanMsg && loanMsg.id === loan.id && (
                        <div className={`mb-2 text-xs p-2 rounded border font-medium ${loanMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                          {loanMsg.text}
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{loan.user?.first_name} {loan.user?.last_name}</p>
                          <p className="text-xs text-slate-500 capitalize">{loan.loan_type} · {loan.duration_months}mo</p>
                        </div>
                        <p className="font-bold text-slate-900 text-sm">₹{parseFloat(loan.amount).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLoanAction(loan.id, 'approved')}
                          disabled={actionLoading === loan.id}
                          className="flex-1 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded hover:bg-emerald-700 cursor-pointer disabled:opacity-60 transition-colors"
                        >
                          {actionLoading === loan.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleLoanAction(loan.id, 'rejected')}
                          disabled={actionLoading === loan.id}
                          className="flex-1 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded hover:bg-red-200 cursor-pointer disabled:opacity-60 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Customer Account Approvals */}
              <div className="premium-card overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 flex items-center text-sm">
                    <CheckCircle className="w-4 h-4 mr-2 text-blue-600" />
                    Account Approvals ({pendingAccounts.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {pendingAccounts.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">No pending accounts</div>
                  ) : pendingAccounts.map((acc: any) => (
                    <div key={acc.id} className="p-4">
                      {acctMsg && acctMsg.id === acc.id && (
                        <div className={`mb-2 text-xs p-2 rounded border font-medium ${acctMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                          {acctMsg.text}
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{acc.user?.first_name} {acc.user?.last_name}</p>
                          <p className="text-xs text-slate-500 capitalize">{acc.account_type} Account</p>
                        </div>
                        <p className="font-mono text-slate-600 text-xs">{acc.account_number}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAccountAction(acc.id, 'approve')}
                          disabled={actionLoading === acc.id}
                          className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 cursor-pointer disabled:opacity-60 transition-colors"
                        >
                          {actionLoading === acc.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleAccountAction(acc.id, 'reject')}
                          disabled={actionLoading === acc.id}
                          className="flex-1 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded hover:bg-red-200 cursor-pointer disabled:opacity-60 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pending High Value Transaction Approvals */}
              <div className="premium-card overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="font-bold text-slate-900 flex items-center text-sm">
                    <ArrowUpDown className="w-4 h-4 mr-2 text-blue-600" />
                    Transaction Approvals ({pendingTx.length})
                  </h3>
                </div>
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {pendingTx.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-sm">No pending transaction approvals</div>
                  ) : pendingTx.map((t: any) => (
                    <div key={t.id} className="p-4 text-xs">
                      {txAppMsg && txAppMsg.id === t.id && (
                        <div className={`mb-2 p-2 rounded border font-medium ${txAppMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                          {txAppMsg.text}
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm capitalize">{t.transaction_type}</p>
                          <p className="text-slate-500">{t.description}</p>
                        </div>
                        <p className="font-bold text-slate-900 text-sm">₹{parseFloat(t.amount).toLocaleString('en-IN')}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleTxApprovalAction(t.id, 'approve')}
                          disabled={actionLoading === t.id}
                          className="flex-1 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 cursor-pointer disabled:opacity-60 transition-colors"
                        >
                          {actionLoading === t.id ? '...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleTxApprovalAction(t.id, 'reject')}
                          disabled={actionLoading === t.id}
                          className="flex-1 py-1.5 bg-red-100 text-red-700 text-xs font-semibold rounded hover:bg-red-200 cursor-pointer disabled:opacity-60 transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Customer Directory */}
          <div className="premium-card overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <Users className="w-4 h-4 mr-2 text-blue-600" />
                Branch Customer Directory ({customers.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Accounts</th>
                    <th className="px-5 py-3">Total Balance</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers.length === 0 ? (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-slate-400">No customers yet</td></tr>
                  ) : customers.map((c, idx) => {
                    const customerTotal = (c.accounts || []).reduce((sum: number, a: any) => sum + parseFloat(a.balance || 0), 0);
                    return (
                      <tr key={c.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'} hover:bg-slate-50 transition-colors`}>
                        <td className="px-5 py-4">
                          <div className="flex items-center">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center font-bold text-xs border border-blue-100 mr-3">
                              {c.first_name?.[0]}{c.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{c.first_name} {c.last_name}</p>
                              <p className="text-xs text-slate-400 font-mono">@{c.username}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-slate-700 text-xs">{c.email}</p>
                          <p className="text-slate-400 text-xs font-mono mt-0.5">{c.phone_number || '—'}</p>
                        </td>
                        <td className="px-5 py-4 text-center font-semibold text-slate-700">{c.accounts?.length || 0}</td>
                        <td className="px-5 py-4 font-bold text-slate-900">₹{customerTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${c.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                            {c.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-400 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
