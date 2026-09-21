import {
  User, House, Collection, Expense, Staff, StaffDesignation, SalaryPayment, AttendanceRecord,
  LedgerEntry, MohallaSettings, AuditLog, HouseProfileData, DefaulterReportItem,
  FinancialSummaryData, EmployeeProfileData
} from '../types/index';

const TOKEN_KEY = 'madina_street_token';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const setStoredToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const removeStoredToken = () => localStorage.removeItem(TOKEN_KEY);

async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: 'Server request failed' }));
      throw new Error(errData.message || `Request failed with status ${res.status}`);
    }

    return await res.json();
  } catch (err: any) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Auth
  login: (email: string, role?: string) => 
    fetchApi<{ success: boolean; user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    }),

  logout: () =>
    fetchApi<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  getMe: () => 
    fetchApi<{ success: boolean; user: User }>('/api/auth/me'),

  // Dashboard
  getDashboardStats: () => 
    fetchApi<{
      success: boolean;
      stats: {
        contributionMonth: string;
        applicableHouses: number;
        collectionPosition: { signedAmount: number; amount: number; state: 'outstanding' | 'settled' | 'advance' };
        paidHouses: number;
        pendingHouses: number;
        goodStandingCount: number;
        warningCount: number;
        totalHouses: number;
        activeHouses: number;
        totalCollectedThisMonth: number;
        totalExpensesThisMonth: number;
        netMonthlyBalance: number;
        outstandingDuesTotal: number;
        collectionRatePercentage: number;
        totalActiveStaff: number;
        defaulterCount: number;
        expectedMonthlyIncome: number;
      };
      topDefaulters: Array<{ houseId: string; houseNo: string; headName: string; pendingMonthsCount: number; outstandingAmount: number }>;
      recentCollections: Collection[];
      recentExpenses: Expense[];
    }>('/api/dashboard/stats'),

  // Houses
  getHouses: (includeDeleted?: boolean) => fetchApi<{ success: boolean; houses: House[] }>(`/api/houses${includeDeleted ? '?includeDeleted=true' : ''}`),
  getHouseProfile: (id: string) => fetchApi<{ success: boolean; profile: HouseProfileData }>(`/api/houses/${id}/profile`),
  quickSearchHouses: (query: string) => fetchApi<{ success: boolean; houses: House[] }>(`/api/houses/quick-search?q=${encodeURIComponent(query)}`),
  getDefaultersReport: () => fetchApi<{ success: boolean; defaulters: DefaulterReportItem[] }>('/api/defaulters'),
  createHouse: (data: Partial<House>) => fetchApi<{ success: boolean; house: House }>('/api/houses', { method: 'POST', body: JSON.stringify(data) }),
  updateHouse: (id: string, data: Partial<House>) => fetchApi<{ success: boolean; house: House }>(`/api/houses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHouse: (id: string) => fetchApi<{ success: boolean }>(`/api/houses/${id}`, { method: 'DELETE' }),
  importHouses: (importedHouses: Partial<House>[]) => fetchApi<{ success: boolean; addedCount: number; errors?: string[] }>('/api/houses/import', { method: 'POST', body: JSON.stringify({ importedHouses }) }),

  // Collections
  getMonthlyDues: (month: string) => fetchApi<{ success: boolean; dues: import('../types').MonthlyDue[] }>(`/api/collections/dues?month=${encodeURIComponent(month)}`),
  getCollections: () => fetchApi<{ success: boolean; collections: Collection[] }>('/api/collections'),
  getCollectionDashboardStats: (month?: string) => fetchApi<{
    success: boolean;
    stats: {
      expectedMonthlyCollection: number;
      totalCollectedThisMonth: number;
      remainingCollection: number;
      collectionPercentage: number;
      totalPaidHouses: number;
      totalPendingHouses: number;
      totalDefaulters: number;
      todayCollection: number;
      thisWeekCollection: number;
      thisMonthCollection: number;
    };
    byPaymentMethod: Array<{ method: string; amount: number; count: number }>;
    byCollector: Array<{ collectorName: string; amount: number; count: number }>;
    monthlyTrends: Array<{ month: string; collected: number; expected: number; receiptsCount: number }>;
    highestMonth: { month: string; amount: number };
    lowestMonth: { month: string; amount: number };
  }>(`/api/collections/dashboard${month ? '?month=' + encodeURIComponent(month) : ''}`),
  getDailyCashClosing: (date?: string) => fetchApi<{
    success: boolean;
    date: string;
    closingReport: {
      openingBalance: number;
      totalTodayCollections: number;
      totalTodayExpenses: number;
      netCash: number;
      collectionsCount: number;
      expensesCount: number;
      methodSummary: Record<string, number>;
      collectorSummary: Record<string, { amount: number; count: number }>;
      collections: Collection[];
      expenses: Expense[];
    };
  }>(`/api/collections/daily-closing${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  createCollection: (data: any) => fetchApi<{ success: boolean; collection: Collection; message?: string }>('/api/collections', { method: 'POST', body: JSON.stringify(data) }),
  bulkGenerateDues: (targetMonth: string) => fetchApi<{ success: boolean; updatedCount: number; targetMonth: string }>('/api/collections/bulk-generate', { method: 'POST', body: JSON.stringify({ targetMonth }) }),
  cancelCollection: (id: string, reason?: string) => fetchApi<{ success: boolean; message: string; collection?: Collection }>(`/api/collections/${id}/cancel`, { method: 'POST', body: JSON.stringify({ reason }) }),
  deleteCollection: (id: string) => fetchApi<{ success: boolean }>(`/api/collections/${id}`, { method: 'DELETE' }),

  // Expenses & Categories
  getExpenseCategories: () => fetchApi<{ success: boolean; categories: Array<{ id: string; name: string; description?: string; isDefault?: boolean }> }>('/api/expense-categories'),
  createExpenseCategory: (name: string, description?: string) => fetchApi<{ success: boolean; category: any }>('/api/expense-categories', { method: 'POST', body: JSON.stringify({ name, description }) }),
  deleteExpenseCategory: (id: string) => fetchApi<{ success: boolean }>(`/api/expense-categories/${id}`, { method: 'DELETE' }),

  getExpenses: (queryParams?: string) => fetchApi<{ success: boolean; expenses: Expense[] }>(`/api/expenses${queryParams ? `?${queryParams}` : ''}`),
  createExpense: (data: any) => fetchApi<{ success: boolean; expense: Expense; message?: string }>('/api/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: any) => fetchApi<{ success: boolean; expense: Expense }>(`/api/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  approveExpense: (id: string) => fetchApi<{ success: boolean; expense: Expense; message?: string }>(`/api/expenses/${id}/approve`, { method: 'POST' }),
  deleteExpense: (id: string) => fetchApi<{ success: boolean }>(`/api/expenses/${id}`, { method: 'DELETE' }),

  // Financial Summary
  getFinancialSummary: () => fetchApi<{ success: boolean; summary: FinancialSummaryData }>('/api/financial-summary'),

  // Staff, Designations & Salaries
  getStaffDesignations: () => fetchApi<{ success: boolean; designations: StaffDesignation[] }>('/api/staff/designations'),
  createStaffDesignation: (title: string, description?: string) => fetchApi<{ success: boolean; designation: StaffDesignation }>('/api/staff/designations', { method: 'POST', body: JSON.stringify({ title, description }) }),
  deleteStaffDesignation: (id: string) => fetchApi<{ success: boolean }>(`/api/staff/designations/${id}`, { method: 'DELETE' }),

  getStaff: () => fetchApi<{ success: boolean; staff: Staff[] }>('/api/staff'),
  createStaff: (data: Partial<Staff>) => fetchApi<{ success: boolean; staff: Staff }>('/api/staff', { method: 'POST', body: JSON.stringify(data) }),
  updateStaff: (id: string, data: Partial<Staff>) => fetchApi<{ success: boolean; staff: Staff }>(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteStaff: (id: string) => fetchApi<{ success: boolean }>(`/api/staff/${id}`, { method: 'DELETE' }),
  getEmployeeProfile: (id: string) => fetchApi<{ success: boolean; profile: EmployeeProfileData }>(`/api/staff/${id}/profile`),

  getSalaries: () => fetchApi<{ success: boolean; salaries: SalaryPayment[] }>('/api/salaries'),
  createSalary: (data: any) => fetchApi<{ success: boolean; salary: SalaryPayment }>('/api/salaries', { method: 'POST', body: JSON.stringify(data) }),
  disburseSalary: (data: any) => fetchApi<{ success: boolean; salary: SalaryPayment }>('/api/salaries', { method: 'POST', body: JSON.stringify(data) }),

  // Attendance
  getAttendance: () => fetchApi<{ success: boolean; attendance: AttendanceRecord[] }>('/api/attendance'),
  saveAttendance: (date: string, records: any[]) => fetchApi<{ success: boolean }>('/api/attendance', { method: 'POST', body: JSON.stringify({ date, records }) }),
  markAllAttendance: (date: string, status: string) => fetchApi<{ success: boolean }>('/api/attendance/mark-all', { method: 'POST', body: JSON.stringify({ date, status }) }),

  // Ledger
  getLedger: () => fetchApi<{ success: boolean; ledger: LedgerEntry[] }>('/api/ledger'),
  createLedgerEntry: (data: any) => fetchApi<{ success: boolean; entry: LedgerEntry }>('/api/ledger/entry', { method: 'POST', body: JSON.stringify(data) }),

  // Reports
  getMonthlyClosing: (month: string) => fetchApi<any>(`/api/reports/monthly-closing?month=${encodeURIComponent(month)}`),
  reconcileLedger: () => fetchApi<any>('/api/ledger/reconcile', { method: 'POST' }),
  getReportSummary: () => fetchApi<any>('/api/reports/summary'),

  // Users, Roles & Permissions
  getUsers: () => fetchApi<{ success: boolean; users: User[] }>('/api/users'),
  createUser: (data: Partial<User>) => fetchApi<{ success: boolean; user: User }>('/api/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<User>) => fetchApi<{ success: boolean; user: User }>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id: string) => fetchApi<{ success: boolean; message: string }>(`/api/users/${id}`, { method: 'DELETE' }),
  resetUserPassword: (id: string) => fetchApi<{ success: boolean; message: string }>(`/api/users/${id}/reset-password`, { method: 'POST' }),

  getRoles: () => fetchApi<{ success: boolean; roles: any[] }>('/api/roles'),
  createRole: (data: any) => fetchApi<{ success: boolean; role: any }>('/api/roles', { method: 'POST', body: JSON.stringify(data) }),
  updateRole: (id: string, data: any) => fetchApi<{ success: boolean; role: any }>(`/api/roles/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRole: (id: string) => fetchApi<{ success: boolean; message: string }>(`/api/roles/${id}`, { method: 'DELETE' }),

  // Notifications
  getNotifications: () => fetchApi<{ success: boolean; notifications: any[] }>('/api/notifications'),
  markNotificationRead: (id: string) => fetchApi<{ success: boolean }>(`/api/notifications/${id}/read`, { method: 'PUT' }),
  markAllNotificationsRead: () => fetchApi<{ success: boolean; message: string }>('/api/notifications/read-all', { method: 'PUT' }),
  deleteNotification: (id: string) => fetchApi<{ success: boolean }>(`/api/notifications/${id}`, { method: 'DELETE' }),
  createNotification: (data: any) => fetchApi<{ success: boolean; notification: any }>('/api/notifications', { method: 'POST', body: JSON.stringify(data) }),

  // Settings & System
  getSettings: () => fetchApi<{ success: boolean; settings: MohallaSettings }>('/api/settings'),
  updateSettings: (data: Partial<MohallaSettings>) => fetchApi<{ success: boolean; settings: MohallaSettings }>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  getAuditLogs: () => fetchApi<{ success: boolean; auditLogs: AuditLog[] }>('/api/audit-logs'),
  logAction: (action: AuditLog['action'], module: string, description: string) =>
    fetchApi<{ success: boolean }>('/api/audit-logs/log-action', { method: 'POST', body: JSON.stringify({ action, module, description }) }),

  getLoginHistory: () => fetchApi<{ success: boolean; loginHistory: any[] }>('/api/system/login-history'),
  getSystemHealth: () => fetchApi<{ success: boolean; health: any }>('/api/system/health'),

  // Backup & Restore
  getBackupHistory: () => fetchApi<{ success: boolean; backups: any[] }>('/api/system/backups'),
  generateBackup: (type: 'MANUAL' | 'SCHEDULED' = 'MANUAL') => fetchApi<{ success: boolean; backupRecord: any; backupPayload: any; message: string }>('/api/system/backup', { method: 'POST', body: JSON.stringify({ type }) }),
  getBackup: () => fetchApi<{ success: boolean; backup: any }>('/api/system/backup', { method: 'POST' }),
  restoreBackup: (backup: any) => fetchApi<{ success: boolean; message: string }>('/api/system/restore', { method: 'POST', body: JSON.stringify({ backup }) }),
  deleteBackupHistoryItem: (id: string) => fetchApi<{ success: boolean }>(`/api/system/backups/${id}`, { method: 'DELETE' }),

  // Global Search
  globalSearch: (query: string) => fetchApi<{ success: boolean; results: any[] }>(`/api/search?q=${encodeURIComponent(query)}`),
};
