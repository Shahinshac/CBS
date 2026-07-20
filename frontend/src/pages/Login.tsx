import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Building2, 
  Lock, 
  Loader2, 
  ShieldCheck, 
  KeyRound, 
  UserCircle 
} from 'lucide-react';


const loginSchema = z.object({
  username: z.string().min(3, { message: 'Username must be at least 3 characters long' }),
  password: z.string().min(6, { message: 'Password must be at least 6 characters long' }),
});

type LoginSchemaInput = z.infer<typeof loginSchema>;

export const Login = ({ defaultPersona = 'customer' }: { defaultPersona?: 'customer' | 'employee' | 'admin' }) => {
  const [persona, setPersona] = useState<'customer' | 'employee' | 'admin'>(defaultPersona);
  const { login, loading, error } = useAuthStore();
  const navigate = useNavigate();

  const { register, handleSubmit: handleFormSubmit, formState: { errors } } = useForm<LoginSchemaInput>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    setPersona(defaultPersona);
  }, [defaultPersona]);

  const proceedNavigation = (role: string | null) => {
    if (role === 'super_admin' || role === 'admin') {
      navigate('/staff-management');
    } else if (role === 'branch_manager' || role === 'manager') {
      navigate('/manager-dashboard');
    } else if (role === 'teller' || role === 'staff') {
      navigate('/teller-workspace');
    } else if (role === 'loan_officer') {
      navigate('/loan-desk');
    } else if (role === 'customer_support') {
      navigate('/support-tickets');
    } else if (role === 'auditor') {
      navigate('/audit-logs');
    } else if (role === 'customer') {
      navigate('/net-banking');
    } else {
      useAuthStore.getState().logout();
      alert("Unauthorized role configuration on this portal.");
    }
  };

  const onSubmit = async (data: LoginSchemaInput) => {
    const result = await login({ username: data.username, password: data.password });
    if (result.success) {
      proceedNavigation(result.role || null);
    }
  };


  const getLabelAndPlaceholder = () => {
    switch (persona) {
      case 'customer':
        return { label: 'Customer Login ID', placeholder: 'Enter your Customer ID' };
      case 'employee':
        return { label: 'Staff Username', placeholder: 'Enter your username or email' };
      case 'admin':
        return { label: 'Administrator Username', placeholder: 'Enter your administrator username' };
    }
  };

  const { label, placeholder } = getLabelAndPlaceholder();

  return (
    <main className="w-full min-h-screen flex flex-col md:flex-row overflow-hidden bg-slate-50 font-sans text-slate-950">
      {/* Left Side: Brand Imagery & Logo */}
      <section className="hidden md:flex md:w-1/2 lg:w-3/5 relative bg-slate-900 items-center justify-center p-12 lg:p-20 overflow-hidden">
        {/* Background Visual Graphic */}
        <div className="absolute inset-0 z-0 opacity-40">
          <div 
            className="w-full h-full bg-cover bg-center" 
            style={{ 
              backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuAc_RC802s898jNMNT_ZKyDqEHYr-gI0jS3MUjBaUSPxSOsGWmtb1S5md9SC1mgb3Pxdz9vro4HJDva9Cu3HuWHbxsrFhadaVMtmYkAHLiOe3X9Xnq7ClUYcBpF5a00MrS9eW-Z6Uyp2NIJ9UltPByVDyBq_CSNfQvcYiI-36d-4J1FrJg3S3hhfmMuBURZOt9W0UNuFs-9qkF0oDwGux1dCrseVtHNVcEKTN6FT3Q4x3oQBEDIL7yAaA')` 
            }}
          ></div>
        </div>
        {/* Animated Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-slate-900/85 to-blue-950/70 z-10"></div>
        
        {/* Logo & Brand Content */}
        <div className="relative z-20 flex flex-col items-center text-center max-w-lg">
          <div className="mb-8 p-5 bg-slate-800/60 backdrop-blur-md rounded-2xl shadow-xl border border-slate-700/50 flex items-center justify-center">
            <Building2 className="h-12 w-12 text-blue-500 drop-shadow-md" />
          </div>
          <h1 className="text-4xl lg:text-5xl font-extrabold text-white mb-4 tracking-tight">Institutional Excellence.</h1>
          <p className="text-slate-300 text-sm lg:text-base mb-8">
            Empowering your financial future with secure, high-performance banking infrastructure built for the enterprise era.
          </p>
          
          {/* Security Badges */}
          <div className="flex flex-wrap justify-center gap-6 text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">ISO 27001 Certified</span>
            </div>
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-200">256-bit AES Encryption</span>
            </div>
          </div>
        </div>
        
        {/* Subtle Decorative Footer */}
        <div className="absolute bottom-8 left-8 text-slate-500 font-mono text-[10px] uppercase tracking-[0.25em]">
          ApexCore System v.4.12.0 // Secure Terminal
        </div>
      </section>

      {/* Right Side: Login Form */}
      <section className="w-full md:w-1/2 lg:w-2/5 flex flex-col justify-center items-center bg-white p-6 md:p-12 lg:p-20 relative border-l border-slate-200">
        <div className="w-full max-w-md">
          <header className="mb-8">
            <div className="md:hidden mb-6 flex items-center gap-2">
              <Building2 className="h-8 w-8 text-blue-600" />
              <span className="text-xl font-bold tracking-tight text-slate-900">CoreBank</span>
            </div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2 capitalize">{persona} Sign-In</h2>
            <p className="text-slate-500 text-sm">Please enter your secure credentials to access the bank portal.</p>
          </header>

          {/* Login Form */}
          <form className="space-y-6" onSubmit={handleFormSubmit(onSubmit)}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2" htmlFor="username">
                {label}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <UserCircle className="w-5 h-5" />
                </span>
                <input
                  id="username"
                  type="text"
                  placeholder={placeholder}
                  {...register('username')}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              {errors.username && (
                <span className="text-red-500 text-xs mt-1 block">{errors.username.message}</span>
              )}
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700" htmlFor="password">
                  Password
                </label>
                <a className="text-xs font-semibold text-blue-600 hover:underline" href="#">
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-5 h-5" />
                </span>
                <input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...register('password')}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-lg text-slate-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
              </div>
              {errors.password && (
                <span className="text-red-500 text-xs mt-1 block">{errors.password.message}</span>
              )}
            </div>

            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                className="w-4 h-4 text-blue-600 bg-white border-slate-300 rounded focus:ring-blue-500"
              />
              <label className="ml-2 text-sm text-slate-600" htmlFor="remember">
                Remember my ID on this device
              </label>
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
                  <Lock className="w-4 h-4" />
                  Secure Login
                </>
              )}
            </button>
          </form>

          {persona !== 'admin' && (
            <div className="mt-8 text-center">
              <p className="text-sm text-slate-600">
                {persona === 'employee' ? 'First-time employee? ' : 'First-time user? '}
                <Link 
                  className="text-blue-600 font-bold hover:underline" 
                  to={persona === 'employee' ? '/register?type=employee' : '/register?type=customer'}
                >
                  Register here
                </Link>
              </p>
            </div>
          )}

          {/* Security Assurance */}
          <div className="mt-12 pt-8 border-t border-slate-200 flex flex-col items-center">
            <div className="flex items-center gap-2 mb-2 text-slate-500">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold">Secure 256-bit encrypted connection</span>
            </div>
            <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">
              ApexCore Guardian Protocol Enabled
            </p>
          </div>
        </div>

        {/* Footer Links */}
        <footer className="absolute bottom-8 left-0 w-full flex justify-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <a className="hover:text-slate-600" href="#">Privacy Policy</a>
          <a className="hover:text-slate-600" href="#">Terms of Service</a>
          <a className="hover:text-slate-600" href="#">Contact Security</a>
        </footer>
      </section>
    </main>
  );
};
