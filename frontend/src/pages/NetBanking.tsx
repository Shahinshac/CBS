import React, { useState, useEffect } from 'react';
import { accountAPI, transactionAPI, cardAPI, loanAPI, notificationAPI, beneficiaryAPI, billAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  IndianRupee, CreditCard, Send, BookOpen, Bell, TrendingUp,
  Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, History,
  Plus, Users, Receipt, FileDown, Trash2, ArrowUpRight, ArrowDownLeft
} from 'lucide-react';

const TX_TYPE_STYLE: Record<string, { label: string; color: string }> = {
  deposit: { label: 'Credit', color: 'text-emerald-600' },
  withdrawal: { label: 'Debit', color: 'text-red-600' },
  transfer: { label: 'Transfer', color: 'text-blue-600' },
};

export const NetBanking = () => {
  const { user } = useAuthStore();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<'dashboard' | 'transfer' | 'fdrd' | 'cards' | 'loans' | 'history' | 'beneficiaries' | 'bills' | 'statement'>('dashboard');
  const [showBalance, setShowBalance] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Transfer State
  const [toAccountNum, setToAccountNum] = useState('');
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [transferMode, setTransferMode] = useState('IMPS');
  const [transferStatus, setTransferStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [isExternalTransfer, setIsExternalTransfer] = useState(false);
  const [toIfsc, setToIfsc] = useState('');
  const [toRecipientName, setToRecipientName] = useState('');
  const [toBankName, setToBankName] = useState('');

  // FD/RD
  const [fdAmount, setFdAmount] = useState('');
  const [fdMonths, setFdMonths] = useState('12');
  const [fdType, setFdType] = useState<'fd' | 'rd'>('fd');
  const [fdStatus, setFdStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [fdLoading, setFdLoading] = useState(false);

  // Loan
  const [myLoans, setMyLoans] = useState<any[]>([]);
  const [loanLoading, setLoanLoading] = useState(false);

  // Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [benName, setBenName] = useState('');
  const [benAccount, setBenAccount] = useState('');
  const [benIfsc, setBenIfsc] = useState('');
  const [benNickname, setBenNickname] = useState('');
  const [benStatus, setBenStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Bills
  const [bills, setBills] = useState<any[]>([]);
  const [billStatus, setBillStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [newBillerName, setNewBillerName] = useState('');
  const [newBillerCategory, setNewBillerCategory] = useState('utility');
  const [newConsumerNum, setNewConsumerNum] = useState('');
  const [newBillAmount, setNewBillAmount] = useState('');

  // Statement
  const [stmtFrom, setStmtFrom] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [stmtTo, setStmtTo] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const [accRes, txRes] = await Promise.all([
        accountAPI.getAll({ user_id: user.id }),
        transactionAPI.getAll({ user_id: user.id, limit: 20 }),
      ]);
      const accs = accRes.data.accounts || [];
      setAccounts(accs);
      setTransactions(txRes.data.transactions || []);
      if (accs.length > 0 && !selectedAccountId) setSelectedAccountId(accs[0].id);

      // Load notifications
      try {
        const notifRes = await notificationAPI.getAll(user.id);
        setNotifications((notifRes.data || []).filter((n: any) => !n.is_read).slice(0, 5));
      } catch { /* non-fatal */ }
    } catch {
      setError('Could not load your accounts. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLoans = async () => {
    if (!user?.id) return;
    setLoanLoading(true);
    try {
      const res = await loanAPI.getAll({ user_id: user.id });
      setMyLoans(Array.isArray(res.data) ? res.data : res.data?.loans || []);
    } catch { setMyLoans([]); }
    finally { setLoanLoading(false); }
  };

  const fetchBeneficiaries = async () => {
    if (!user?.id) return;
    try {
      const res = await beneficiaryAPI.getAll(user.id);
      setBeneficiaries(Array.isArray(res.data) ? res.data : []);
    } catch { setBeneficiaries([]); }
  };

  const fetchBills = async () => {
    if (!selectedAccountId) return;
    try {
      const res = await billAPI.getAll(selectedAccountId);
      setBills(Array.isArray(res.data) ? res.data : []);
    } catch { setBills([]); }
  };

  const handleAddBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    setBenStatus(null);
    try {
      await beneficiaryAPI.add({ user_id: user?.id, name: benName, account_number: benAccount, ifsc_code: benIfsc, nickname: benNickname });
      setBenStatus({ type: 'success', message: 'Beneficiary added successfully.' });
      setBenName(''); setBenAccount(''); setBenIfsc(''); setBenNickname('');
      fetchBeneficiaries();
    } catch (err: any) {
      setBenStatus({ type: 'error', message: err.response?.data?.message || 'Failed to add beneficiary.' });
    }
  };

  const handleRemoveBeneficiary = async (id: string) => {
    if (!confirm('Remove this beneficiary?')) return;
    try {
      await beneficiaryAPI.remove(id, user?.id || '');
      fetchBeneficiaries();
    } catch {}
  };

  const handleAddBill = async (e: React.FormEvent) => {
    e.preventDefault();
    setBillStatus(null);
    try {
      await billAPI.create({ account_id: selectedAccountId, biller_name: newBillerName, biller_category: newBillerCategory, consumer_number: newConsumerNum, amount: parseFloat(newBillAmount) });
      setBillStatus({ type: 'success', message: 'Biller added.' });
      setNewBillerName(''); setNewConsumerNum(''); setNewBillAmount('');
      fetchBills();
    } catch (err: any) {
      setBillStatus({ type: 'error', message: err.response?.data?.message || 'Failed.' });
    }
  };

  const handlePayBill = async (billId: string) => {
    setBillStatus(null);
    try {
      await billAPI.pay(billId, { performed_by: user?.id });
      setBillStatus({ type: 'success', message: 'Bill paid successfully!' });
      fetchBills(); fetchAll();
    } catch (err: any) {
      setBillStatus({ type: 'error', message: err.response?.data?.message || 'Payment failed.' });
    }
  };

  const downloadStatement = () => {
    const url = accountAPI.getStatement(selectedAccountId, { from_date: stmtFrom, to_date: stmtTo });
    window.open(url, '_blank');
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !toAccountNum || !amount) return;
    if (isExternalTransfer && !toIfsc) {
      setTransferStatus({ type: 'error', message: 'IFSC Code is required for transfers to another bank.' });
      return;
    }
    setTransferLoading(true);
    setTransferStatus(null);
    try {
      await transactionAPI.cbsTransfer({
        from_account_id: selectedAccountId,
        to_account_id: toAccountNum,
        to_ifsc: isExternalTransfer ? toIfsc : 'CRBN0001001',
        to_bank_name: isExternalTransfer ? toBankName : 'CoreBank',
        to_recipient_name: isExternalTransfer ? toRecipientName : '',
        amount: parseFloat(amount),
        transfer_mode: transferMode,
        description: desc || 'Net Banking Transfer',
        performed_by: user?.id,
      });
      setTransferStatus({ type: 'success', message: `Transfer of ₹${amount} via ${transferMode} completed successfully!` });
      setAmount(''); setToAccountNum(''); setDesc(''); setToIfsc(''); setToRecipientName(''); setToBankName('');
      fetchAll();
    } catch (err: any) {
      setTransferStatus({ type: 'error', message: err.response?.data?.message || 'Transfer failed.' });
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCreateFdRd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fdAmount) return;
    setFdLoading(true);
    setFdStatus(null);
    try {
      await accountAPI.createFdRd({ user_id: user?.id, amount: parseFloat(fdAmount), months: parseInt(fdMonths), type: fdType });
      setFdStatus({ type: 'success', message: `${fdType.toUpperCase()} of ₹${fdAmount} for ${fdMonths} months created!` });
      setFdAmount('');
      fetchAll();
    } catch (err: any) {
      setFdStatus({ type: 'error', message: err.response?.data?.message || 'Failed to create term deposit.' });
    } finally {
      setFdLoading(false);
    }
  };

  const totalBalance = accounts
    .filter(a => a.account_type === 'savings' || a.account_type === 'current')
    .reduce((sum, a) => sum + parseFloat(a.balance || 0), 0);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: IndianRupee },
    { id: 'transfer', label: 'Transfer', icon: Send },
    { id: 'beneficiaries', label: 'Beneficiaries', icon: Users, onLoad: fetchBeneficiaries },
    { id: 'bills', label: 'Bill Pay', icon: Receipt, onLoad: fetchBills },
    { id: 'fdrd', label: 'FD / RD', icon: TrendingUp },
    { id: 'cards', label: 'My Cards', icon: CreditCard },
    { id: 'loans', label: 'My Loans', icon: BookOpen },
    { id: 'history', label: 'History', icon: History },
    { id: 'statement', label: 'Statement', icon: FileDown },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-800 border border-red-200 flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 text-red-600" />
          <span>{error}</span>
        </div>
      )}
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-7 rounded-2xl relative overflow-hidden">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-blue-300 text-sm font-medium mb-1">Good day,</p>
            <h1 className="text-2xl font-extrabold">{user?.first_name} {user?.last_name}</h1>
            <p className="text-slate-400 text-sm mt-0.5">{accounts.length} account{accounts.length !== 1 ? 's' : ''} · Secure Net Banking</p>
          </div>
          <div className="text-right">
            <button onClick={() => setShowBalance(!showBalance)} className="mb-1 flex items-center text-slate-400 hover:text-white cursor-pointer text-xs gap-1 ml-auto">
              {showBalance ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              {showBalance ? 'Hide' : 'Show'} balance
            </button>
            <p className="text-3xl font-extrabold">
              {showBalance ? `₹${totalBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ ••••••'}
            </p>
            <p className="text-slate-400 text-xs mt-0.5">Total Available Balance</p>
          </div>
        </div>
        <div className="absolute right-0 bottom-0 opacity-5 transform translate-x-10 translate-y-10 scale-150 pointer-events-none">
          <IndianRupee className="w-64 h-64" />
        </div>
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className="premium-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Bell className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-bold text-slate-900">Notifications</span>
          </div>
          <div className="space-y-2">
            {notifications.map(n => (
              <div key={n.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                  <p className="text-xs text-slate-600">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => { setActiveSection(item.id as any); if (item.id === 'loans') fetchLoans(); if ((item as any).onLoad) (item as any).onLoad(); }}
            className={`flex items-center px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all cursor-pointer border ${activeSection === item.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}
          >
            <item.icon className="w-4 h-4 mr-2" />
            {item.label}
          </button>
        ))}
      </div>

      {/* Dashboard */}
      {activeSection === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(acc => (
            <div key={acc.id} className="premium-card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{acc.account_type}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${acc.status === 'active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>{acc.status}</span>
              </div>
              <p className="text-xs font-mono text-slate-500 mb-2">{acc.account_number}</p>
              <p className="text-2xl font-extrabold text-slate-900">
                {showBalance ? `₹${parseFloat(acc.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '₹ ••••••'}
              </p>
              <p className="text-xs text-slate-400 mt-1">Interest: {acc.interest_rate}% p.a.</p>
              {acc.cards?.map((card: any) => (
                <div key={card.id} className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 flex justify-between">
                  <span>Card: ****{card.card_number?.slice(-4)}</span>
                  <span className={card.is_blocked ? 'text-red-600 font-semibold' : 'text-emerald-600 font-semibold'}>{card.is_blocked ? 'Blocked' : 'Active'}</span>
                </div>
              ))}
            </div>
          ))}
          {accounts.length === 0 && (
            <div className="col-span-3 text-center py-12 text-slate-400">
              <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No accounts found. Visit your branch to open an account.</p>
            </div>
          )}
        </div>
      )}

      {/* Transfer */}
      {activeSection === 'transfer' && (
        <div className="premium-card p-6 max-w-lg">
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center">
            <Send className="w-5 h-5 mr-2 text-blue-600" /> Fund Transfer
          </h2>
          {transferStatus && (
            <div className={`mb-5 p-4 rounded-lg border flex items-start text-sm ${transferStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              {transferStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-2 text-emerald-600" /> : <AlertCircle className="w-5 h-5 mr-2 text-red-600" />}
              <span className="font-medium">{transferStatus.message}</span>
            </div>
          )}
          <form onSubmit={handleTransfer} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">From Account</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                {accounts.filter(a => a.account_type !== 'fd' && a.account_type !== 'rd').map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.account_number} — ₹{parseFloat(acc.balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Mode</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={transferMode} onChange={e => setTransferMode(e.target.value)}>
                <option value="IMPS">IMPS — Instant (24/7)</option>
                <option value="RTGS">RTGS — High Value, Immediate</option>
                <option value="NEFT">NEFT — Batched Settlement</option>
              </select>
            </div>
            <div className="flex gap-3 mb-4">
              <button
                type="button"
                onClick={() => setIsExternalTransfer(false)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  !isExternalTransfer ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                }`}
              >
                Within CoreBank
              </button>
              <button
                type="button"
                onClick={() => setIsExternalTransfer(true)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                  isExternalTransfer ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                }`}
              >
                To Other Bank
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {isExternalTransfer ? 'Recipient Account Number *' : 'To Account Number *'}
              </label>
              <input type="text" required placeholder="Enter account number" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={toAccountNum} onChange={e => setToAccountNum(e.target.value)} />
            </div>

            {isExternalTransfer && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient IFSC Code *</label>
                  <input type="text" required placeholder="Enter recipient IFSC code" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500 uppercase" value={toIfsc} onChange={e => setToIfsc(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Full Name *</label>
                  <input type="text" required placeholder="Enter recipient full name" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={toRecipientName} onChange={e => setToRecipientName(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Recipient Bank Name *</label>
                  <input type="text" required placeholder="Enter bank name" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={toBankName} onChange={e => setToBankName(e.target.value)} />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
              <input type="number" min="1" step="0.01" required placeholder="0.00" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-slate-900 text-xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Remarks (Optional)</label>
              <input type="text" placeholder="Remarks" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
            <button type="submit" disabled={transferLoading} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60 cursor-pointer transition-colors flex items-center justify-center">
              {transferLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              {transferLoading ? 'Processing...' : `Transfer via ${transferMode}`}
            </button>
          </form>
        </div>
      )}

      {/* FD / RD */}
      {activeSection === 'fdrd' && (
        <div className="premium-card p-6 max-w-md">
          <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-blue-600" /> Open Term Deposit
          </h2>
          {fdStatus && (
            <div className={`mb-4 p-3 rounded-lg border text-sm font-medium flex items-center ${fdStatus.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
              {fdStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4 mr-2" /> : <AlertCircle className="w-4 h-4 mr-2" />}
              {fdStatus.message}
            </div>
          )}
          <form onSubmit={handleCreateFdRd} className="space-y-4">
            <div className="flex gap-3">
              {(['fd', 'rd'] as const).map(t => (
                <button key={t} type="button" onClick={() => setFdType(t)} className={`flex-1 py-2.5 rounded-lg text-sm font-bold border cursor-pointer transition-all ${fdType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'}`}>
                  {t === 'fd' ? 'Fixed Deposit (FD)' : 'Recurring Deposit (RD)'}
                </button>
              ))}
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-xs text-blue-700">
              Interest Rate: <span className="font-bold">{fdType === 'fd' ? '7.25% p.a.' : '6.75% p.a.'}</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{fdType === 'fd' ? 'Deposit Amount (₹)' : 'Monthly Installment (₹)'} *</label>
              <input type="number" min="1000" required placeholder="Min. ₹1,000" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500" value={fdAmount} onChange={e => setFdAmount(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Tenure (Months)</label>
              <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-900 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500" value={fdMonths} onChange={e => setFdMonths(e.target.value)}>
                {[3, 6, 12, 24, 36, 60].map(m => <option key={m} value={m}>{m} months</option>)}
              </select>
            </div>
            <button type="submit" disabled={fdLoading} className="w-full py-3 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-60 cursor-pointer transition-colors flex items-center justify-center">
              {fdLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Open {fdType.toUpperCase()}
            </button>
          </form>
        </div>
      )}

      {/* Cards */}
      {activeSection === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {accounts.flatMap(acc => (acc.cards || []).map((card: any) => (
            <div key={card.id} className="premium-card p-6">
              <div className="bg-gradient-to-r from-slate-800 to-blue-900 rounded-xl p-5 text-white mb-4 relative overflow-hidden">
                <p className="text-xs text-blue-300 mb-3">CoreBank Debit Card</p>
                <p className="font-mono text-lg tracking-widest mb-3">•••• •••• •••• {card.card_number?.slice(-4)}</p>
                <div className="flex justify-between text-xs text-blue-300">
                  <span>Expires: {card.expiry_date}</span>
                  <span className={`font-bold ${card.is_blocked ? 'text-red-400' : 'text-emerald-400'}`}>{card.is_blocked ? '🔒 BLOCKED' : '✓ ACTIVE'}</span>
                </div>
                <div className="absolute right-4 top-4 opacity-20">
                  <CreditCard className="w-12 h-12" />
                </div>
              </div>
              <div className="space-y-2 text-sm mb-4">
                <div className="flex justify-between"><span className="text-slate-500">Account</span><span className="font-mono text-slate-900 text-xs">{acc.account_number}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Daily Limit</span><span className="font-semibold text-slate-900">₹{parseFloat(card.daily_limit || 50000).toLocaleString('en-IN')}</span></div>
              </div>
              <button
                onClick={async () => {
                  try {
                    const res = await cardAPI.toggleBlock(card.id);
                    setAccounts(prev => prev.map(a => ({
                      ...a,
                      cards: (a.cards || []).map((c: any) => c.id === card.id ? { ...c, is_blocked: res.data.is_blocked } : c)
                    })));
                  } catch { alert('Failed to update card status.'); }
                }}
                className={`w-full py-2 rounded-lg text-sm font-semibold border cursor-pointer transition-colors ${card.is_blocked ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' : 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100'}`}
              >
                {card.is_blocked ? '🔓 Unblock Card' : '🔒 Block Card'}
              </button>
            </div>
          )))}
          {accounts.flatMap(a => a.cards || []).length === 0 && (
            <div className="col-span-2 text-center py-12 text-slate-400">
              <CreditCard className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No cards found.</p>
            </div>
          )}
        </div>
      )}

      {/* Loans */}
      {activeSection === 'loans' && (
        <div className="premium-card overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <BookOpen className="w-4 h-4 mr-2 text-blue-600" /> My Loan Applications
            </h2>
          </div>
          {loanLoading ? (
            <div className="p-10 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : myLoans.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-sm">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No loan applications found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myLoans.map(loan => (
                <div key={loan.id} className="p-5 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 capitalize">{loan.loan_type} Loan</p>
                    <p className="text-xs text-slate-500">{loan.duration_months} months · {loan.rate}% p.a. · Applied {new Date(loan.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-extrabold text-slate-900">₹{parseFloat(loan.amount).toLocaleString('en-IN')}</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${loan.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-100' : loan.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                      {loan.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transaction History */}
      {activeSection === 'history' && (
        <div className="premium-card overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <History className="w-4 h-4 mr-2 text-blue-600" /> Transaction History
            </h2>
            <span className="text-xs text-slate-400">{transactions.length} records</span>
          </div>
          {transactions.length === 0 ? (
            <div className="p-10 text-center text-slate-400">
              <History className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.map(tx => {
                const isDebit = tx.transaction_type === 'withdrawal' || (tx.transaction_type === 'transfer' && accounts.some(a => a.id === tx.from_account_id));
                const style = TX_TYPE_STYLE[tx.transaction_type] || { label: tx.transaction_type, color: 'text-slate-700' };
                return (
                  <div key={tx.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center mr-4 ${isDebit ? 'bg-red-50' : 'bg-emerald-50'}`}>
                        {isDebit ? <ArrowUpRight className="w-4 h-4 text-red-600" /> : <ArrowDownLeft className="w-4 h-4 text-emerald-600" />}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{tx.description || style.label}</p>
                        <p className="text-xs text-slate-400">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold text-sm ${isDebit ? 'text-red-600' : 'text-emerald-600'}`}>
                        {isDebit ? '−' : '+'}₹{parseFloat(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${tx.status === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>{tx.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Beneficiaries */}
      {activeSection === 'beneficiaries' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-bold text-slate-900 mb-4">Add New Beneficiary</h2>
            {benStatus && (
              <div className={`mb-3 p-3 rounded-lg text-sm ${benStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {benStatus.message}
              </div>
            )}
            <form onSubmit={handleAddBeneficiary} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Beneficiary Name</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={benName} onChange={e => setBenName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Account Number</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={benAccount} onChange={e => setBenAccount(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">IFSC Code</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={benIfsc} onChange={e => setBenIfsc(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Nickname (optional)</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={benNickname} onChange={e => setBenNickname(e.target.value)} />
              </div>
              <div className="col-span-2">
                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Add Beneficiary</button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">My Beneficiaries ({beneficiaries.length})</h2>
            </div>
            {beneficiaries.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No beneficiaries added yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {beneficiaries.map((b: any) => (
                  <div key={b.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{b.name}</p>
                      <p className="text-xs text-slate-500">{b.account_number} · {b.bank_name}</p>
                      {b.nickname && <p className="text-xs text-blue-600">"{b.nickname}"</p>}
                    </div>
                    <button onClick={() => handleRemoveBeneficiary(b.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bill Payments */}
      {activeSection === 'bills' && (
        <div className="space-y-5">
          {billStatus && (
            <div className={`p-3 rounded-lg text-sm font-medium ${billStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {billStatus.message}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-bold text-slate-900 mb-4">Add Biller</h2>
            <form onSubmit={handleAddBill} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Biller Name</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newBillerName} onChange={e => setNewBillerName(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Category</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newBillerCategory} onChange={e => setNewBillerCategory(e.target.value)}>
                  <option value="utility">Electricity / Utility</option>
                  <option value="mobile">Mobile Recharge</option>
                  <option value="broadband">Broadband / DTH</option>
                  <option value="insurance">Insurance</option>
                  <option value="emi">EMI / Loan</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Consumer / Account No.</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newConsumerNum} onChange={e => setNewConsumerNum(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Amount (₹)</label>
                <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newBillAmount} onChange={e => setNewBillAmount(e.target.value)} required />
              </div>
              <div className="col-span-2">
                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">Add Biller</button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Pending Bills ({bills.filter(b => b.status === 'pending').length})</h2>
            </div>
            {bills.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No bills added yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {bills.map((b: any) => (
                  <div key={b.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{b.biller_name}</p>
                      <p className="text-xs text-slate-500 capitalize">{b.biller_category} · {b.consumer_number}</p>
                      {b.due_date && <p className="text-xs text-amber-600">Due: {new Date(b.due_date).toLocaleDateString('en-IN')}</p>}
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-bold text-slate-900">₹{Number(b.amount).toLocaleString('en-IN')}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{b.status}</span>
                      </div>
                      {b.status === 'pending' && (
                        <button onClick={() => handlePayBill(b.id)} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700">Pay Now</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF Statement Download */}
      {activeSection === 'statement' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 max-w-md">
          <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <FileDown className="w-5 h-5 text-blue-600" /> Download Account Statement
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Account</label>
              <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} ({a.account_type})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">From Date</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={stmtFrom} onChange={e => setStmtFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">To Date</label>
              <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={stmtTo} onChange={e => setStmtTo(e.target.value)} />
            </div>
            <button
              onClick={downloadStatement}
              disabled={!selectedAccountId}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <FileDown className="w-4 h-4" /> Download PDF Statement
            </button>
            <p className="text-xs text-slate-500 text-center">The statement will include all transactions in the selected period with opening and closing balances.</p>
          </div>
        </div>
      )}
    </div>
  );
};

