import { useState, useEffect } from 'react';
import { HelpCircle, MessageSquare, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ticketAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

export const SupportTickets = () => {
  const { user } = useAuthStore();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // New Ticket Form State (only for customer persona, if needed. For support staff they manage it)
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('general');
  const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await ticketAPI.getAll(user?.role === 'customer' ? { user_id: user.id } : undefined);
      setTickets(Array.isArray(res.data) ? res.data : []);
    } catch {
      setError('Failed to fetch support tickets from database.');
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (id: string) => {
    setActionLoading(id);
    try {
      await ticketAPI.resolve(id, { status: 'resolved', assigned_to: user?.id });
      setTickets(prev => prev.map(t => t.id === id ? { ...t, status: 'resolved', resolved_at: new Date().toISOString() } : t));
    } catch {
      alert('Failed to resolve support ticket.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !subject.trim()) return;
    setCreateMsg(null);
    try {
      await ticketAPI.create({
        user_id: user.id,
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
            Customer Support Center
          </h1>
          <p className="text-sm text-slate-500 mt-1">Track and respond to customer queries, issues, and profile update inquiries.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Tickets List */}
        <div className="lg:col-span-2 premium-card overflow-hidden">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
              Active Customer Support Tickets
            </h2>
            <span className="text-xs text-slate-400">{tickets.length} records</span>
          </div>

          {loading ? (
            <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : error ? (
            <div className="p-12 text-center text-red-500">{error}</div>
          ) : tickets.length === 0 ? (
            <div className="p-12 text-center text-slate-450">No tickets found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Ticket ID</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Priority</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tickets.map((ticket, idx) => (
                    <tr key={ticket.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'} hover:bg-slate-50/50 transition-colors`}>
                      <td className="py-4 px-4 font-mono font-semibold text-xs text-slate-500">#{ticket.id.slice(0, 8).toUpperCase()}</td>
                      <td className="py-4 px-4 font-semibold text-slate-900">
                        {ticket.user ? `${ticket.user.first_name} ${ticket.user.last_name}` : 'Unknown'}
                      </td>
                      <td className="py-4 px-4 text-slate-600 font-medium">
                        <p>{ticket.subject}</p>
                        {ticket.description && <p className="text-xs text-slate-400 mt-1">{ticket.description}</p>}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          ticket.priority === 'high' || ticket.priority === 'urgent' ? 'bg-red-50 text-red-700 border-red-100' :
                          ticket.priority === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                          'bg-slate-50 text-slate-600 border border-slate-200'
                        }`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          ticket.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                        }`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        {ticket.status === 'open' && user?.role !== 'customer' && (
                          <button
                            onClick={() => handleResolve(ticket.id)}
                            disabled={actionLoading === ticket.id}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-60"
                          >
                            {actionLoading === ticket.id ? '...' : 'Mark Resolved'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create Ticket Panel (for Customers) */}
        <div className="space-y-6">
          <div className="premium-card p-5">
            <h2 className="text-base font-bold mb-4 text-slate-900 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
              Create Support Ticket
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
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1">Subject *</label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900"
                  placeholder="Summarize your issue"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-650 uppercase tracking-wider mb-1">Description</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none text-slate-900 h-24"
                  placeholder="Detail your request"
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
                    <option value="general">General</option>
                    <option value="transaction">Transaction</option>
                    <option value="card">Card</option>
                    <option value="loan">Loan</option>
                    <option value="account">Account</option>
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
