export type UserRole = 'Administrator' | 'Treasurer' | 'Collector' | 'Viewer' | string;

export type UserStatus = 'Active' | 'Inactive' | 'Suspended';

export interface UserPermission {
  module: 'Dashboard' | 'House Management' | 'Collections' | 'Expenses' | 'Ledger' | 'Reports' | 'Staff' | 'Attendance' | 'Salary' | 'Users' | 'Settings' | 'Audit Logs' | 'Backup' | string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  print: boolean;
  export: boolean;
}

export interface CustomRole {
  id: string;
  name: string;
  description: string;
  permissions: UserPermission[];
  isSystem?: boolean;
  createdAt?: string;
}

export interface LoginHistoryRecord {
  id: string;
  userId: string;
  userName: string;
  loginTime: string;
  logoutTime?: string;
  ipAddress: string;
  browser: string;
  os: string;
  location?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  username?: string;
  role: UserRole;
  status?: UserStatus;
  active: boolean;
  phone?: string;
  avatar?: string;
  createdAt: string;
  updatedAt?: string;
  lastLogin?: string;
  permissions?: UserPermission[];
  loginHistory?: LoginHistoryRecord[];
}

export type HouseStatus = 'Active' | 'Rented' | 'Closed' | 'Good Standing' | 'Warning' | 'Defaulter' | 'Vacant' | 'Exempted';
export type HouseCategory = 'Residential Standard' | 'Residential Large' | 'Commercial Shop' | 'Plaza / Office';

export interface House {
  id: string;
  houseNo: string; // e.g. "MS-A-101"
  street: string; // e.g. "Street 1", "Main Boulevard"
  sector: string; // e.g. "Sector A", "Sector B"
  category: HouseCategory;
  residentType: 'Owner' | 'Tenant';
  headName: string;
  cnic?: string;
  phone: string;
  whatsapp?: string;
  familyMembers: number;
  monthlyFee: number;
  status: HouseStatus;
  currentDues: number;
  joinedDate: string;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
  notes?: string;
  lastPaymentDate?: string;
  lastReceiptNo?: string;
}

export type PaymentMethod = 'Cash' | 'Bank' | 'JazzCash' | 'EasyPaisa' | 'Online Transfer' | 'Cheque' | 'Mobile Wallet';

export interface Collection {
  id: string;
  receiptNo: string;
  houseId: string;
  houseNo: string;
  headName: string;
  sector: string;
  street: string;
  month: string; // e.g. "August" or "August 2026"
  year?: number; // e.g. 2026
  amount: number;
  lateFee: number;
  totalPaid: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  collectorId: string;
  collectorName: string;
  notes?: string;
  remarks?: string;
  status?: 'Paid' | 'Cancelled';
  cancelledBy?: string;
  cancelledReason?: string;
  cancelledAt?: string;
  createdAt: string;
}

export type ExpenseCategory = string;

export interface ExpenseCategoryItem {
  id: string;
  name: string;
  description?: string;
  isDefault?: boolean;
  createdAt?: string;
}

export type ExpenseStatus = 'Pending' | 'Approved' | 'Rejected';

export interface Expense {
  id: string;
  voucherNo: string;
  title: string;
  category: string;
  amount: number;
  date: string;
  paidTo: string;
  paymentMethod: PaymentMethod;
  referenceNo?: string;
  receiptAttachmentUrl?: string;
  createdBy: string;
  approvedBy?: string;
  status: ExpenseStatus;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export type StaffRole = string;

export interface StaffDesignation {
  id: string;
  title: string;
  description?: string;
  isDefault?: boolean;
}

export interface Staff {
  id: string;
  empNo: string; // Auto-generated Employee ID e.g. EMP-001
  name: string;
  fatherName?: string;
  cnic: string;
  phone: string;
  emergencyContact?: string;
  address: string;
  role: string; // Designation
  joiningDate: string;
  monthlySalary: number;
  status: 'Active' | 'Inactive' | 'On Leave' | 'Resigned';
  notes?: string;
  photoUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryPayment {
  id: string;
  slipNo: string; // SLIP-YYYY-MM-XXX
  staffId: string;
  staffName: string;
  staffRole: string;
  month: string; // e.g., "August 2026"
  year?: number;
  baseSalary: number;
  allowance?: number;
  bonus: number;
  deductions: number;
  netPaid: number;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  notes?: string;
  paidBy?: string;
}

export type AttendanceStatus = 'Present' | 'Absent' | 'Leave' | 'Half Day' | 'Late';

export interface AttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  staffId: string;
  staffName: string;
  status: AttendanceStatus;
  checkIn?: string;
  notes?: string;
}

export interface EmployeeProfileData {
  staff: Staff;
  attendanceStats: {
    totalDays: number;
    presentDays: number;
    absentDays: number;
    leaveDays: number;
    halfDays: number;
    attendancePercentage: number;
  };
  attendanceHistory: AttendanceRecord[];
  salaryHistory: SalaryPayment[];
  totalSalariesPaid: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  referenceNo: string;
  referenceType?: 'COLLECTION' | 'EXPENSE' | 'SALARY' | 'ADJUSTMENT';
  type: 'INCOME' | 'EXPENSE';
  accountHead: string;
  description: string;
  debit: number; // Outflow / Expense
  credit: number; // Inflow / Income
  runningBalance: number;
  performedBy: string;
}

export interface FinancialSummaryData {
  totalIncome: number;
  totalExpenses: number;
  currentBalance: number;
  todayIncome: number;
  todayExpenses: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  yearlyIncome: number;
  yearlyExpenses: number;
  expenseByCategory: Array<{ category: string; amount: number; percentage: number }>;
  monthlyTrends: Array<{ month: string; income: number; expense: number }>;
  topCategories: Array<{ category: string; amount: number }>;
}

export interface MohallaSettings {
  mohallaName: string;
  registrationNo: string;
  address: string;
  phone: string;
  email: string;
  currencySymbol: string;
  defaultMonthlyFee: number;
  lateFeeAmount: number;
  dueDayOfMonth: number; // e.g. 10th of every month
  presidentName: string;
  treasurerName: string;
  receiptHeader: string;
  receiptFooter: string;
  showBismillah: boolean;
  enableSmsAlerts: boolean;
  timeZone?: string;
  language?: string;
  receiptLogoUrl?: string;
  signatureAreaText?: string;
  receiptLayout?: 'A4' | 'Thermal' | 'Both';
  thermalWidthMm?: number;
  autoBackupEnabled?: boolean;
  autoBackupFrequency?: 'Daily' | 'Weekly' | 'Monthly';
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: 'COLLECTION' | 'EXPENSE' | 'SALARY' | 'BACKUP' | 'SYSTEM_ERROR' | 'LOW_BALANCE' | 'DEFAULTER_ALERT';
  read: boolean;
  createdAt: string;
  link?: string;
}

export interface BackupHistoryItem {
  id: string;
  filename: string;
  sizeBytes: number;
  createdAt: string;
  createdBy: string;
  type: 'MANUAL' | 'SCHEDULED';
  status: 'COMPLETED' | 'FAILED';
}

export interface SystemHealthData {
  dbStatus: 'Healthy' | 'Degraded' | 'Offline';
  totalUsers: number;
  totalHouses: number;
  totalCollections: number;
  totalExpenses: number;
  totalLogs: number;
  diskUsageKb: number;
  lastBackupTime?: string;
  appVersion: string;
  nodeVersion: string;
  serverTime: string;
  uptimeSeconds: number;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'BULK_ACTION' | 'SETTINGS_CHANGE' | 'PRINT' | 'EXPORT' | 'VIEW' | 'BACKUP' | 'RESTORE' | 'PERMISSION_CHANGE' | 'USER_CHANGE' | string;
  module: string;
  description: string;
  ipAddress: string;
}

export interface DashboardStats {
  totalHouses: number;
  activeHouses: number;
  totalCollectedThisMonth: number;
  totalExpensesThisMonth: number;
  netMonthlyBalance: number;
  outstandingDuesTotal: number;
  collectionRatePercentage: number;
  totalActiveStaff: number;
  defaulterCount: number;
  warningCount: number;
  goodStandingCount: number;
}

export interface HouseTimelineEvent {
  id: string;
  type: 'CREATED' | 'PAYMENT' | 'STATUS_CHANGE' | 'FEE_UPDATE' | 'NOTES_UPDATE';
  title: string;
  description: string;
  timestamp: string;
  performedBy: string;
  metadata?: any;
}

export interface HouseFinancialSummary {
  totalPaidAmount: number;
  totalExpectedAmount: number;
  outstandingAmount: number;
  paidMonthsCount: number;
  pendingMonthsCount: number;
  paidMonthsList: string[];
  pendingMonthsList: string[];
  collectionPercentage: number;
  lastPaymentDate?: string;
  lastReceiptNo?: string;
  statusClassification: 'Good Standing' | 'Warning' | 'Defaulter' | 'Vacant' | 'Exempted';
}

export interface HouseProfileData {
  house: House;
  financialSummary: HouseFinancialSummary;
  paymentHistory: Collection[];
  timeline: HouseTimelineEvent[];
}

export interface DefaulterReportItem {
  houseId: string;
  houseNo: string;
  street: string;
  sector: string;
  headName: string;
  phone: string;
  whatsapp?: string;
  monthlyFee: number;
  status: HouseStatus;
  currentDues: number;
  pendingMonthsCount: number;
  pendingMonthsList: string[];
  lastPaymentDate?: string;
  lastReceiptNo?: string;
}
