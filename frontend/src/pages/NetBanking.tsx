import React, { useState, useEffect } from 'react';
import { accountAPI, transactionAPI, cardAPI, loanAPI, notificationAPI, beneficiaryAPI, billAPI, scheduledPaymentAPI, authAPI, ticketAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';
import {
  IndianRupee, CreditCard, Send, BookOpen, Bell, TrendingUp,
  Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, History,
  Plus, Users, Receipt, FileDown, Trash2, ArrowUpRight, ArrowDownLeft,
  Clock, Settings, Book, Printer, HelpCircle, MessageSquare, SendHorizontal
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
  const [activeSection, setActiveSection] = useState<'dashboard' | 'transfer' | 'fdrd' | 'cards' | 'loans' | 'history' | 'beneficiaries' | 'bills' | 'statement' | 'standing-instructions' | 'passbook' | 'settings' | 'support'>('dashboard');
  const [showBalance, setShowBalance] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState('');

  // Standing Instructions State
  const [scheduledPayments, setScheduledPayments] = useState<any[]>([]);
  const [spAmount, setSpAmount] = useState('');
  const [spToAccount, setSpToAccount] = useState('');
  const [spFrequency, setSpFrequency] = useState('monthly');
  const [spNextRun, setSpNextRun] = useState('');
  const [spDesc, setSpDesc] = useState('');
  const [spStatus, setSpStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [spLoading, setSpLoading] = useState(false);

  // Settings / Profile State
  const [prefPhone, setPrefPhone] = useState(user?.phone_number || '');
  const [prefAddress, setPrefAddress] = useState(user?.address || '');
  const [prefCity, setPrefCity] = useState(user?.city || '');
  const [prefPincode, setPrefPincode] = useState(user?.pincode || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingsStatus, setSettingsStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
  const [showApplyLoan, setShowApplyLoan] = useState(false);
  const [loanForm, setLoanForm] = useState({
    loan_type: 'personal', amount: '', duration_months: '12', purpose: '',
    monthly_income: '', employment_status: 'salaried', employer_name: '', existing_loan_details: '', remarks: ''
  });
  const [loanStatusMsg, setLoanStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loanSubmitting, setLoanSubmitting] = useState(false);

  // Support Tickets
  const [tickets, setTickets] = useState<any[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'account', priority: 'medium', description: '' });
  const [ticketStatusMsg, setTicketStatusMsg] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [ticketSubmitting, setTicketSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replySubmitting, setReplySubmitting] = useState(false);

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

  const handleApplyLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !loanForm.amount) return;
    setLoanSubmitting(true);
    setLoanStatusMsg(null);
    try {
      await loanAPI.apply({ ...loanForm, user_id: user.id });
      setLoanStatusMsg({ type: 'success', message: 'Loan application submitted successfully!' });
      setShowApplyLoan(false);
      setLoanForm({ loan_type: 'personal', amount: '', duration_months: '12', purpose: '', monthly_income: '', employment_status: 'salaried', employer_name: '', existing_loan_details: '', remarks: '' });
      fetchLoans();
    } catch (err: any) {
      setLoanStatusMsg({ type: 'error', message: err.response?.data?.message || 'Failed to submit loan application.' });
    } finally {
      setLoanSubmitting(false);
    }
  };

  const handleCancelLoan = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this loan application?')) return;
    try {
      await loanAPI.cancel(id, 'Cancelled by customer');
      fetchLoans();
    } catch {
      alert('Failed to cancel loan application.');
    }
  };

  const fetchTickets = async () => {
    if (!user?.id) return;
    setTicketLoading(true);
    try {
      const res = await ticketAPI.getAll({ user_id: user.id });
      const tks = Array.isArray(res.data) ? res.data : [];
      setTickets(tks);
      if (selectedTicket) {
        const updated = tks.find((t: any) => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch { setTickets([]); }
    finally { setTicketLoading(false); }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !ticketForm.subject.trim()) return;
    setTicketSubmitting(true);
    setTicketStatusMsg(null);
    try {
      await ticketAPI.create({ ...ticketForm, user_id: user.id });
      setTicketStatusMsg({ type: 'success', message: 'Support ticket registered successfully!' });
      setShowNewTicket(false);
      setTicketForm({ subject: '', category: 'account', priority: 'medium', description: '' });
      fetchTickets();
    } catch (err: any) {
      setTicketStatusMsg({ type: 'error', message: err.response?.data?.message || 'Failed to create ticket.' });
    } finally {
      setTicketSubmitting(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim() || !user) return;
    setReplySubmitting(true);
    try {
      await ticketAPI.reply(selectedTicket.id, {
        user_id: user.id,
        message: replyText,
        user_name: `${user.first_name} ${user.last_name}`,
        user_role: 'customer',
      });
      setReplyText('');
      fetchTickets();
    } catch {
      alert('Failed to post reply.');
    } finally {
      setReplySubmitting(false);
    }
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

  const fetchScheduledPayments = async () => {
    if (!user?.id) return;
    try {
      const res = await scheduledPaymentAPI.getAll({ user_id: user.id });
      setScheduledPayments(Array.isArray(res.data) ? res.data : []);
    } catch {
      setScheduledPayments([]);
    }
  };

  const handleCreateScheduledPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId || !spToAccount || !spAmount || !spNextRun) return;
    setSpLoading(true);
    setSpStatus(null);
    try {
      await scheduledPaymentAPI.create({
        account_id: selectedAccountId,
        to_account_num: spToAccount,
        amount: parseFloat(spAmount),
        frequency: spFrequency,
        next_run: spNextRun,
        description: spDesc || 'Standing Instruction',
      });
      setSpStatus({ type: 'success', message: 'Standing Instruction created successfully.' });
      setSpAmount('');
      setSpToAccount('');
      setSpDesc('');
      setSpNextRun('');
      fetchScheduledPayments();
      fetchAll();
    } catch (err: any) {
      setSpStatus({ type: 'error', message: err.response?.data?.message || 'Failed to create instruction.' });
    } finally {
      setSpLoading(false);
    }
  };

  const handleCancelScheduledPayment = async (id: string) => {
    if (!confirm('Cancel this Standing Instruction?')) return;
    try {
      await scheduledPaymentAPI.cancel(id);
      fetchScheduledPayments();
    } catch {}
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsStatus(null);
    try {
      await authAPI.updateProfile({
        id: user?.id,
        phone_number: prefPhone,
        address: prefAddress,
        city: prefCity,
        pincode: prefPincode,
      });
      setSettingsStatus({ type: 'success', message: 'Profile updated successfully.' });
    } catch (err: any) {
      setSettingsStatus({ type: 'error', message: err.response?.data?.message || 'Failed to update profile.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatus(null);
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: 'New passwords do not match.' });
      return;
    }
    try {
      await authAPI.changePassword({
        user_id: user?.id,
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordStatus({ type: 'success', message: 'Password updated successfully.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordStatus({ type: 'error', message: err.response?.data?.message || 'Failed to change password.' });
    }
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
    { id: 'loans', label: 'My Loans', icon: BookOpen, onLoad: fetchLoans },
    { id: 'history', label: 'History', icon: History },
    { id: 'statement', label: 'Statement', icon: FileDown },
    { id: 'standing-instructions', label: 'Standing Instructions', icon: Clock, onLoad: fetchScheduledPayments },
    { id: 'passbook', label: 'Passbook', icon: Book },
    { id: 'support', label: 'Support Center', icon: HelpCircle, onLoad: fetchTickets },
    { id: 'settings', label: 'Settings', icon: Settings },
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
        <div className="space-y-6">
          {loanStatusMsg && (
            <div className={`p-4 rounded-xl border flex items-center ${loanStatusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {loanStatusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
              {loanStatusMsg.message}
            </div>
          )}

          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Loan Portal</h2>
              <p className="text-xs text-slate-500">Apply for commercial banking loans and track EMI schedules.</p>
            </div>
            <button
              onClick={() => setShowApplyLoan(!showApplyLoan)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1" /> {showApplyLoan ? 'Cancel Application' : 'Apply for New Loan'}
            </button>
          </div>

          {/* New Loan Application Form */}
          {showApplyLoan && (
            <div className="premium-card p-6 border-2 border-blue-100 bg-blue-50/20">
              <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center">
                <BookOpen className="w-4 h-4 mr-2 text-blue-600" /> Apply for Loan
              </h3>
              <form onSubmit={handleApplyLoan} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Loan Type *</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={loanForm.loan_type}
                      onChange={e => setLoanForm({ ...loanForm, loan_type: e.target.value })}
                    >
                      <option value="personal">Personal Loan</option>
                      <option value="home">Home Loan</option>
                      <option value="vehicle">Vehicle / Auto Loan</option>
                      <option value="education">Education Loan</option>
                      <option value="business">Business Loan</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Requested Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="5000"
                      placeholder="e.g. 200000"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={loanForm.amount}
                      onChange={e => setLoanForm({ ...loanForm, amount: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tenure (Months) *</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={loanForm.duration_months}
                      onChange={e => setLoanForm({ ...loanForm, duration_months: e.target.value })}
                    >
                      <option value="6">6 Months</option>
                      <option value="12">12 Months (1 Year)</option>
                      <option value="24">24 Months (2 Years)</option>
                      <option value="36">36 Months (3 Years)</option>
                      <option value="60">60 Months (5 Years)</option>
                      <option value="120">120 Months (10 Years)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Monthly Income (₹)</label>
                    <input
                      type="number"
                      placeholder="e.g. 75000"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={loanForm.monthly_income}
                      onChange={e => setLoanForm({ ...loanForm, monthly_income: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Employment Status</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={loanForm.employment_status}
                      onChange={e => setLoanForm({ ...loanForm, employment_status: e.target.value })}
                    >
                      <option value="salaried">Salaried</option>
                      <option value="self_employed">Self Employed</option>
                      <option value="business">Business Owner</option>
                      <option value="retired">Retired</option>
                      <option value="student">Student</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Employer / Company Name</label>
                    <input
                      type="text"
                      placeholder="Organization name"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={loanForm.employer_name}
                      onChange={e => setLoanForm({ ...loanForm, employer_name: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Purpose of Loan</label>
                  <input
                    type="text"
                    placeholder="e.g. Home Renovation, Education, Business Expansion"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    value={loanForm.purpose}
                    onChange={e => setLoanForm({ ...loanForm, purpose: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowApplyLoan(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loanSubmitting || !loanForm.amount}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer disabled:opacity-60 transition-colors"
                  >
                    {loanSubmitting ? 'Submitting Application...' : 'Submit Application'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Existing Loans */}
          <div className="premium-card overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-900 flex items-center">
                <BookOpen className="w-4 h-4 mr-2 text-blue-600" /> My Loan Applications ({myLoans.length})
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
                  <div key={loan.id} className="p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="font-semibold text-slate-900 capitalize text-base">{loan.loan_type} Loan</p>
                          <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold">
                            {loan.loan_number || '#' + loan.id.slice(0, 8)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          {loan.duration_months} months · {loan.rate}% p.a. · Applied {new Date(loan.created_at).toLocaleDateString()}
                          {loan.purpose ? ` · Purpose: ${loan.purpose}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-extrabold text-slate-900">₹{parseFloat(loan.amount).toLocaleString('en-IN')}</p>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border inline-block ${
                          loan.status === 'approved' || loan.status === 'disbursed' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                          loan.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                          loan.status === 'cancelled' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {loan.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {loan.manager_remarks && (
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-900">
                        <span className="font-bold">Manager Note:</span> {loan.manager_remarks}
                      </div>
                    )}

                    {['pending', 'under_review'].includes(loan.status) && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => handleCancelLoan(loan.id)}
                          className="text-xs text-red-600 hover:text-red-700 font-semibold cursor-pointer border border-red-200 bg-red-50 px-3 py-1 rounded hover:bg-red-100 transition-colors"
                        >
                          Cancel Application
                        </button>
                      </div>
                    )}

                    {/* EMI Repayment Schedule for Approved Loans */}
                    {loan.repayments && loan.repayments.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100">
                        <p className="text-xs font-bold text-slate-700 mb-2">Upcoming EMI Repayments ({loan.repayments.length} Installments)</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          {loan.repayments.slice(0, 4).map((rep: any, i: number) => (
                            <div key={rep.id || i} className="p-2 bg-slate-50 rounded border border-slate-100">
                              <p className="font-semibold text-slate-900">EMI #{i+1}: ₹{parseFloat(rep.emi_amount).toLocaleString('en-IN')}</p>
                              <p className="text-slate-500">Due: {new Date(rep.due_date).toLocaleDateString()}</p>
                              <span className={`text-[10px] font-bold ${rep.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {rep.status.toUpperCase()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Support Center */}
      {activeSection === 'support' && (
        <div className="space-y-6">
          {ticketStatusMsg && (
            <div className={`p-4 rounded-xl border flex items-center ${ticketStatusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
              {ticketStatusMsg.type === 'success' ? <CheckCircle2 className="w-5 h-5 mr-2" /> : <AlertCircle className="w-5 h-5 mr-2" />}
              {ticketStatusMsg.message}
            </div>
          )}

          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Support Center</h2>
              <p className="text-xs text-slate-500">Raise issues, track support tickets, and chat directly with bank staff.</p>
            </div>
            <button
              onClick={() => setShowNewTicket(!showNewTicket)}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus className="w-4 h-4 mr-1" /> {showNewTicket ? 'Cancel' : 'Raise New Support Ticket'}
            </button>
          </div>

          {/* New Ticket Form */}
          {showNewTicket && (
            <div className="premium-card p-6 border-2 border-blue-100 bg-blue-50/20">
              <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center">
                <MessageSquare className="w-4 h-4 mr-2 text-blue-600" /> Create Support Ticket
              </h3>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Subject *</label>
                  <input
                    type="text"
                    required
                    placeholder="Brief description of your issue"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    value={ticketForm.subject}
                    onChange={e => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Category *</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={ticketForm.category}
                      onChange={e => setTicketForm({ ...ticketForm, category: e.target.value })}
                    >
                      <option value="account">Account Issues</option>
                      <option value="transaction">Transaction Issues</option>
                      <option value="loan">Loan Issues</option>
                      <option value="card">ATM / Debit Card Issues</option>
                      <option value="net_banking">Net Banking Issues</option>
                      <option value="mobile_banking">Mobile Banking Issues</option>
                      <option value="cheque">Cheque Book Issues</option>
                      <option value="kyc">KYC Issues</option>
                      <option value="technical">Technical Issues</option>
                      <option value="complaints">Complaints</option>
                      <option value="suggestions">Suggestions</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Priority</label>
                    <select
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={ticketForm.priority}
                      onChange={e => setTicketForm({ ...ticketForm, priority: e.target.value })}
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Description / Details</label>
                  <textarea
                    rows={4}
                    placeholder="Provide detailed description of the issue or inquiry"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                    value={ticketForm.description}
                    onChange={e => setTicketForm({ ...ticketForm, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewTicket(false)}
                    className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-semibold hover:bg-slate-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={ticketSubmitting || !ticketForm.subject.trim()}
                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 cursor-pointer disabled:opacity-60 transition-colors"
                  >
                    {ticketSubmitting ? 'Registering Ticket...' : 'Register Ticket'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Tickets View Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ticket List */}
            <div className="lg:col-span-1 premium-card overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-sm">My Tickets ({tickets.length})</h3>
                <button onClick={fetchTickets} className="text-xs text-blue-600 hover:underline">Refresh</button>
              </div>
              {ticketLoading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : tickets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No tickets registered</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
                  {tickets.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${selectedTicket?.id === t.id ? 'bg-blue-50/50 border-l-4 border-blue-600' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono font-bold text-blue-700">{t.ticket_number || '#' + t.id.slice(0, 8)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          t.status === 'resolved' || t.status === 'closed' ? 'bg-emerald-50 text-emerald-700' :
                          t.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {t.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="font-semibold text-slate-900 truncate">{t.subject}</p>
                      <p className="text-slate-400 text-[10px] mt-1 capitalize">{t.category} · {new Date(t.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Ticket Thread */}
            <div className="lg:col-span-2 premium-card p-5 flex flex-col justify-between min-h-[500px]">
              {selectedTicket ? (
                <>
                  <div>
                    <div className="pb-4 border-b border-slate-100 flex justify-between items-start">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-blue-700 text-sm">{selectedTicket.ticket_number || '#' + selectedTicket.id.slice(0, 8)}</span>
                          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold capitalize">{selectedTicket.category}</span>
                          <span className={`text-xs px-2 py-0.5 rounded font-bold ${selectedTicket.priority === 'high' || selectedTicket.priority === 'urgent' ? 'text-red-700 bg-red-50' : 'text-slate-600 bg-slate-100'}`}>
                            {selectedTicket.priority.toUpperCase()}
                          </span>
                        </div>
                        <h3 className="font-bold text-slate-900 text-lg mt-1">{selectedTicket.subject}</h3>
                        <p className="text-xs text-slate-400 mt-1">
                          Opened on {new Date(selectedTicket.created_at).toLocaleString()}
                          {selectedTicket.assigned_user ? ` · Assigned to: ${selectedTicket.assigned_user.first_name} ${selectedTicket.assigned_user.last_name}` : ''}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        selectedTicket.status === 'resolved' || selectedTicket.status === 'closed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                        'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {selectedTicket.status.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {selectedTicket.description && (
                      <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 mt-4 border border-slate-100">
                        <span className="font-bold block mb-1 text-slate-900">Original Request:</span>
                        {selectedTicket.description}
                      </div>
                    )}

                    {/* Conversation Replies */}
                    <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
                      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Conversation History</p>
                      {(!selectedTicket.replies || selectedTicket.replies.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">No replies yet. Bank staff will respond shortly.</p>
                      ) : selectedTicket.replies.map((reply: any) => (
                        <div
                          key={reply.id}
                          className={`p-3 rounded-lg text-xs ${reply.user_role === 'customer' ? 'bg-blue-50/70 border border-blue-100 ml-6' : 'bg-slate-100 border border-slate-200 mr-6'}`}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-bold text-slate-900">{reply.user_name || 'User'} <span className="text-[10px] font-normal text-slate-500">({reply.user_role})</span></span>
                            <span className="text-[10px] text-slate-400">{new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-slate-800 whitespace-pre-wrap">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reply Box */}
                  {selectedTicket.status !== 'closed' ? (
                    <form onSubmit={handleSendReply} className="mt-4 pt-4 border-t border-slate-100 flex gap-2">
                      <input
                        type="text"
                        required
                        placeholder="Type your reply..."
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-xs bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                      />
                      <button
                        type="submit"
                        disabled={replySubmitting || !replyText.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center cursor-pointer"
                      >
                        <SendHorizontal className="w-3.5 h-3.5 mr-1" /> {replySubmitting ? '...' : 'Send'}
                      </button>
                    </form>
                  ) : (
                    <div className="mt-4 p-3 bg-slate-100 text-center text-xs text-slate-500 rounded-lg">
                      This ticket is closed.
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
                  <MessageSquare className="w-12 h-12 mb-3 opacity-30 text-blue-500" />
                  <p className="text-sm font-medium">Select a ticket from the list to view conversation history and reply.</p>
                </div>
              )}
            </div>
          </div>
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

      {/* Standing Instructions (Scheduled Payments) */}
      {activeSection === 'standing-instructions' && (
        <div className="space-y-5">
          {spStatus && (
            <div className={`p-3 rounded-lg text-sm font-medium ${spStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {spStatus.message}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" /> Create Standing Instruction
            </h2>
            <form onSubmit={handleCreateScheduledPayment} className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Source Account</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} (₹{parseFloat(a.balance).toLocaleString('en-IN')})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Destination Account Number</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={spToAccount} onChange={e => setSpToAccount(e.target.value)} required placeholder="e.g. 1000293847" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Amount (₹)</label>
                <input type="number" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={spAmount} onChange={e => setSpAmount(e.target.value)} required placeholder="Amount in ₹" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Frequency</label>
                <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={spFrequency} onChange={e => setSpFrequency(e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Next Payment Date</label>
                <input type="date" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={spNextRun} onChange={e => setSpNextRun(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Description</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={spDesc} onChange={e => setSpDesc(e.target.value)} placeholder="Standing instruction remark" />
              </div>
              <div className="col-span-2">
                <button type="submit" disabled={spLoading} className="px-5 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-60">
                  {spLoading ? 'Setting instruction...' : 'Set Standing Instruction'}
                </button>
              </div>
            </form>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-base font-bold text-slate-900">Active Instructions ({scheduledPayments.length})</h2>
            </div>
            {scheduledPayments.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No standing instructions active</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase border-b border-slate-200">
                      <th className="px-5 py-3">Source Account</th>
                      <th className="px-5 py-3">To Account</th>
                      <th className="px-5 py-3">Frequency</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Next Execution</th>
                      <th className="px-5 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {scheduledPayments.map((sp: any) => (
                      <tr key={sp.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-semibold text-slate-700">{sp.account?.account_number}</td>
                        <td className="px-5 py-3 text-slate-600">{sp.to_account_num}</td>
                        <td className="px-5 py-3 text-slate-600 capitalize">{sp.frequency}</td>
                        <td className="px-5 py-3 font-bold text-slate-900">₹{parseFloat(sp.amount).toLocaleString('en-IN')}</td>
                        <td className="px-5 py-3 text-slate-500">{new Date(sp.next_run).toLocaleDateString('en-IN')}</td>
                        <td className="px-5 py-3">
                          <button onClick={() => handleCancelScheduledPayment(sp.id)} className="p-1 px-3 text-xs bg-red-50 text-red-600 border border-red-100 hover:bg-red-100 rounded font-semibold transition-colors">
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Passbook */}
      {activeSection === 'passbook' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Book className="w-5 h-5 text-blue-600" /> Digital Passbook
              </h2>
              <div className="flex items-center gap-4">
                {selectedAccountId && (
                  <a
                    href={accountAPI.getPassbook(selectedAccountId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" /> Download Passbook (PDF)
                  </a>
                )}
                <div className="w-64">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Select Account</label>
                  <select className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.account_number} ({a.account_type})</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs font-bold uppercase tracking-wider">
                    <th className="px-5 py-3 rounded-tl-lg">Date</th>
                    <th className="px-5 py-3">Particulars / Description</th>
                    <th className="px-5 py-3">Debit (₹)</th>
                    <th className="px-5 py-3">Credit (₹)</th>
                    <th className="px-5 py-3 rounded-tr-lg">Running Balance (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(() => {
                    const activeAccount = accounts.find(a => a.id === selectedAccountId);
                    let runningBal = parseFloat(activeAccount?.balance || 0);
                    const list = transactions
                      .filter(t => t.from_account_id === selectedAccountId || t.to_account_id === selectedAccountId)
                      .map((tx) => {
                        const current = runningBal;
                        const isCredit = tx.to_account_id === selectedAccountId;
                        if (isCredit) {
                          runningBal -= parseFloat(tx.amount);
                        } else {
                          runningBal += parseFloat(tx.amount);
                        }
                        return { ...tx, currentRunning: current };
                      });

                    if (list.length === 0) {
                      return <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-400">No transactions recorded in passbook.</td></tr>;
                    }

                    return list.map((tx: any) => {
                      const isCredit = tx.to_account_id === selectedAccountId;
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50 font-medium">
                          <td className="px-5 py-4 text-xs text-slate-500">{new Date(tx.created_at).toLocaleDateString('en-IN')}</td>
                          <td className="px-5 py-4 text-slate-700">{tx.description || tx.transaction_type}</td>
                          <td className="px-5 py-4 text-red-600 font-bold">{!isCredit ? `₹${parseFloat(tx.amount).toLocaleString('en-IN')}` : '—'}</td>
                          <td className="px-5 py-4 text-emerald-600 font-bold">{isCredit ? `₹${parseFloat(tx.amount).toLocaleString('en-IN')}` : '—'}</td>
                          <td className="px-5 py-4 font-bold text-slate-900">₹{tx.currentRunning.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Profile & Settings */}
      {activeSection === 'settings' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Profile Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings className="w-5 h-5 text-blue-600" /> Contact Details
            </h2>
            {settingsStatus && (
              <div className={`p-3 rounded-lg text-sm ${settingsStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {settingsStatus.message}
              </div>
            )}
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
                <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={prefPhone} onChange={e => setPrefPhone(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Residential Address</label>
                <textarea rows={3} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={prefAddress} onChange={e => setPrefAddress(e.target.value)} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">City</label>
                  <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={prefCity} onChange={e => setPrefCity(e.target.value)} required />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Pincode</label>
                  <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={prefPincode} onChange={e => setPrefPincode(e.target.value)} required />
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm">
                Save Contact Details
              </button>
            </form>
          </div>

          {/* Change Password Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Settings className="w-5 h-5 text-blue-600" /> Security Credentials
            </h2>
            {passwordStatus && (
              <div className={`p-3 rounded-lg text-sm ${passwordStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                {passwordStatus.message}
              </div>
            )}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Current Password</label>
                <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Password</label>
                <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={newPassword} onChange={e => setNewPassword(e.target.value)} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Confirm New Password</label>
                <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
              </div>
              <button type="submit" className="w-full py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 text-sm">
                Change Password
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

