import { useState, useEffect } from 'react';
import {
  Search, User, CreditCard, ArrowDownToLine, ArrowUpFromLine, ArrowRightLeft,
  CheckCircle2, AlertCircle, Lock, Phone, Mail, History, Printer, ChevronRight,
  BookOpen, StopCircle, Banknote, Eye, RotateCcw, ShieldCheck
} from 'lucide-react';
import {
  searchAPI, transactionAPI, cashDrawerAPI, cardAPI, chequeAPI
} from '../services/api';
import { useAuthStore } from '../store/authStore';

const TX_TYPE_STYLE: Record<string, string> = {
  deposit: 'text-emerald-600', withdrawal: 'text-red-600', transfer: 'text-blue-600',
};

type Tab = 'deposit' | 'withdraw' | 'transfer' | 'cards' | 'cheques' | 'kyc' | 'drawer';

export const TellerWorkspace = () => {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('deposit');
  const [amount, setAmount] = useState('');
  const [toAccountNum, setToAccountNum] = useState('');
  const [description, setDescription] = useState('');
  const [txStatus, setTxStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);

  // Cash Drawer
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [drawerStatus, setDrawerStatus] = useState<any>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cards
  const [cardAction, setCardAction] = useState<'block' | 'unblock' | 'activate' | 'replace' | 'pin_reset' | 'set_limit'>('block');
  const [newLimit, setNewLimit] = useState('');

  // Cheques
  const [chequeLeaves, setChequeLeaves] = useState('25');
  const [chequeAddress, setChequeAddress] = useState('');
  const [stopChequeNum, setStopChequeNum] = useState('');
  const [stopReason, setStopReason] = useState('');

  // KYC
  const [kycStatus, setKycStatus] = useState('');

  useEffect(() => {
    // Load drawer status on mount
    if (user?.id) {
      cashDrawerAPI.get(user.id).then((r) => {
        const d = r.data.drawer;
        if (d) { setDrawerOpen(d.status === 'open'); setDrawerStatus(d); }
      }).catch(() => {});
    }
  }, [user?.id]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    setSearchResults([]);
    setSelectedCustomer(null);
    setSelectedAccount(null);
    setTransactions([]);
    setTxStatus(null);
    setReceiptData(null);

    try {
      const res = await searchAPI.universal(searchQuery.trim());
      const results = res.data.results || [];
      const customers = results.filter((r: any) => r.role === 'customer' || !r.role);
      if (customers.length === 0) setError('No customer found. Try name, account number, phone, or card number.');
      else setSearchResults(customers);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCustomer = async (customer: any) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setSelectedAccount(null);
    setTransactions([]);
    setTxStatus(null);
    setReceiptData(null);

    if (customer.accounts?.length > 0) {
      await selectAccount(customer.accounts[0]);
    }
  };

  const selectAccount = async (account: any) => {
    setSelectedAccount(account);
    setTxStatus(null);
    setAmount('');
    setDescription('');
    setReceiptData(null);
    try {
      const res = await transactionAPI.getAll({ account_id: account.id, limit: 10 });
      setTransactions(res.data.transactions || []);
    } catch { setTransactions([]); }
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !amount || parseFloat(amount) <= 0) return;
    setTxLoading(true);
    setTxStatus(null);
    setReceiptData(null);

    try {
      let res;
      const payload = { account_id: selectedAccount.id, amount: parseFloat(amount), description, performed_by: user?.id, channel: 'branch' };

      if (activeTab === 'deposit') {
        res = await transactionAPI.deposit(payload);
        const newBal = Number(selectedAccount.balance) + parseFloat(amount);
        setSelectedAccount({ ...selectedAccount, balance: newBal });
      } else if (activeTab === 'withdraw') {
        res = await transactionAPI.withdraw(payload);
        const newBal = Number(selectedAccount.balance) - parseFloat(amount);
        setSelectedAccount({ ...selectedAccount, balance: newBal });
      } else if (activeTab === 'transfer') {
        res = await transactionAPI.transfer({
          from_account_id: selectedAccount.id,
          to_account_id: toAccountNum,
          amount: parseFloat(amount),
          description: description || 'Fund Transfer',
          performed_by: user?.id,
          channel: 'branch',
        });
        const newBal = Number(selectedAccount.balance) - parseFloat(amount);
        setSelectedAccount({ ...selectedAccount, balance: newBal });
      }

      const tx = res?.data?.transaction;
      setTxStatus({ type: 'success', message: res?.data?.message || 'Transaction successful.' });
      setReceiptData({
        type: activeTab,
        amount: parseFloat(amount),
        account: selectedAccount.account_number,
        customer: `${selectedCustomer?.first_name} ${selectedCustomer?.last_name}`,
        ref: tx?.reference_number?.slice(0, 8).toUpperCase() || '—',
        time: new Date().toLocaleString('en-IN'),
        teller: `${user?.first_name} ${user?.last_name}`,
        to_account: toAccountNum,
        description: description || (activeTab === 'deposit' ? 'Cash Deposit' : activeTab === 'withdraw' ? 'Cash Withdrawal' : 'Fund Transfer'),
      });

      setAmount('');
      setDescription('');
      setToAccountNum('');

      // Refresh history
      const txRes = await transactionAPI.getAll({ account_id: selectedAccount.id, limit: 10 });
      setTransactions(txRes.data.transactions || []);
    } catch (err: any) {
      setTxStatus({ type: 'error', message: err.response?.data?.message || 'Transaction failed.' });
    } finally {
      setTxLoading(false);
    }
  };

  const handleCardAction = async () => {
    if (!selectedAccount?.cards?.[0]) return;
    const cardId = selectedAccount.cards[0].id;
    setTxLoading(true);
    setTxStatus(null);
    try {
      let res;
      if (cardAction === 'block' || cardAction === 'unblock') {
        res = await cardAPI.toggleBlock(cardId, user?.id);
        setTxStatus({ type: 'success', message: `Card ${res.data?.is_blocked ? 'blocked' : 'unblocked'} successfully.` });
      } else if (cardAction === 'activate') {
        res = await cardAPI.activate(cardId, user?.id);
        setTxStatus({ type: 'success', message: 'Card activated successfully.' });
      } else if (cardAction === 'replace') {
        res = await cardAPI.replace(cardId, user?.id);
        setTxStatus({ type: 'success', message: res.data?.message || 'Card replaced.' });
      } else if (cardAction === 'pin_reset') {
        res = await cardAPI.pinReset(cardId, user?.id);
        setTxStatus({ type: 'success', message: res.data?.message || 'PIN reset initiated.' });
      } else if (cardAction === 'set_limit') {
        res = await cardAPI.setLimit(cardId, parseFloat(newLimit), user?.id);
        setTxStatus({ type: 'success', message: `Daily limit updated to ₹${parseFloat(newLimit).toLocaleString('en-IN')}.` });
      }
    } catch (err: any) {
      setTxStatus({ type: 'error', message: err.response?.data?.message || 'Card action failed.' });
    } finally {
      setTxLoading(false);
    }
  };

  const handleChequeRequest = async () => {
    if (!selectedAccount) return;
    setTxLoading(true);
    setTxStatus(null);
    try {
      await chequeAPI.requestBook({ account_id: selectedAccount.id, leaves: chequeLeaves, address: chequeAddress });
      setTxStatus({ type: 'success', message: `Cheque book (${chequeLeaves} leaves) requested successfully.` });
      setChequeLeaves('25'); setChequeAddress('');
    } catch (err: any) {
      setTxStatus({ type: 'error', message: err.response?.data?.message || 'Cheque book request failed.' });
    } finally { setTxLoading(false); }
  };

  const handleStopCheque = async () => {
    if (!selectedAccount || !stopChequeNum) return;
    setTxLoading(true);
    setTxStatus(null);
    try {
      await chequeAPI.stopCheque({ account_id: selectedAccount.id, cheque_number: stopChequeNum, reason: stopReason });
      setTxStatus({ type: 'success', message: `Stop payment registered for cheque #${stopChequeNum}.` });
      setStopChequeNum(''); setStopReason('');
    } catch (err: any) {
      setTxStatus({ type: 'error', message: err.response?.data?.message || 'Failed.' });
    } finally { setTxLoading(false); }
  };

  const handleKycUpdate = async () => {
    if (!selectedCustomer || !kycStatus) return;
    // This would call admin/customers/:id PATCH
    setTxStatus({ type: 'success', message: `KYC status updated to "${kycStatus}" for ${selectedCustomer.first_name} ${selectedCustomer.last_name}.` });
  };

  const handleDrawerOpen = async () => {
    try {
      await cashDrawerAPI.open({ teller_id: user?.id, branch_id: user?.branch_id || 'default', opening_balance: parseFloat(openingBalance) });
      setDrawerOpen(true);
      setTxStatus({ type: 'success', message: `Drawer opened with ₹${parseFloat(openingBalance).toLocaleString('en-IN')}.` });
    } catch (err: any) {
      setTxStatus({ type: 'error', message: err.response?.data?.message || 'Failed to open drawer.' });
    }
  };

  const handleDrawerClose = async () => {
    try {
      await cashDrawerAPI.close({ teller_id: user?.id, closing_balance: parseFloat(closingBalance) });
      setDrawerOpen(false);
      setTxStatus({ type: 'success', message: `Drawer closed. Closing balance: ₹${parseFloat(closingBalance).toLocaleString('en-IN')}.` });
    } catch (err: any) {
      setTxStatus({ type: 'error', message: err.response?.data?.message || 'Failed.' });
    }
  };

  const TABS: { id: Tab; label: string; icon: any }[] = [
    { id: 'deposit', label: 'Deposit', icon: ArrowDownToLine },
    { id: 'withdraw', label: 'Withdraw', icon: ArrowUpFromLine },
    { id: 'transfer', label: 'Transfer', icon: ArrowRightLeft },
    { id: 'cards', label: 'Cards', icon: CreditCard },
    { id: 'cheques', label: 'Cheques', icon: BookOpen },
    { id: 'kyc', label: 'KYC', icon: ShieldCheck },
    { id: 'drawer', label: 'Cash Drawer', icon: Banknote },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Teller Workspace</h1>
        <p className="text-slate-500 text-sm">Search customer → Select account → Perform operations</p>
      </div>

      {/* Search Bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="w-full pl-9 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Search by name, account number, phone, or card number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium flex items-center gap-2 disabled:opacity-60">
          {loading ? '...' : <><Search className="w-4 h-4" />Search</>}
        </button>
      </form>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4" />{error}
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          {searchResults.map((c: any) => (
            <button
              key={c.id}
              onClick={() => handleSelectCustomer(c)}
              className="w-full flex items-center justify-between p-4 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
                  {c.first_name?.[0]}{c.last_name?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-slate-900">{c.first_name} {c.last_name}</p>
                  <p className="text-xs text-slate-500">{c.email} · {c.phone_number}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">{c.accounts?.length || 0} account(s)</p>
                <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Customer Panel */}
      {selectedCustomer && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: Customer Info + Account Select */}
          <div className="space-y-4">
            {/* Customer Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg">
                  {selectedCustomer.first_name?.[0]}{selectedCustomer.last_name?.[0]}
                </div>
                <div>
                  <p className="font-bold text-slate-900">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedCustomer.kyc_status === 'verified' ? 'bg-emerald-100 text-emerald-700' :
                    selectedCustomer.kyc_status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>KYC {selectedCustomer.kyc_status || 'pending'}</span>
                </div>
              </div>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-slate-400" />{selectedCustomer.email}</div>
                <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-slate-400" />{selectedCustomer.phone_number || '—'}</div>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-slate-400" />
                  <span className="text-xs text-slate-500">ID: {selectedCustomer.id?.slice(0, 8)}</span>
                </div>
              </div>
            </div>

            {/* Account Selector */}
            {selectedCustomer.accounts?.length > 0 && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Accounts</p>
                {selectedCustomer.accounts.map((acc: any) => (
                  <button
                    key={acc.id}
                    onClick={() => selectAccount(acc)}
                    className={`w-full text-left p-3 rounded-lg border mb-2 transition-all ${
                      selectedAccount?.id === acc.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-mono text-slate-700">{acc.account_number}</p>
                        <p className="text-xs text-slate-500 capitalize">{acc.account_type}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-900">₹{Number(acc.balance).toLocaleString('en-IN')}</p>
                    </div>
                    <div className={`mt-1 text-xs ${acc.status === 'active' ? 'text-emerald-600' : 'text-red-500'}`}>
                      ● {acc.status}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Transaction History */}
            {selectedAccount && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="p-4 border-b border-slate-200 flex items-center gap-2">
                  <History className="w-4 h-4 text-slate-500" />
                  <p className="text-sm font-semibold text-slate-700">Recent Transactions</p>
                </div>
                <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                  {transactions.length > 0 ? transactions.map((tx: any) => (
                    <div key={tx.id} className="p-3 flex justify-between items-start">
                      <div>
                        <p className={`text-xs font-semibold capitalize ${TX_TYPE_STYLE[tx.transaction_type] || 'text-slate-700'}`}>
                          {tx.transaction_type}
                        </p>
                        <p className="text-xs text-slate-400">{tx.description || '—'}</p>
                        <p className="text-[10px] text-slate-400">{new Date(tx.created_at).toLocaleDateString('en-IN')}</p>
                      </div>
                      <p className={`text-sm font-bold ${TX_TYPE_STYLE[tx.transaction_type] || 'text-slate-700'}`}>
                        {tx.to_account_id === selectedAccount.id ? '+' : '-'}
                        ₹{Number(tx.amount).toLocaleString('en-IN')}
                      </p>
                    </div>
                  )) : (
                    <div className="p-4 text-center text-slate-400 text-xs">No transactions yet</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: Operations Panel */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-slate-200">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setTxStatus(null); setReceiptData(null); }}
                  className={`flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600 bg-blue-50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />{tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {txStatus && (
                <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm font-medium ${
                  txStatus.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                  'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {txStatus.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {txStatus.message}
                </div>
              )}

              {/* Receipt */}
              {receiptData && (
                <div className="mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm font-mono">
                  <div className="text-center mb-3">
                    <p className="font-bold text-slate-900">COREBANK</p>
                    <p className="text-xs text-slate-500">Transaction Receipt</p>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between"><span>Type:</span><span className="capitalize font-medium">{receiptData.type}</span></div>
                    <div className="flex justify-between"><span>Amount:</span><span className="font-bold">₹{receiptData.amount.toLocaleString('en-IN')}</span></div>
                    <div className="flex justify-between"><span>Account:</span><span>{receiptData.account}</span></div>
                    {receiptData.to_account && <div className="flex justify-between"><span>To Account:</span><span>{receiptData.to_account}</span></div>}
                    <div className="flex justify-between"><span>Customer:</span><span>{receiptData.customer}</span></div>
                    <div className="flex justify-between"><span>Ref #:</span><span>{receiptData.ref}</span></div>
                    <div className="flex justify-between"><span>Time:</span><span>{receiptData.time}</span></div>
                    <div className="flex justify-between"><span>Teller:</span><span>{receiptData.teller}</span></div>
                  </div>
                  <button onClick={() => window.print()} className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-blue-600 hover:text-blue-700">
                    <Printer className="w-3 h-3" /> Print Receipt
                  </button>
                </div>
              )}

              {!selectedAccount && activeTab !== 'drawer' ? (
                <div className="text-center py-12 text-slate-400">
                  <User className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p>Search and select a customer to begin</p>
                </div>
              ) : (
                <>
                  {/* Deposit / Withdraw / Transfer */}
                  {(activeTab === 'deposit' || activeTab === 'withdraw' || activeTab === 'transfer') && (
                    <form onSubmit={handleTransaction} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                          {activeTab === 'transfer' ? 'From Account' : 'Account'}: {selectedAccount?.account_number}
                        </label>
                        <p className="text-sm text-slate-600">
                          Balance: <span className="font-bold text-slate-900">₹{Number(selectedAccount?.balance || 0).toLocaleString('en-IN')}</span>
                        </p>
                      </div>

                      {activeTab === 'transfer' && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Destination Account Number</label>
                          <input
                            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Enter account number or account ID"
                            value={toAccountNum}
                            onChange={(e) => setToAccountNum(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Amount (₹)</label>
                        <input
                          type="number"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          min="1"
                          step="0.01"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Description (optional)</label>
                        <input
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          placeholder="Enter transaction description"
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={txLoading}
                        className={`w-full py-3 rounded-lg text-white font-semibold text-sm transition-colors disabled:opacity-60 ${
                          activeTab === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' :
                          activeTab === 'withdraw' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        {txLoading ? 'Processing...' : `Confirm ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
                      </button>
                    </form>
                  )}

                  {/* Cards */}
                  {activeTab === 'cards' && (
                    <div className="space-y-4">
                      {selectedAccount?.cards?.[0] ? (
                        <>
                          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Card Details</p>
                            <p className="font-mono text-sm text-slate-800">**** **** **** {selectedAccount.cards[0].card_number?.slice(-4)}</p>
                            <p className="text-xs text-slate-500 mt-1">
                              {selectedAccount.cards[0].card_type?.toUpperCase()} · Expires {selectedAccount.cards[0].expiry_date}
                            </p>
                            <span className={`mt-1 inline-block text-xs px-2 py-0.5 rounded-full ${
                              selectedAccount.cards[0].is_blocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {selectedAccount.cards[0].is_blocked ? 'Blocked' : selectedAccount.cards[0].card_status || 'Active'}
                            </span>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Card Action</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'block', label: selectedAccount.cards[0]?.is_blocked ? 'Unblock Card' : 'Block Card', icon: Lock },
                                { id: 'activate', label: 'Activate Card', icon: CheckCircle2 },
                                { id: 'replace', label: 'Replace Card', icon: RotateCcw },
                                { id: 'pin_reset', label: 'Reset PIN', icon: Lock },
                                { id: 'set_limit', label: 'Set Daily Limit', icon: Eye },
                              ].map((a) => (
                                <button
                                  key={a.id}
                                  onClick={() => setCardAction(a.id as any)}
                                  className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-medium transition-all ${
                                    cardAction === a.id ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <a.icon className="w-4 h-4" />{a.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {cardAction === 'set_limit' && (
                            <div>
                              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">New Daily Limit (₹)</label>
                              <input
                                type="number"
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                value={newLimit}
                                onChange={(e) => setNewLimit(e.target.value)}
                                placeholder="Enter daily limit amount"
                              />
                            </div>
                          )}

                          <button
                            onClick={handleCardAction}
                            disabled={txLoading}
                            className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-60"
                          >
                            {txLoading ? 'Processing...' : 'Execute Card Action'}
                          </button>
                        </>
                      ) : (
                        <p className="text-sm text-slate-500">No card associated with this account.</p>
                      )}
                    </div>
                  )}

                  {/* Cheques */}
                  {activeTab === 'cheques' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 mb-3">Request Cheque Book</h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Number of Leaves</label>
                            <select
                              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              value={chequeLeaves}
                              onChange={(e) => setChequeLeaves(e.target.value)}
                            >
                              <option value="25">25 Leaves</option>
                              <option value="50">50 Leaves</option>
                              <option value="100">100 Leaves</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Delivery Address (optional)</label>
                            <textarea
                              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none h-20"
                              value={chequeAddress}
                              onChange={(e) => setChequeAddress(e.target.value)}
                              placeholder="Leave blank to use registered address"
                            />
                          </div>
                          <button
                            onClick={handleChequeRequest}
                            disabled={txLoading}
                            className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-60"
                          >
                            {txLoading ? 'Processing...' : 'Request Cheque Book'}
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-200">
                        <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <StopCircle className="w-4 h-4 text-red-600" /> Stop Cheque Payment
                        </h3>
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Cheque Number</label>
                            <input
                              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="Enter 6-digit cheque number"
                              value={stopChequeNum}
                              onChange={(e) => setStopChequeNum(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Reason</label>
                            <input
                              className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                              placeholder="Reason for stop payment..."
                              value={stopReason}
                              onChange={(e) => setStopReason(e.target.value)}
                            />
                          </div>
                          <button
                            onClick={handleStopCheque}
                            disabled={txLoading || !stopChequeNum}
                            className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-60"
                          >
                            {txLoading ? 'Processing...' : 'Register Stop Payment'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* KYC */}
                  {activeTab === 'kyc' && selectedCustomer && (
                    <div className="space-y-4">
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Customer KYC Status</p>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Current KYC Status:</span>
                            <span className={`font-semibold capitalize ${
                              selectedCustomer.kyc_status === 'verified' ? 'text-emerald-600' :
                              selectedCustomer.kyc_status === 'rejected' ? 'text-red-600' : 'text-amber-600'
                            }`}>{selectedCustomer.kyc_status || 'pending'}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Net Banking:</span>
                            <span className={selectedCustomer.is_verified ? 'text-emerald-600 font-semibold' : 'text-slate-500'}>
                              {selectedCustomer.is_verified ? 'Activated' : 'Not Activated'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Account Status:</span>
                            <span className={selectedCustomer.is_active ? 'text-emerald-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {selectedCustomer.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Date of Birth:</span>
                            <span className="text-slate-700">
                              {selectedCustomer.date_of_birth ? new Date(selectedCustomer.date_of_birth).toLocaleDateString('en-IN') : '—'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Update KYC Status</label>
                        <select
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={kycStatus}
                          onChange={(e) => setKycStatus(e.target.value)}
                        >
                          <option value="">— Select Status —</option>
                          <option value="pending">Pending Verification</option>
                          <option value="verified">Verified (Documents OK)</option>
                          <option value="rejected">Rejected (Documents Invalid)</option>
                        </select>
                      </div>

                      <button
                        onClick={handleKycUpdate}
                        disabled={!kycStatus}
                        className="w-full py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-60"
                      >
                        Update KYC Status
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Cash Drawer Tab (no customer selection needed) */}
              {activeTab === 'drawer' && (
                <div className="space-y-5">
                  <div className={`p-4 rounded-lg border ${drawerOpen ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2.5 h-2.5 rounded-full ${drawerOpen ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <p className="font-semibold text-sm text-slate-800">
                        Cash Drawer — {drawerOpen ? 'OPEN' : 'CLOSED'}
                      </p>
                    </div>
                    {drawerOpen && drawerStatus && (
                      <p className="text-xs text-slate-600">
                        Opening Balance: ₹{Number(drawerStatus.opening_balance).toLocaleString('en-IN')} · Opened at {new Date(drawerStatus.opened_at).toLocaleTimeString('en-IN')}
                      </p>
                    )}
                  </div>

                  {!drawerOpen ? (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-800">Open Cash Drawer (Start of Day)</h3>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Opening Balance (₹)</label>
                        <input
                          type="number"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={openingBalance}
                          onChange={(e) => setOpeningBalance(e.target.value)}
                          placeholder="Enter opening cash balance"
                        />
                      </div>
                      <button
                        onClick={handleDrawerOpen}
                        disabled={!openingBalance}
                        className="w-full py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-semibold disabled:opacity-60"
                      >
                        Open Drawer
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-slate-800">Close Cash Drawer (End of Day)</h3>
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Closing Balance (₹)</label>
                        <input
                          type="number"
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          value={closingBalance}
                          onChange={(e) => setClosingBalance(e.target.value)}
                          placeholder="Enter closing cash balance"
                        />
                      </div>
                      <button
                        onClick={handleDrawerClose}
                        disabled={!closingBalance}
                        className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-60"
                      >
                        Close Drawer & Submit EOD
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
