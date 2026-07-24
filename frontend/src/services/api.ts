import axios, { type InternalAxiosRequestConfig, type AxiosResponse, type AxiosError } from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: AxiosError | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  isRefreshing = false;
  failedQueue = [];
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig & { __isRetry?: boolean };
    const response = error.response;

    const skipRefreshPaths = ['/auth/login', '/auth/register', '/auth/register-check', '/auth/register-finalize'];
    if (skipRefreshPaths.some((p) => config?.url?.includes(p))) return Promise.reject(error);

    if (response?.status === 401 && config && !config.__isRetry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then((token) => {
            if (config.headers) config.headers.Authorization = `Bearer ${token}`;
            return api(config);
          });
      }

      isRefreshing = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (!refreshToken) {
        localStorage.clear();
        processQueue(error, null);
        window.location.href = '/login';
        return Promise.reject(error);
      }

      return new Promise((resolve, reject) => {
        api.post('/auth/refresh', { refresh_token: refreshToken })
          .then(({ data }) => {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            if (config.headers) config.headers.Authorization = `Bearer ${data.access_token}`;
            config.__isRetry = true;
            processQueue(null, data.access_token);
            resolve(api(config));
          })
          .catch((err) => {
            localStorage.clear();
            processQueue(err, null);
            window.location.href = '/login';
            reject(err);
          });
      });
    }

    return Promise.reject(error);
  }
);

// ─── Auth ──────────────────────────────────────────────────────────────────
export const authAPI = {
  login: (credentials: any) => api.post('/auth/login', credentials),
  getMe: () => api.get('/auth/me'),
  checkRegister: (data: { account_or_card: string; phone_number: string; date_of_birth?: string }) =>
    api.post('/auth/register-check', data),
  finalizeRegister: (data: any) => api.post('/auth/register-finalize', data),
  checkUsername: (username: string) => api.get(`/auth/check-username/${username}`),
  updateProfile: (data: any) => api.patch('/auth/profile', data),
  changePassword: (data: any) => api.post('/auth/change-password', data),
};

// ─── Universal Search ──────────────────────────────────────────────────────
export const searchAPI = {
  universal: (q: string) => api.get('/search', { params: { q } }),
};

// ─── Branches ─────────────────────────────────────────────────────────────
export const branchAPI = {
  getAll: () => api.get('/branches'),
  getById: (id: string) => api.get(`/branches/${id}`),
  getStats: (id: string) => api.get(`/branches/${id}/stats`),
  create: (data: any) => api.post('/branches', data),
  update: (id: string, data: any) => api.patch(`/branches/${id}`, data),
  deactivate: (id: string, deleted_by?: string) => api.delete(`/branches/${id}`, { data: { deleted_by } }),
};

// ─── Accounts ─────────────────────────────────────────────────────────────
export const accountAPI = {
  getAll: (params?: { user_id?: string; branch_id?: string }) => api.get('/accounts', { params }),
  getById: (id: string) => api.get(`/accounts/${id}`),
  create: (data: any) => api.post('/accounts', data),
  update: (id: string, data: any) => api.patch(`/accounts/${id}`, data),
  approve: (id: string, data: { approved_by: string }) => api.patch(`/accounts/${id}/approve`, data),
  reactivate: (id: string, data: { updated_by: string }) => api.patch(`/accounts/${id}/reactivate`, data),
  createFdRd: (data: any) => api.post('/accounts/fdrd', data),
  getStatement: (id: string, params?: { from_date?: string; to_date?: string }) =>
    `${API_BASE_URL}/accounts/${id}/statement/pdf?from_date=${params?.from_date || ''}&to_date=${params?.to_date || ''}`,
  getPassbook: (id: string) => `${API_BASE_URL}/accounts/${id}/passbook/pdf`,
};

// ─── Transactions ──────────────────────────────────────────────────────────
export const transactionAPI = {
  getAll: (params?: { account_id?: string; user_id?: string; limit?: number; type?: string; from_date?: string; to_date?: string }) =>
    api.get('/transactions', { params }),
  deposit: (data: any) => api.post('/transactions/deposit', data),
  withdraw: (data: any) => api.post('/transactions/withdraw', data),
  transfer: (data: any) => api.post('/transactions/transfer', data),
  cbsTransfer: (data: any) => api.post('/transactions/transfer/cbs', data),
  getReceipt: (id: string) => `${API_BASE_URL}/transactions/${id}/receipt/pdf`,
  getPending: () => api.get('/transactions/pending'),
  approve: (id: string, data: { approved_by: string }) => api.patch(`/transactions/${id}/approve`, data),
  reject: (id: string, data: { rejected_by: string }) => api.patch(`/transactions/${id}/reject`, data),
  reverse: (id: string, data: { requested_by: string }) => api.post(`/transactions/${id}/reverse`, data),
};

// ─── Cards ─────────────────────────────────────────────────────────────────
export const cardAPI = {
  getById: (id: string) => api.get(`/cards/${id}`),
  issue: (data: any) => api.post('/cards', data),
  toggleBlock: (id: string, performed_by?: string) => api.patch(`/cards/${id}/toggle-block`, { performed_by }),
  setLimit: (id: string, limit: number, performed_by?: string) => api.patch(`/cards/${id}/limit`, { limit, performed_by }),
  activate: (id: string, performed_by?: string) => api.patch(`/cards/${id}/activate`, { performed_by }),
  replace: (id: string, performed_by?: string) => api.patch(`/cards/${id}/replace`, { performed_by }),
  pinReset: (id: string, performed_by?: string) => api.patch(`/cards/${id}/pin-reset`, { performed_by }),
};

// ─── Loans ─────────────────────────────────────────────────────────────────
export const loanAPI = {
  getAll: (params?: { user_id?: string; status?: string; loan_type?: string }) => api.get('/loans', { params }),
  getById: (id: string) => api.get(`/loans/${id}`),
  apply: (data: any) => api.post('/loans', data),
  cancel: (id: string, reason?: string) => api.patch(`/loans/${id}/cancel`, { reason }),
  updateStatus: (id: string, data: { status: string; approved_by?: string; approved_amount?: number; manager_remarks?: string; rejection_reason?: string }) =>
    api.patch(`/loans/${id}/status`, data),
  assessCredit: (loanId: string) => api.post(`/loans/${loanId}/credit-assessment`),
};

// ─── Beneficiaries ─────────────────────────────────────────────────────────
export const beneficiaryAPI = {
  getAll: (user_id: string) => api.get('/beneficiaries', { params: { user_id } }),
  add: (data: any) => api.post('/beneficiaries', data),
  remove: (id: string, user_id: string) => api.delete(`/beneficiaries/${id}`, { data: { user_id } }),
};

// ─── Bills ─────────────────────────────────────────────────────────────────
export const billAPI = {
  getAll: (account_id: string) => api.get('/bills', { params: { account_id } }),
  create: (data: any) => api.post('/bills', data),
  pay: (id: string, data: any) => api.post(`/bills/${id}/pay`, data),
};

// ─── Cheques ───────────────────────────────────────────────────────────────
export const chequeAPI = {
  getRequests: (account_id?: string) => api.get('/cheques/requests', { params: { account_id } }),
  requestBook: (data: any) => api.post('/cheques/request', data),
  updateRequest: (id: string, data: any) => api.patch(`/cheques/requests/${id}`, data),
  stopCheque: (data: any) => api.post('/cheques/stop', data),
  getStops: (account_id?: string) => api.get('/cheques/stops', { params: { account_id } }),
};

// ─── Admin — Customers ─────────────────────────────────────────────────────
export const adminAPI = {
  getCustomers: (params?: { branch_id?: string; status?: string; kyc_status?: string }) =>
    api.get('/admin/customers', { params }),
  getCustomer: (id: string) => api.get(`/admin/customers/${id}`),
  createCustomer: (data: any) => api.post('/admin/customers', data),
  updateCustomer: (id: string, data: any) => api.patch(`/admin/customers/${id}`, data),
  getStats: () => api.get('/admin/stats'),
  getBranchCash: (branch_id?: string) => api.get('/admin/branch-cash', { params: { branch_id } }),
};

// ─── Admin — Employees ─────────────────────────────────────────────────────
export const employeeAPI = {
  getAll: (params?: { branch_id?: string; role?: string }) => api.get('/admin/employees', { params }),
  create: (data: any) => api.post('/admin/employees', data),
  update: (id: string, data: any) => api.patch(`/admin/employees/${id}`, data),
  deactivate: (id: string, deleted_by?: string) => api.delete(`/admin/employees/${id}`, { data: { deleted_by } }),
};

// ─── Cash Drawer ───────────────────────────────────────────────────────────
export const cashDrawerAPI = {
  open: (data: any) => api.post('/teller/cash-drawer/open', data),
  close: (data: any) => api.post('/teller/cash-drawer/close', data),
  get: (teller_id: string) => api.get('/teller/cash-drawer', { params: { teller_id } }),
};

// ─── Support Tickets ───────────────────────────────────────────────────────
export const ticketAPI = {
  getAll: (params?: { status?: string; user_id?: string; assigned_to?: string; category?: string }) =>
    api.get('/support/tickets', { params }),
  create: (data: { user_id: string; subject: string; description?: string; priority?: string; category?: string }) =>
    api.post('/support/tickets', data),
  reply: (id: string, data: { user_id?: string; message: string; user_name?: string; user_role?: string }) =>
    api.post(`/support/tickets/${id}/reply`, data),
  updateStatus: (id: string, data: { status: string; assigned_to?: string; updated_by?: string }) =>
    api.patch(`/support/tickets/${id}/status`, data),
  resolve: (id: string, data?: { status?: string; assigned_to?: string }) =>
    api.patch(`/support/tickets/${id}/resolve`, data),
  assign: (id: string, data: { assigned_to: string; assigned_by?: string }) =>
    api.post(`/support/tickets/${id}/assign`, data),
  escalate: (id: string, data: { escalated_by?: string; reason?: string }) =>
    api.post(`/support/tickets/${id}/escalate`, data),
};

// ─── Audit Logs ────────────────────────────────────────────────────────────
export const auditAPI = {
  getLogs: (params?: { limit?: number; module?: string; from_date?: string }) =>
    api.get('/audit/logs', { params }),
};

// ─── Notifications ─────────────────────────────────────────────────────────
export const notificationAPI = {
  getAll: (user_id: string, unread_only?: boolean) =>
    api.get('/notifications', { params: { user_id, unread_only: unread_only ? 'true' : undefined } }),
  markRead: (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: (user_id: string) => api.patch('/notifications/read-all', { user_id }),
};

// ─── Announcements ─────────────────────────────────────────────────────────
export const announcementAPI = {
  getAll: (role?: string) => api.get('/announcements', { params: { role } }),
  create: (data: any) => api.post('/announcements', data),
  update: (id: string, data: any) => api.patch(`/announcements/${id}`, data),
  delete: (id: string) => api.delete(`/announcements/${id}`),
};


// ─── Reports ───────────────────────────────────────────────────────────────
export const reportAPI = {
  daily: (params?: { date?: string; branch_id?: string }) => api.get('/reports/daily', { params }),
  monthly: (params?: { month?: string; year?: string }) => api.get('/reports/monthly', { params }),
  loans: () => api.get('/reports/loans'),
  cash: (params?: { branch_id?: string }) => api.get('/reports/cash', { params }),
  audit: (params?: { from_date?: string; to_date?: string }) => api.get('/reports/audit', { params }),
};

// ─── System ────────────────────────────────────────────────────────────────
export const systemAPI = {
  health: () => api.get('/system/health'),
  processEOD: (data: any) => api.post('/system/process-eod', data),
};

// ─── Standing Instructions (Scheduled Payments) ────────────────────────────
export const scheduledPaymentAPI = {
  getAll: (params?: { account_id?: string; user_id?: string }) =>
    api.get('/accounts/scheduled-payments', { params }),
  create: (data: any) => api.post('/accounts/scheduled-payments', data),
  cancel: (id: string) => api.patch(`/accounts/scheduled-payments/${id}/cancel`),
};

// ─── CBS Misc (legacy compat) ──────────────────────────────────────────────
export const cbsAPI = {
  closeCashDrawer: (data: any) => cashDrawerAPI.close(data),
  assessCredit: (loanId: string) => loanAPI.assessCredit(loanId),
  getBranchCash: () => adminAPI.getBranchCash(),
};

export default api;
