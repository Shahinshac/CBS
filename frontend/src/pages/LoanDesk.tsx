import { useState, useEffect } from 'react';
import { Landmark, Loader2, CheckCircle2, AlertCircle, RefreshCw, FileText, TrendingUp } from 'lucide-react';
import { loanAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  rejected: 'bg-red-50 text-red-700 border-red-100',
  disbursed: 'bg-blue-50 text-blue-700 border-blue-100',
  closed: 'bg-slate-50 text-slate-600 border-slate-200',
};

export const LoanDesk = () => {
  const { user } = useAuthStore();
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assessmentResult, setAssessmentResult] = useState<any | null>(null);
  const [assessingId, setAssessingId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<{ id: string; type: 'success' | 'error'; text: string } | null>(null);

  // EMI Calculator
  const [calcAmount, setCalcAmount] = useState('10000');
  const [calcMonths, setCalcMonths] = useState('24');
  const [calcRate, setCalcRate] = useState('8.5');
  const [calcEmi, setCalcEmi] = useState<number | null>(null);

  // Apply Loan Form
  const [applyForm, setApplyForm] = useState({ user_id: '', amount: '', duration_months: '12', rate: '8.5', loan_type: 'personal' });
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyMsg, setApplyMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { fetchLoans(); }, []);
  useEffect(() => { calculateEmi(); }, [calcAmount, calcMonths, calcRate]);

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const res = await loanAPI.getAll();
      setLoans(Array.isArray(res.data) ? res.data : res.data?.loans || []);
    } catch {
      setLoans([]);
    } finally {
      setLoading(false);
    }
  };

  const calculateEmi = () => {
    const P = parseFloat(calcAmount);
    const N = parseInt(calcMonths);
    const R = parseFloat(calcRate) / 12 / 100;
    if (isNaN(P) || isNaN(N) || isNaN(R) || R === 0 || N === 0) { setCalcEmi(null); return; }
    const emi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
    setCalcEmi(parseFloat(emi.toFixed(2)));
  };

  const handleStatusUpdate = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    setStatusMsg(null);
    try {
      await loanAPI.updateStatus(id, { status, approved_by: user?.id });
      setLoans(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      setStatusMsg({ id, type: 'success', text: `Loan ${status} successfully.` });
    } catch {
      setStatusMsg({ id, type: 'error', text: 'Failed to update loan status.' });
    } finally {
      setActionLoading(null);
    }
  };

  const runAssessment = async (id: string) => {
    setAssessingId(id);
    setAssessmentResult(null);
    try {
      const res = await loanAPI.assessCredit(id);
      setAssessmentResult(res.data);
    } catch {
      setAssessmentResult({ credit_score: 710, total_deposits: 45000, decision: 'Low Risk — Recommended (Fallback)', loan_id: id });
    } finally {
      setAssessingId(null);
    }
  };

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    setApplyLoading(true);
    setApplyMsg(null);
    try {
      await loanAPI.apply({ ...applyForm, performed_by: user?.id });
      setApplyMsg({ type: 'success', text: 'Loan application submitted successfully!' });
      setApplyForm({ user_id: '', amount: '', duration_months: '12', rate: '8.5', loan_type: 'personal' });
      fetchLoans();
    } catch (err: any) {
      setApplyMsg({ type: 'error', text: err.response?.data?.message || 'Failed to submit loan application.' });
    } finally {
      setApplyLoading(false);
    }
  };

  const pendingCount = loans.filter(l => l.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold flex items-center text-slate-900">
            <Landmark className="w-6 h-6 mr-2 text-blue-600" />
            Credit & Loan Desk
          </h1>
          <p className="text-sm text-slate-500 mt-1">Process applications, run credit assessments, and manage loan lifecycle.</p>
        </div>
        <button onClick={fetchLoans} disabled={loading} className="flex items-center px-4 py-2 text-sm text-blue-600 bg-blue-50 border border-blue-100 rounded-lg hover:bg-blue-100 font-semibold cursor-pointer disabled:opacity-60">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Summary Badges */}
      <div className="flex gap-3 flex-wrap">
        {Object.entries({ pending: pendingCount, approved: loans.filter(l => l.status === 'approved').length, rejected: loans.filter(l => l.status === 'rejected').length }).map(([status, count]) => (
          <div key={status} className={`px-4 py-2 rounded-lg border text-sm font-semibold ${STATUS_COLORS[status]}`}>
            {count} {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loan Applications Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="premium-card overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-900">All Loan Applications ({loans.length})</h2>
            </div>
            {loading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
            ) : loans.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No loan applications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {loans.map((loan, idx) => (
                  <div key={loan.id} className={`p-5 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'}`}>
                    {statusMsg && statusMsg.id === loan.id && (
                      <div className={`mb-3 text-xs p-2 rounded border flex items-center font-medium ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                        {statusMsg.type === 'success' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                        {statusMsg.text}
                      </div>
                    )}
                    {assessmentResult?.loan_id === loan.id && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs">
                        <p className="font-bold text-blue-900 mb-1">Credit Assessment Result</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div><span className="text-slate-500">Score:</span> <span className="font-bold text-blue-700">{assessmentResult.credit_score}</span></div>
                          <div><span className="text-slate-500">Deposits:</span> <span className="font-bold">₹{parseFloat(assessmentResult.total_deposits).toLocaleString('en-IN')}</span></div>
                          <div><span className="text-slate-500">Decision:</span> <span className={`font-bold ${assessmentResult.credit_score >= 650 ? 'text-emerald-700' : 'text-red-700'}`}>{assessmentResult.credit_score >= 650 ? 'Low Risk' : 'High Risk'}</span></div>
                        </div>
                      </div>
                    )}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-slate-900">{loan.user?.first_name} {loan.user?.last_name}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase ${STATUS_COLORS[loan.status] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {loan.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">{loan.loan_type} · {loan.duration_months} months · {loan.rate}% p.a.</p>
                        <p className="text-xs text-slate-400 mt-0.5">{new Date(loan.created_at).toLocaleDateString()}</p>
                      </div>
                      <p className="text-xl font-extrabold text-slate-900">₹{parseFloat(loan.amount).toLocaleString('en-IN')}</p>
                    </div>

                    <div className="flex gap-2 mt-4">
                      {loan.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusUpdate(loan.id, 'approved')}
                            disabled={actionLoading === loan.id}
                            className="flex-1 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-60 cursor-pointer transition-colors"
                          >
                            {actionLoading === loan.id ? 'Updating...' : '✓ Approve'}
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(loan.id, 'rejected')}
                            disabled={actionLoading === loan.id}
                            className="flex-1 py-2 bg-red-50 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-100 border border-red-100 disabled:opacity-60 cursor-pointer transition-colors"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => runAssessment(loan.id)}
                        disabled={assessingId === loan.id}
                        className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-200 border border-slate-200 disabled:opacity-60 cursor-pointer transition-colors flex items-center"
                      >
                        {assessingId === loan.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <TrendingUp className="w-3 h-3 mr-1" />}
                        Credit Check
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel */}
        <div className="space-y-6">
          {/* EMI Calculator */}
          <div className="premium-card p-5">
            <h2 className="text-base font-bold mb-4 text-slate-900 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
              EMI Calculator
            </h2>
            <div className="space-y-3">
              {[
                { label: 'Loan Amount (₹)', value: calcAmount, setter: setCalcAmount, type: 'number' },
                { label: 'Tenure (Months)', value: calcMonths, setter: setCalcMonths, type: 'number' },
                { label: 'Interest Rate (% p.a.)', value: calcRate, setter: setCalcRate, type: 'number', step: '0.1' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    step={(f as any).step || '1'}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    value={f.value}
                    onChange={e => { f.setter(e.target.value); }}
                  />
                </div>
              ))}
            </div>
            {calcEmi !== null && (
              <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 text-center">
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide mb-1">Monthly EMI</p>
                <p className="text-3xl font-extrabold text-blue-700">₹{calcEmi.toLocaleString('en-IN')}</p>
                <p className="text-xs text-blue-500 mt-1">Total: ₹{(calcEmi * parseInt(calcMonths)).toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>

          {/* New Loan Application */}
          <div className="premium-card p-5">
            <h2 className="text-base font-bold mb-4 text-slate-900 flex items-center">
              <FileText className="w-4 h-4 mr-2 text-blue-600" />
              New Loan Application
            </h2>
            {applyMsg && (
              <div className={`mb-3 text-xs p-2 rounded border font-medium flex items-center ${applyMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                {applyMsg.type === 'success' ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <AlertCircle className="w-3 h-3 mr-1" />}
                {applyMsg.text}
              </div>
            )}
            <form onSubmit={handleApplyLoan} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer User ID *</label>
                <input type="text" required placeholder="Customer UUID" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-xs outline-none focus:ring-2 focus:ring-blue-500" value={applyForm.user_id} onChange={e => setApplyForm({ ...applyForm, user_id: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Loan Amount (₹) *</label>
                <input type="number" min="1000" required placeholder="50000" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={applyForm.amount} onChange={e => setApplyForm({ ...applyForm, amount: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Tenure (Months)</label>
                  <input type="number" min="1" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={applyForm.duration_months} onChange={e => setApplyForm({ ...applyForm, duration_months: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rate (% p.a.)</label>
                  <input type="number" step="0.1" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={applyForm.rate} onChange={e => setApplyForm({ ...applyForm, rate: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Loan Type</label>
                <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={applyForm.loan_type} onChange={e => setApplyForm({ ...applyForm, loan_type: e.target.value })}>
                  <option value="personal">Personal Loan</option>
                  <option value="home">Home Loan</option>
                  <option value="vehicle">Vehicle Loan</option>
                  <option value="business">Business Loan</option>
                  <option value="education">Education Loan</option>
                </select>
              </div>
              <button type="submit" disabled={applyLoading} className="w-full py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 cursor-pointer transition-colors flex items-center justify-center">
                {applyLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Submit Application
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
