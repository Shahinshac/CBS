import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Employee modules
import { TellerWorkspace } from './pages/TellerWorkspace';
import { CustomerOnboarding } from './pages/CustomerOnboarding';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { LoanDesk } from './pages/LoanDesk';
import { StaffManagement } from './pages/StaffManagement';
import { SupportTickets } from './pages/SupportTickets';
import { AuditLogs } from './pages/AuditLogs';
import { AdminDashboard } from './pages/AdminDashboard';
import { BranchManagement } from './pages/BranchManagement';
import { ReportsModule } from './pages/ReportsModule';

// Customer module
import { NetBanking } from './pages/NetBanking';

const ALL_STAFF_ROLES = [
  'super_admin', 'branch_manager', 'teller', 'loan_officer',
  'customer_support', 'auditor',
];

const HomeRedirect = () => {
  const { user } = useAuthStore();
  const token = localStorage.getItem('access_token');
  
  if (token && !user) {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }
  
  const getDefaultPath = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'super_admin': return '/admin-dashboard';
      case 'branch_manager': return '/manager-dashboard';
      case 'teller': return '/teller-workspace';
      case 'loan_officer': return '/loan-desk';
      case 'customer_support': return '/support-tickets';
      case 'auditor': return '/audit-logs';
      case 'customer': return '/net-banking';
      default: return '/teller-workspace';
    }
  };

  return <Navigate to={getDefaultPath()} replace />;
};

function App() {
  const { checkAuth } = useAuthStore();

  useEffect(() => { checkAuth(); }, [checkAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login/customer" element={<Login defaultPersona="customer" />} />
        <Route path="/login/admin" element={<Login defaultPersona="admin" />} />
        <Route path="/login/employee" element={<Login defaultPersona="employee" />} />
        <Route path="/login" element={<Navigate to="/login/customer" replace />} />
        <Route path="/register" element={<Register />} />

        {/* ── All authenticated users (staff + customer) ── */}
        <Route element={<ProtectedRoute allowedRoles={[...ALL_STAFF_ROLES, 'customer']} />}>
          <Route element={<Layout />}>

            {/* Smart home redirect */}
            <Route path="/" element={<HomeRedirect />} />

            {/* ── Customer NetBanking ── */}
            <Route element={<ProtectedRoute allowedRoles={['customer']} />}>
              <Route path="/net-banking" element={<NetBanking />} />
            </Route>

            {/* ── Teller ── */}
            <Route element={<ProtectedRoute allowedRoles={[...ALL_STAFF_ROLES]} />}>
              <Route path="/teller-workspace" element={<TellerWorkspace />} />
              <Route path="/onboard-customer" element={<CustomerOnboarding />} />
            </Route>

            {/* ── Manager ── */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin', 'branch_manager']} />}>
              <Route path="/manager-dashboard" element={<ManagerDashboard />} />
            </Route>

            {/* ── Loan Officer ── */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'loan_officer']} />}>
              <Route path="/loan-desk" element={<LoanDesk />} />
            </Route>

            {/* ── Super Admin only ── */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin']} />}>
              <Route path="/admin-dashboard" element={<AdminDashboard />} />
              <Route path="/staff-management" element={<StaffManagement />} />
              <Route path="/branch-management" element={<BranchManagement />} />
              <Route path="/reports" element={<ReportsModule />} />
            </Route>

            {/* ── Support Tickets ── */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin', 'branch_manager', 'customer_support']} />}>
              <Route path="/support-tickets" element={<SupportTickets />} />
            </Route>

            {/* ── Audit ── */}
            <Route element={<ProtectedRoute allowedRoles={['super_admin', 'auditor']} />}>
              <Route path="/audit-logs" element={<AuditLogs />} />
            </Route>

          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
