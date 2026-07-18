import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Landmark, ArrowRight, CheckCircle2, ShieldAlert, Loader2, CreditCard, Smartphone, Calendar, User, Lock } from 'lucide-react';
import { authAPI } from '../services/api';

export const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form State - Step 1
  const [accountOrCard, setAccountOrCard] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dob, setDob] = useState('');

  // Form State - Step 2
  const [userId, setUserId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!accountOrCard.trim() || !phoneNumber.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.checkRegister({
        account_or_card: accountOrCard.trim(),
        phone_number: phoneNumber.trim(),
        date_of_birth: dob,
      });
      setUserId(response.data.user_id);
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Verification failed. Please check details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.finalizeRegister({
        user_id: userId,
        username: username.trim(),
        password,
      });
      setSuccess('Net Banking registration completed successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login/customer');
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Finalization failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="w-full min-h-screen flex flex-col md:flex-row overflow-hidden bg-slate-50 font-sans text-slate-950">
      {/* Left Side: Informative/Brand Column */}
      <section className="hidden md:flex md:w-1/2 lg:w-3/5 relative bg-slate-900 items-center justify-center p-12 lg:p-20 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-40">
          <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-blue-500/20 blur-[120px]" />
          <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] rounded-full bg-indigo-500/20 blur-[120px]" />
        </div>
        
        <div className="relative z-10 w-full max-w-lg text-white space-y-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Landmark className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-wider font-mono">RESERVE.</span>
          </div>
          
          <div className="space-y-4">
            <h1 className="text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight">
              Activate Online Banking Securely
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed">
              Unlock access to your funds, deposits, card details, transfer settings, and statements in under two minutes. Just verify your customer information to get started.
            </p>
          </div>

          <div className="space-y-4 border-t border-slate-800 pt-6">
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">1</div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Validate Account</h3>
                <p className="text-slate-500 text-xs mt-1">Cross-check with your registered phone number and details on file.</p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-blue-400 shrink-0">2</div>
              <div>
                <h3 className="font-semibold text-slate-200 text-sm">Create Username & Password</h3>
                <p className="text-slate-500 text-xs mt-1">Setup secure passwords to safeguard access to your online banking portal.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Right Side: Registration Wizard Form */}
      <section className="w-full md:w-1/2 lg:w-2/5 flex items-center justify-center p-6 sm:p-12 lg:p-16 bg-white overflow-y-auto">
        <div className="w-full max-w-md space-y-8 py-6">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 block">Net Banking Portal</span>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {step === 1 ? 'Register Net Banking' : 'Create Credentials'}
            </h2>
            <p className="text-slate-500 text-sm">
              {step === 1 
                ? 'Enter your bank registered account parameters to verify identity.' 
                : 'Choose a unique username and strong password.'}
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl p-3 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-xl p-4 flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span className="font-medium">{success}</span>
            </div>
          )}

          {step === 1 ? (
            <form onSubmit={handleStep1Submit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2" htmlFor="accountOrCard">
                  Account Number / Debit Card Number
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <CreditCard className="w-5 h-5" />
                  </span>
                  <input
                    id="accountOrCard"
                    type="text"
                    required
                    placeholder="Enter 10-digit Account or 16-digit Card Number"
                    value={accountOrCard}
                    onChange={(e) => setAccountOrCard(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2" htmlFor="phoneNumber">
                  Registered Mobile Number
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Smartphone className="w-5 h-5" />
                  </span>
                  <input
                    id="phoneNumber"
                    type="tel"
                    required
                    placeholder="Enter your registered mobile number"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2" htmlFor="dob">
                  Date of Birth
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Calendar className="w-5 h-5" />
                  </span>
                  <input
                    id="dob"
                    type="date"
                    required
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Verify details
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleStep2Submit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2" htmlFor="username">
                  Create Username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <User className="w-5 h-5" />
                  </span>
                  <input
                    id="username"
                    type="text"
                    required
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2" htmlFor="password">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    id="password"
                    type="password"
                    required
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2" htmlFor="confirmPassword">
                  Confirm Password
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Lock className="w-5 h-5" />
                  </span>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    placeholder="Verify password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-lg shadow-sm hover:shadow active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Activate Net Banking
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          <div className="mt-8 text-center border-t border-slate-100 pt-6">
            <p className="text-sm text-slate-600">
              Already registered?{' '}
              <Link className="text-blue-600 font-bold hover:underline" to="/login/customer">
                Secure Login
              </Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};
