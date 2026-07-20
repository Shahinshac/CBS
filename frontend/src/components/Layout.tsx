import { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  Building2, LogOut, Users, TerminalSquare, BarChart3, UserPlus,
  Landmark, ShieldAlert, HelpCircle, LayoutDashboard, GitBranch,
  Activity, RefreshCw, Menu, X
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

const NAV_ITEMS = [
  // Customer
  { name: 'My NetBanking', href: '/net-banking', icon: Landmark, roles: ['customer'] },

  // Super Admin
  { name: 'Admin Dashboard', href: '/admin-dashboard', icon: LayoutDashboard, roles: ['super_admin'] },
  { name: 'Branch Management', href: '/branch-management', icon: GitBranch, roles: ['super_admin'] },
  { name: 'Reports & Analytics', href: '/reports', icon: BarChart3, roles: ['super_admin'] },
  { name: 'Staff Management', href: '/staff-management', icon: Users, roles: ['super_admin'] },

  // Branch Manager
  { name: 'Branch Analytics', href: '/manager-dashboard', icon: Activity, roles: ['branch_manager', 'super_admin'] },

  // Teller / Staff
  { name: 'Teller Workspace', href: '/teller-workspace', icon: TerminalSquare, roles: ['teller', 'branch_manager', 'super_admin'] },
  { name: 'Onboard Customer', href: '/onboard-customer', icon: UserPlus, roles: ['teller', 'branch_manager', 'super_admin', 'customer_support'] },

  // Loan Officer
  { name: 'Loan Desk', href: '/loan-desk', icon: Landmark, roles: ['loan_officer', 'branch_manager', 'super_admin'] },

  // Support / Audit
  { name: 'Support Tickets', href: '/support-tickets', icon: HelpCircle, roles: ['customer_support', 'branch_manager', 'super_admin'] },
  { name: 'Audit Logs', href: '/audit-logs', icon: ShieldAlert, roles: ['auditor', 'super_admin'] },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  branch_manager: 'Branch Manager',
  teller: 'Teller',
  loan_officer: 'Loan Officer',
  customer_support: 'Customer Support',
  auditor: 'Auditor',
  customer: 'Customer',
};

export const Layout = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const allowedNav = NAV_ITEMS.filter((item) => item.roles.includes(user?.role || ''));

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-slate-800 justify-between">
        <div className="flex items-center">
          <Building2 className="w-6 h-6 text-blue-500 mr-2.5" />
          <div>
            <span className="text-base font-bold tracking-tight text-white">CoreBank</span>
            <span className="ml-1.5 text-[10px] text-blue-400 font-medium bg-blue-900/40 px-1.5 py-0.5 rounded">CBS</span>
          </div>
        </div>
        <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <div className="px-3 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 px-3 mb-1.5">
            {ROLE_LABELS[user?.role || ''] || 'Portal'}
          </p>
        </div>
        <nav className="px-3 space-y-0.5">
          {allowedNav.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition-all duration-150',
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon
                    className={cn(
                      'flex-shrink-0 mr-3 h-4 w-4',
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                    )}
                  />
                  {item.name}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User Profile */}
      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="ml-3 flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-wider">
              {ROLE_LABELS[user?.role || ''] || user?.role}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition-all"
            title="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* ── Fixed Desktop Sidebar ──────────────────────────────────────────── */}
      <div className="hidden lg:flex w-64 bg-slate-900 border-r border-slate-800 flex-col text-slate-100 flex-shrink-0">
        {sidebarContent}
      </div>

      {/* ── Mobile Sidebar Overlay ─────────────────────────────────────────── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200"
          />
          <div className="relative flex w-64 max-w-xs flex-1 flex-col bg-slate-900 text-slate-100 animate-in slide-in-from-left duration-200 z-50">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* ── Main Content ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 mr-2 text-slate-500 hover:bg-slate-100 rounded-lg cursor-pointer"
              title="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-slate-600 font-medium">System Online</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-all cursor-pointer"
              title="Refresh Page"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <span className="text-xs text-slate-500">{new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-slate-50">
          <div className="p-6 max-w-screen-2xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};
