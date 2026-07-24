import { useState, useEffect } from 'react';
import { HelpCircle, MessageSquare, Loader2, CheckCircle2, AlertCircle, SendHorizontal, ArrowUpRight, UserCheck } from 'lucide-react';
import { ticketAPI, adminAPI, employeeAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

export const SupportTickets = () => {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Selected Ticket & Reply Thread
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);

  // New Ticket Form State
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('account');
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTickets();
    if (user?.role !== 'customer') {
      adminAPI.getCustomers().then(res => {
        const custs = res.data.customers || [];
        setCustomers(custs);
        if (custs.length > 0) setTargetUserId(custs[0].id);
      }).catch(() => {});

      employeeAPI.getAll().then(res => {
        setEmployees(Array.isArray(res.data) ? res.data : []);
      }).catch(() => {});
    }
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const params: any = {};
      if (user?.role === 'customer') params.user_id = user.id;
      if (filterCategory !== 'all') params.category = filterCategory;
      if (filterStatus !== 'all') params.status = filterStatus;

      const res = await ticketAPI.getAll(params);
      const tks = Array.isArray(res.data) ? res.data : [];
      setTickets(tks);
      if (selectedTicket) {
        const updated = tks.find(t => t.id === selectedTicket.id);
        if (updated) setSelectedTicket(updated);
      }
    } catch {
      setError('Failed to fetch support tickets from database.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filterCategory, filterStatus]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      await ticketAPI.updateStatus(id, { status: newStatus, updated_by: user?.id });
      fetchTickets();
    } catch {
      alert('Failed to update ticket status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssign = async (id: string, staffId: string) => {
    if (!staffId) return;
    setActionLoading(id);
    try {
      await ticketAPI.assign(id, { assigned_to: staffId, assigned_by: user?.id });
      fetchTickets();
    } catch {
      alert('Failed to assign ticket.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleEscalate = async (id: string) => {
    const reason = prompt('Reason for escalating to Branch Manager:');
    if (reason === null) return;
    setActionLoading(id);
    try {
      await ticketAPI.escalate(id, { escalated_by: user?.id, reason });
      fetchTickets();
      alert('Ticket escalated to Branch Manager.');
    } catch {
      alert('Failed to escalate ticket.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim() || !user) return;
    setReplyLoading(true);
    try {
      await ticketAPI.reply(selectedTicket.id, {
        user_id: user.id,
        message: replyText,
        user_name: `${user.first_name} ${user.last_name}`,
        user_role: user.role,
      });
      setReplyText('');
      fetchTickets();
    } catch {
      alert('Failed to post reply.');
    } finally {
      setReplyLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalUserId = user?.role === 'customer' ? user.id : targetUserId;
    if (!finalUserId || !subject.trim()) return;
    setCreateMsg(null);
    try {
      await ticketAPI.create({
        user_id: finalUserId,
        subject,
        description,
        priority,
        category,
      });
      setCreateMsg({ type: 'success', text: 'Support ticket submitted successfully!' });
      setSubject('');
      setDescription('');
      fetchTickets();
    } catch {
      setCreateMsg({ type: 'error', text: 'Failed to create support ticket.' });
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center text-slate-900">
            <HelpCircle className="w-6 h-6 mr-2 text-blue-600" />
            Support Center Desk
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track and resolve customer support tickets across all banking operations.</p>
        </div>
        <button onClick={fetchTickets} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 cursor-pointer">
          Refresh Tickets
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex gap-3 flex-wrap bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
        <div>
          <span className="font-bold text-slate-600 mr-2 uppercase">Category:</span>
          <select
            className="border border-slate-200 rounded px-2 py-1 bg-white text-slate-900 outline-none"
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="account">Account Issues</option>
            <option value="transaction">Transaction Issues</option>
            <option value="loan">Loan Issues</option>
            <option value="card">ATM / Card Issues</option>
            <option value="net_banking">Net Banking</option>
            <option value="mobile_banking">Mobile Banking</option>
            <option value="cheque">Cheque Book</option>
            <option value="kyc">KYC</option>
            <option value="technical">Technical</option>
            <option value="complaints">Complaints</option>
            <option value="suggestions">Suggestions</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <span className="font-bold text-slate-600 mr-2 uppercase">Status:</span>
          <select
            className="border border-slate-200 rounded px-2 py-1 bg-white text-slate-900 outline-none"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="waiting_for_customer">Waiting for Customer</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-100 flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" /> {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List & Thread */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* List */}
            <div className="md:col-span-1 premium-card overflow-hidden">
              <div className="p-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <span className="font-bold text-xs text-slate-900">Tickets ({tickets.length})</span>
              </div>
              {loading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : tickets.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">No tickets match filters</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[550px] overflow-y-auto">
                  {tickets.map(t => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTicket(t)}
                      className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors ${selectedTicket?.id === t.id ? 'bg-blue-50/60 border-l-4 border-blue-600' : ''}`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-mono font-bold text-blue-700">{t.ticket_number || '#' + t.id.slice(0, 8)}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          t.status === 'resolved' || t.status === 'closed' ? 'bg-emerald-50 text-emerald-700' :
                          t.status === 'in_progress' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'
                        }`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="font-bold text-slate-900 truncate">{t.subject}</p>
                      <p className="text-slate-500 text-[10px] truncate">{t.user?.first_name} {t.user?.last_name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Conversation Details */}
            <div className="md:col-span-2 premium-card p-4 flex flex-col justify-between min-h-[550px]">
              {selectedTicket ? (
                <>
                  <div>
                    <div className="pb-3 border-b border-slate-100">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-blue-700">{selectedTicket.ticket_number || '#' + selectedTicket.id.slice(0, 8)}</span>
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold capitalize">{selectedTicket.category}</span>
                            <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold uppercase">{selectedTicket.priority}</span>
                          </div>
                          <h3 className="font-bold text-slate-900 text-base mt-1">{selectedTicket.subject}</h3>
                          <p className="text-xs text-slate-500">
                            Customer: <span className="font-semibold text-slate-800">{selectedTicket.user?.first_name} {selectedTicket.user?.last_name}</span> ({selectedTicket.user?.email})
                          </p>
                        </div>

                        {/* Status Change Control */}
                        <div className="flex flex-col items-end gap-1">
                          <select
                            disabled={actionLoading === selectedTicket.id}
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white font-bold text-slate-800 outline-none disabled:opacity-60"
                            value={selectedTicket.status}
                            onChange={e => handleStatusChange(selectedTicket.id, e.target.value)}
                          >
                            <option value="open">Open</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="waiting_for_customer">Waiting for Customer</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                          </select>

                          {user?.role === 'teller' && (
                            <button
                              onClick={() => handleEscalate(selectedTicket.id)}
                              className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded flex items-center cursor-pointer"
                            >
                              <ArrowUpRight className="w-3 h-3 mr-0.5" /> Escalate to Manager
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Reassign dropdown for Manager */}
                      {user?.role === 'branch_manager' && employees.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium flex items-center">
                            <UserCheck className="w-3.5 h-3.5 mr-1 text-blue-600" /> Assign To Staff:
                          </span>
                          <select
                            className="border border-slate-200 rounded px-2 py-1 text-xs bg-white font-medium outline-none"
                            value={selectedTicket.assigned_to || ''}
                            onChange={e => handleAssign(selectedTicket.id, e.target.value)}
                          >
                            <option value="">Unassigned</option>
                            {employees.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.first_name} {emp.last_name} ({emp.role})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {selectedTicket.description && (
                      <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 mt-3 border border-slate-100">
                        <span className="font-bold block mb-1 text-slate-900">Customer Description:</span>
                        {selectedTicket.description}
                      </div>
                    )}

                    {/* Replies */}
                    <div className="mt-3 space-y-2 max-h-64 overflow-y-auto pr-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Conversation Log</p>
                      {(!selectedTicket.replies || selectedTicket.replies.length === 0) ? (
                        <p className="text-xs text-slate-400 italic">No replies yet.</p>
                      ) : selectedTicket.replies.map((reply: any) => (
                        <div
                          key={reply.id}
                          className={`p-2.5 rounded-lg text-xs ${reply.user_role === 'customer' ? 'bg-blue-50/70 border border-blue-100 mr-4' : 'bg-slate-100 border border-slate-200 ml-4'}`}
                        >
                          <div className="flex justify-between items-center mb-0.5">
                            <span className="font-bold text-slate-900">{reply.user_name || 'Staff'} <span className="text-[10px] font-normal text-slate-500">({reply.user_role})</span></span>
                            <span className="text-[10px] text-slate-400">{new Date(reply.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-slate-800 whitespace-pre-wrap">{reply.message}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Staff Reply Form */}
                  <form onSubmit={handleSendReply} className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Type official response to customer..."
                      className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-xs bg-white text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      value={replyText}
                      onChange={e => setReplyText(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={replyLoading || !replyText.trim()}
                      className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center cursor-pointer"
                    >
                      <SendHorizontal className="w-3.5 h-3.5 mr-1" /> {replyLoading ? '...' : 'Reply'}
                    </button>
                  </form>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 py-16">
                  <MessageSquare className="w-10 h-10 mb-2 opacity-30 text-blue-500" />
                  <p className="text-xs font-medium">Select a ticket to manage responses, assignment, and status.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Ticket Panel */}
        <div className="space-y-6">
          <div className="premium-card p-5">
            <h2 className="text-base font-bold mb-4 text-slate-900 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
              {user?.role === 'customer' ? 'Create Support Ticket' : 'File Ticket for Customer'}
            </h2>
            {createMsg && (
              <div className={`mb-3 text-xs p-2.5 rounded border font-medium flex items-center ${
                createMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-700 border-red-100'
              }`}>
                {createMsg.type === 'success' ? <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> : <AlertCircle className="w-3.5 h-3.5 mr-1" />}
                {createMsg.text}
              </div>
            )}
            <form onSubmit={handleCreateTicket} className="space-y-4">
              {user?.role !== 'customer' && (
                <div>
                  <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1">Select Customer *</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none"
                    value={targetUserId}
                    onChange={e => setTargetUserId(e.target.value)}
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.first_name} {c.last_name} ({c.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  placeholder="Summarize issue"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 h-24"
                  placeholder="Detail request"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1">Priority</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1">Category</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-slate-900 outline-none"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                  >
                    <option value="account">Account</option>
                    <option value="transaction">Transaction</option>
                    <option value="loan">Loan</option>
                    <option value="card">Card</option>
                    <option value="net_banking">Net Banking</option>
                    <option value="mobile_banking">Mobile Banking</option>
                    <option value="cheque">Cheque</option>
                    <option value="kyc">KYC</option>
                    <option value="technical">Technical</option>
                    <option value="complaints">Complaints</option>
                    <option value="suggestions">Suggestions</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                disabled={!subject.trim()}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60 transition-colors cursor-pointer"
              >
                Submit Ticket
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
