import { useState, useEffect } from 'react';
import { adminAPI, branchAPI } from '../services/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { UserPlus, Mail, Phone, Lock, User, Loader2, CreditCard, CheckCircle2, AlertCircle, Copy, Calendar } from 'lucide-react';

const onboardSchema = z.object({
  first_name: z.string().min(1, { message: 'First name is required' }),
  last_name: z.string().min(1, { message: 'Last name is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
  phone_number: z.string().min(6, { message: 'Phone number must be at least 6 digits' }),
  date_of_birth: z.string().min(1, { message: 'Date of birth is required' }),
  branch_id: z.string().min(1, { message: 'Branch selection is required' }),
  temporary_password: z.string().optional(),
});

type OnboardSchemaInput = z.infer<typeof onboardSchema>;

export const CustomerOnboarding = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    branchAPI.getAll().then(res => setBranches(res.data.branches || [])).catch(() => {});
  }, []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<OnboardSchemaInput>({
    resolver: zodResolver(onboardSchema),
  });

  const onSubmit = async (data: OnboardSchemaInput) => {
    setLoading(true);
    setResult(null);
    setError('');

    try {
      const res = await adminAPI.createCustomer(data);
      setResult(res.data);
      reset();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create customer account.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Success Result */}
      {result && (
        <div className="premium-card border-emerald-200 bg-emerald-50/30 overflow-hidden">
          <div className="p-5 bg-emerald-600 text-white flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            <h3 className="font-bold">Customer Successfully Onboarded!</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Customer Info */}
              <div className="bg-white rounded-lg p-4 border border-emerald-100">
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide mb-3 flex items-center">
                  <User className="w-3 h-3 mr-1" /> Customer Details
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-semibold text-slate-900">{result.customer?.first_name} {result.customer?.last_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Username:</span>
                    <span className="font-mono text-slate-900">{result.customer?.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-medium text-slate-900 truncate ml-2 max-w-[140px]">{result.customer?.email}</span>
                  </div>
                </div>
              </div>

              {/* Account Info */}
              <div className="bg-white rounded-lg p-4 border border-blue-100">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-3 flex items-center">
                  <CreditCard className="w-3 h-3 mr-1" /> Account Created
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">Account No:</span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono font-bold text-slate-900">{result.account?.account_number}</span>
                      <button onClick={() => copyToClipboard(result.account?.account_number)} className="p-0.5 text-slate-400 hover:text-blue-600 cursor-pointer">
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Type:</span>
                    <span className="font-semibold text-slate-900 capitalize">{result.account?.account_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">ATM Card:</span>
                    <span className="font-mono text-slate-900">{result.card?.card_number}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Temp Password */}
            <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-2 flex items-center">
                <Lock className="w-3 h-3 mr-1" /> Temporary Credentials — Provide to Customer
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-amber-700">Username:</span>
                  <span className="font-mono font-bold text-amber-900">{result.customer?.username}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-amber-700">Password:</span>
                  <span className="font-mono font-bold text-amber-900">{result.temp_password}</span>
                </div>
              </div>
              <p className="text-xs text-amber-600 mt-2">⚠ Ask customer to activate Net Banking and change their password on first login.</p>
            </div>

            <button
              onClick={() => setResult(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 cursor-pointer transition-colors text-sm"
            >
              Onboard Another Customer
            </button>
          </div>
        </div>
      )}

      {/* Onboarding Form */}
      {!result && (
        <div className="premium-card p-8">
          <div className="flex items-center mb-6 border-b border-slate-100 pb-5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center mr-4 border border-blue-100">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">New Customer Registration</h2>
              <p className="text-sm text-slate-500 mt-0.5">Create a core banking record for a walk-in customer. A savings account and ATM card are auto-generated.</p>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg border bg-red-50 text-red-800 border-red-200 text-sm font-medium flex items-center">
              <AlertCircle className="w-4 h-4 mr-2 text-red-600" />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">First Name *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    {...register('first_name')}
                    className="pl-10 w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 text-sm placeholder-slate-400"
                    placeholder="Enter customer's first name"
                  />
                </div>
                {errors.first_name && <span className="text-red-500 text-xs mt-1 block">{errors.first_name.message}</span>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Last Name *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    {...register('last_name')}
                    className="pl-10 w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 text-sm placeholder-slate-400"
                    placeholder="Enter customer's last name"
                  />
                </div>
                {errors.last_name && <span className="text-red-500 text-xs mt-1 block">{errors.last_name.message}</span>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email Address *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  {...register('email')}
                  className="pl-10 w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 text-sm placeholder-slate-400"
                  placeholder="Enter customer's email address"
                />
              </div>
              {errors.email && <span className="text-red-500 text-xs mt-1 block">{errors.email.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone Number *</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="tel"
                  {...register('phone_number')}
                  className="pl-10 w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 text-sm placeholder-slate-400"
                  placeholder="Enter customer's registered phone number"
                />
              </div>
              {errors.phone_number && <span className="text-red-500 text-xs mt-1 block">{errors.phone_number.message}</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Date of Birth *</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    type="date"
                    {...register('date_of_birth')}
                    className="pl-10 w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 text-sm"
                  />
                </div>
                {errors.date_of_birth && <span className="text-red-500 text-xs mt-1 block">{errors.date_of_birth.message}</span>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assigned Branch *</label>
                <select
                  {...register('branch_id')}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 text-sm bg-white"
                >
                  <option value="">— Select Branch —</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
                {errors.branch_id && <span className="text-red-500 text-xs mt-1 block">{errors.branch_id.message}</span>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Temporary Password (Optional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  {...register('temporary_password')}
                  className="pl-10 w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-slate-900 text-sm placeholder-slate-400"
                  placeholder="Leave blank to auto-generate (TempPass123!)"
                />
              </div>
            </div>

            {/* Auto-creation note */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-semibold mb-1 flex items-center">
                <CreditCard className="w-4 h-4 mr-2" />
                What gets created automatically:
              </p>
              <ul className="text-xs space-y-1 text-blue-700">
                <li>✓ Customer profile with unique username</li>
                <li>✓ Savings bank account with account number</li>
                <li>✓ Debit / ATM card linked to the account</li>
                <li>✓ Welcome notification sent to customer</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-70 transition-all font-semibold flex items-center justify-center cursor-pointer shadow-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <UserPlus className="w-5 h-5 mr-2" />}
              {loading ? 'Creating Account...' : 'Onboard Customer & Open Account'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
