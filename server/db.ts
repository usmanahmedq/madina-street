import 'dotenv/config';
import fs from 'fs';
import { Pool } from 'pg';
import { RelationalStore, MIGRATION_ID, STORAGE_LOCK } from './relational-store';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import {
  User, CustomRole, SystemNotification, BackupHistoryItem, LoginHistoryRecord,
  House, Collection, Expense, Staff, StaffDesignation, SalaryPayment, AttendanceRecord,
  LedgerEntry, MohallaSettings, AuditLog
} from '../src/types/index';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'madina_street_db.json');

export const ALL_SYSTEM_MODULES = [
  'Dashboard',
  'House Management',
  'Collections',
  'Expenses',
  'Ledger',
  'Reports',
  'Staff',
  'Attendance',
  'Salary',
  'Users',
  'Settings',
  'Audit Logs',
  'Backup'
] as const;

export const defaultRoles: CustomRole[] = [
  {
    id: 'role-admin',
    name: 'Administrator',
    description: 'Full administrative access to all modules, financial operations, user management, and system settings.',
    isSystem: true,
    createdAt: '2025-01-01T00:00:00Z',
    permissions: ALL_SYSTEM_MODULES.map(m => ({
      module: m,
      view: true,
      create: true,
      edit: true,
      delete: true,
      print: true,
      export: true,
    })),
  },
  {
    id: 'role-treasurer',
    name: 'Treasurer',
    description: 'Manages collections, vouchers, payroll, accounting ledger, and financial reports.',
    isSystem: true,
    createdAt: '2025-01-01T00:00:00Z',
    permissions: ALL_SYSTEM_MODULES.map(m => ({
      module: m,
      view: true,
      create: ['Collections', 'Expenses', 'Salary', 'Attendance', 'Backup'].includes(m),
      edit: ['Collections', 'Expenses', 'Salary', 'Attendance', 'Settings'].includes(m),
      delete: ['Expenses'].includes(m),
      print: true,
      export: true,
    })),
  },
  {
    id: 'role-collector',
    name: 'Collector',
    description: 'Field officer with permissions to record resident monthly payments, issue receipts, and mark attendance.',
    isSystem: true,
    createdAt: '2025-01-01T00:00:00Z',
    permissions: ALL_SYSTEM_MODULES.map(m => ({
      module: m,
      view: ['Dashboard', 'House Management', 'Collections', 'Attendance'].includes(m),
      create: ['Collections', 'Attendance'].includes(m),
      edit: false,
      delete: false,
      print: ['Collections'].includes(m),
      export: ['Collections'].includes(m),
    })),
  },
  {
    id: 'role-viewer',
    name: 'Viewer',
    description: 'Read-only access for Mohalla welfare committee executive members and external auditors.',
    isSystem: true,
    createdAt: '2025-01-01T00:00:00Z',
    permissions: ALL_SYSTEM_MODULES.map(m => ({
      module: m,
      view: ['Dashboard', 'House Management', 'Collections', 'Expenses', 'Ledger', 'Reports', 'Staff', 'Attendance', 'Salary', 'Settings', 'Audit Logs'].includes(m),
      create: false,
      edit: false,
      delete: false,
      print: ['House Management', 'Collections', 'Expenses', 'Ledger', 'Reports', 'Audit Logs'].includes(m),
      export: ['House Management', 'Collections', 'Expenses', 'Ledger', 'Reports', 'Audit Logs'].includes(m),
    })),
  },
];

export const initialNotifications: SystemNotification[] = [
  {
    id: 'notif-1',
    title: 'New Monthly Collection',
    message: 'Chaudhry Abdul Rehman (MS-A-101) paid Rs. 1,500 for August 2026. Receipt # REC-202608-001.',
    type: 'COLLECTION',
    read: false,
    createdAt: '2026-08-07T04:15:00Z',
    link: '/collections',
  },
  {
    id: 'notif-2',
    title: 'Defaulter Alert: 4 Months Pending',
    message: 'House MS-B-205 (Sheikh Tariq Javed) has 4 unpaid months totaling Rs. 6,000. Recovery notice suggested.',
    type: 'DEFAULTER_ALERT',
    read: false,
    createdAt: '2026-08-07T03:30:00Z',
    link: '/defaulters',
  },
  {
    id: 'notif-3',
    title: 'Staff Salary Disbursed',
    message: 'July 2026 salary of Rs. 28,000 disbursed to Head Security Guard (Muhammad Akram). Slip # SAL-202608-01.',
    type: 'SALARY',
    read: true,
    createdAt: '2026-08-06T11:00:00Z',
    link: '/salaries',
  },
  {
    id: 'notif-4',
    title: 'Automated Database Backup Completed',
    message: 'System snapshot auto_backup_2026_08_05.json (482 KB) archived successfully.',
    type: 'BACKUP',
    read: true,
    createdAt: '2026-08-05T02:00:00Z',
    link: '/settings',
  },
  {
    id: 'notif-5',
    title: 'New Operational Expense Logged',
    message: 'Voucher # VCH-202608-03 recorded for Rs. 4,500 (Gate 2 barrier welding & repair).',
    type: 'EXPENSE',
    read: true,
    createdAt: '2026-08-05T14:30:00Z',
    link: '/expenses',
  },
];

export const initialBackupHistory: BackupHistoryItem[] = [
  {
    id: 'bak-1',
    filename: 'Madina_Street_Backup_2026_08_07_Manual.json',
    sizeBytes: 524288,
    createdAt: '2026-08-07T02:00:00Z',
    createdBy: 'Administrator',
    type: 'MANUAL',
    status: 'COMPLETED',
  },
  {
    id: 'bak-2',
    filename: 'Madina_Street_Backup_2026_08_01_Scheduled.json',
    sizeBytes: 512000,
    createdAt: '2026-08-01T00:00:00Z',
    createdBy: 'System Scheduler',
    type: 'SCHEDULED',
    status: 'COMPLETED',
  },
  {
    id: 'bak-3',
    filename: 'Madina_Street_Backup_2026_07_01_Scheduled.json',
    sizeBytes: 489000,
    createdAt: '2026-07-01T00:00:00Z',
    createdBy: 'System Scheduler',
    type: 'SCHEDULED',
    status: 'COMPLETED',
  },
];

export const initialLoginHistory: LoginHistoryRecord[] = [
  {
    id: 'lh-1',
    userId: 'u-1',
    userName: 'Administrator (Admin)',
    loginTime: '2026-08-07T04:30:00Z',
    logoutTime: undefined,
    ipAddress: '127.0.0.1',
    browser: 'Chrome 127.0 (Desktop)',
    os: 'Windows 11 / Linux',
    location: 'Lahore, Pakistan',
  },
  {
    id: 'lh-2',
    userId: 'u-2',
    userName: 'Syed Tariq Mahmood (Treasurer)',
    loginTime: '2026-08-06T15:20:00Z',
    logoutTime: '2026-08-06T16:45:00Z',
    ipAddress: '192.168.1.12',
    browser: 'Chrome 126.0 (Mobile)',
    os: 'Android 14',
    location: 'Lahore, Pakistan',
  },
  {
    id: 'lh-3',
    userId: 'u-3',
    userName: 'Muhammad Usman (Collector)',
    loginTime: '2026-08-07T02:10:00Z',
    logoutTime: '2026-08-07T03:50:00Z',
    ipAddress: '192.168.1.45',
    browser: 'Safari Mobile 17.5',
    os: 'iOS 17.5',
    location: 'Lahore, Pakistan',
  },
  {
    id: 'lh-4',
    userId: 'u-4',
    userName: 'Mohalla Auditor (Viewer)',
    loginTime: '2026-08-05T10:00:00Z',
    logoutTime: '2026-08-05T11:15:00Z',
    ipAddress: '192.168.1.88',
    browser: 'Firefox 128.0',
    os: 'macOS Sonoma',
    location: 'Lahore, Pakistan',
  },
];

export interface DatabaseSchema {
  users: User[];
  roles?: CustomRole[];
  notifications?: SystemNotification[];
  backupHistory?: BackupHistoryItem[];
  loginHistory?: LoginHistoryRecord[];
  houses: House[];
  collections: Collection[];
  expenses: Expense[];
  expenseCategories?: Array<{ id: string; name: string; description?: string; isDefault?: boolean }>;
  staff: Staff[];
  designations?: StaffDesignation[];
  salaries: SalaryPayment[];
  attendance: AttendanceRecord[];
  ledger: LedgerEntry[];
  settings: MohallaSettings;
  auditLogs: AuditLog[];
}

// Initial Realistic Seeding Data
const initialSettings: MohallaSettings = {
  mohallaName: 'Madina Street Welfare Society',
  registrationNo: 'REG/MSWS/2022/8841',
  address: 'Madina Street, Sector A & B, Model Town, Lahore',
  phone: '+92 300 1234567',
  email: 'info@madinastreet.org',
  currencySymbol: 'Rs.',
  defaultMonthlyFee: 1500,
  lateFeeAmount: 200,
  dueDayOfMonth: 10,
  presidentName: 'Haji Mohammad Ismail',
  treasurerName: 'Syed Tariq Mahmood',
  receiptHeader: 'Official Monthly Contribution Receipt',
  receiptFooter: 'Thank you for keeping our Mohalla safe, clean, and well-maintained.',
  showBismillah: true,
  enableSmsAlerts: true,
  timeZone: 'Asia/Karachi (PKT +05:00)',
  language: 'English / Urdu',
  receiptLogoUrl: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=120&auto=format&fit=crop&q=80',
  signatureAreaText: 'Authorized Signatory / Mohalla Welfare General Secretary',
  receiptLayout: 'Both',
  thermalWidthMm: 80,
  autoBackupEnabled: true,
  autoBackupFrequency: 'Daily',
};

const initialUsers: User[] = [
  {
    id: 'u-1',
    name: 'Administrator (Admin)',
    email: 'admin@madinastreet.org',
    username: 'admin',
    role: 'Administrator',
    status: 'Active',
    phone: '03001112233',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    active: true,
    createdAt: '2025-01-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
    lastLogin: '2026-08-07T04:30:00Z',
    permissions: defaultRoles[0].permissions,
  },
  {
    id: 'u-2',
    name: 'Syed Tariq Mahmood (Treasurer)',
    email: 'treasurer@madinastreet.org',
    username: 'treasurer',
    role: 'Treasurer',
    status: 'Active',
    phone: '03002223344',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    active: true,
    createdAt: '2025-01-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
    lastLogin: '2026-08-06T15:20:00Z',
    permissions: defaultRoles[1].permissions,
  },
  {
    id: 'u-3',
    name: 'Muhammad Usman (Collector)',
    email: 'collector@madinastreet.org',
    username: 'collector',
    role: 'Collector',
    status: 'Active',
    phone: '03003334455',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    active: true,
    createdAt: '2025-01-05T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
    lastLogin: '2026-08-07T02:10:00Z',
    permissions: defaultRoles[2].permissions,
  },
  {
    id: 'u-4',
    name: 'Mohalla Auditor (Viewer)',
    email: 'viewer@madinastreet.org',
    username: 'viewer',
    role: 'Viewer',
    status: 'Active',
    phone: '03004445566',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80',
    active: true,
    createdAt: '2025-02-01T08:00:00Z',
    updatedAt: '2026-08-01T08:00:00Z',
    lastLogin: '2026-08-05T10:00:00Z',
    permissions: defaultRoles[3].permissions,
  },
];

const initialHouses: House[] = [
  {
    id: 'h-101',
    houseNo: 'MS-A-101',
    street: 'Street 1',
    sector: 'Sector A',
    category: 'Residential Standard',
    residentType: 'Owner',
    headName: 'Chaudhry Abdul Rehman',
    cnic: '35202-1234567-1',
    phone: '0300-1234501',
    familyMembers: 6,
    monthlyFee: 1500,
    status: 'Active',
    currentDues: 0,
    joinedDate: '2024-01-10',
    notes: 'Corner house near Main Gate 1',
  },
  {
    id: 'h-102',
    houseNo: 'MS-A-102',
    street: 'Street 1',
    sector: 'Sector A',
    category: 'Residential Standard',
    residentType: 'Owner',
    headName: 'Dr. Zafar Iqbal',
    cnic: '35202-2345678-2',
    phone: '0300-1234502',
    familyMembers: 4,
    monthlyFee: 1500,
    status: 'Active',
    currentDues: 0,
    joinedDate: '2024-01-12',
  },
  {
    id: 'h-103',
    houseNo: 'MS-A-103',
    street: 'Street 1',
    sector: 'Sector A',
    category: 'Residential Large',
    residentType: 'Owner',
    headName: 'Malik Mohammad Rashid',
    cnic: '35202-3456789-3',
    phone: '0300-1234503',
    familyMembers: 8,
    monthlyFee: 2000,
    status: 'Defaulter',
    currentDues: 4000,
    joinedDate: '2024-01-15',
    notes: 'Dues pending for past 2 months',
  },
  {
    id: 'h-104',
    houseNo: 'MS-A-104',
    street: 'Street 1',
    sector: 'Sector A',
    category: 'Residential Standard',
    residentType: 'Tenant',
    headName: 'Engr. Bilal Ahmed',
    cnic: '35202-4567890-4',
    phone: '0300-1234504',
    familyMembers: 3,
    monthlyFee: 1500,
    status: 'Active',
    currentDues: 0,
    joinedDate: '2024-02-01',
  },
  {
    id: 'h-105',
    houseNo: 'MS-A-105',
    street: 'Street 2',
    sector: 'Sector A',
    category: 'Residential Standard',
    residentType: 'Owner',
    headName: 'Sheikh Waqar Ali',
    cnic: '35202-5678901-5',
    phone: '0300-1234505',
    familyMembers: 5,
    monthlyFee: 1500,
    status: 'Active',
    currentDues: 0,
    joinedDate: '2024-02-10',
  },
  {
    id: 'h-106',
    houseNo: 'MS-A-106',
    street: 'Street 2',
    sector: 'Sector A',
    category: 'Residential Standard',
    residentType: 'Owner',
    headName: 'Hafiz Kamran Saeed',
    cnic: '35202-6789012-6',
    phone: '0300-1234506',
    familyMembers: 5,
    monthlyFee: 1500,
    status: 'Exempted',
    currentDues: 0,
    joinedDate: '2024-02-12',
    notes: 'Exempted by Committee decision (Imam Sahib)',
  },
  {
    id: 'h-107',
    houseNo: 'MS-A-107',
    street: 'Street 2',
    sector: 'Sector A',
    category: 'Residential Large',
    residentType: 'Tenant',
    headName: 'Rana Asif Khan',
    cnic: '35202-7890123-7',
    phone: '0300-1234507',
    familyMembers: 6,
    monthlyFee: 2000,
    status: 'Active',
    currentDues: 2000,
    joinedDate: '2024-03-01',
  },
  {
    id: 'h-201',
    houseNo: 'MS-B-201',
    street: 'Street 3',
    sector: 'Sector B',
    category: 'Residential Standard',
    residentType: 'Owner',
    headName: 'Prof. Noman Raza',
    cnic: '35202-8901234-8',
    phone: '0300-1234508',
    familyMembers: 4,
    monthlyFee: 1500,
    status: 'Active',
    currentDues: 0,
    joinedDate: '2024-03-15',
  },
  {
    id: 'h-202',
    houseNo: 'MS-B-202',
    street: 'Street 3',
    sector: 'Sector B',
    category: 'Residential Standard',
    residentType: 'Owner',
    headName: 'Syed Hamza Shah',
    cnic: '35202-9012345-9',
    phone: '0300-1234509',
    familyMembers: 5,
    monthlyFee: 1500,
    status: 'Vacant',
    currentDues: 0,
    joinedDate: '2024-03-20',
    notes: 'House currently under renovation',
  },
  {
    id: 'h-203',
    houseNo: 'MS-C-101',
    street: 'Commercial Market',
    sector: 'Commercial Lane',
    category: 'Commercial Shop',
    residentType: 'Tenant',
    headName: 'Madina General Store (Tariq)',
    cnic: '35202-0123456-0',
    phone: '0300-1234510',
    familyMembers: 1,
    monthlyFee: 2500,
    status: 'Active',
    currentDues: 0,
    joinedDate: '2024-01-01',
  },
  {
    id: 'h-204',
    houseNo: 'MS-C-102',
    street: 'Commercial Market',
    sector: 'Commercial Lane',
    category: 'Commercial Shop',
    residentType: 'Tenant',
    headName: 'Al-Madina Milk & Bakery',
    cnic: '35202-1122334-5',
    phone: '0300-1234511',
    familyMembers: 1,
    monthlyFee: 2500,
    status: 'Active',
    currentDues: 0,
    joinedDate: '2024-01-01',
  },
  {
    id: 'h-205',
    houseNo: 'MS-B-205',
    street: 'Street 4',
    sector: 'Sector B',
    category: 'Plaza / Office',
    residentType: 'Owner',
    headName: 'Madina Dental Clinic',
    cnic: '35202-9988776-1',
    phone: '0300-1234512',
    familyMembers: 2,
    monthlyFee: 3000,
    status: 'Active',
    currentDues: 0,
    joinedDate: '2024-02-01',
  }
];

const initialCollections: Collection[] = [
  {
    id: 'col-1001',
    receiptNo: 'REC-202608-001',
    houseId: 'h-101',
    houseNo: 'MS-A-101',
    headName: 'Chaudhry Abdul Rehman',
    sector: 'Sector A',
    street: 'Street 1',
    month: 'August 2026',
    amount: 1500,
    lateFee: 0,
    totalPaid: 1500,
    paymentDate: '2026-08-02',
    paymentMethod: 'Cash',
    collectorId: 'u-3',
    collectorName: 'Muhammad Usman (Collector)',
    notes: 'Paid early before due date',
    createdAt: '2026-08-02T10:15:00Z',
  },
  {
    id: 'col-1002',
    receiptNo: 'REC-202608-002',
    houseId: 'h-102',
    houseNo: 'MS-A-102',
    headName: 'Dr. Zafar Iqbal',
    sector: 'Sector A',
    street: 'Street 1',
    month: 'August 2026',
    amount: 1500,
    lateFee: 0,
    totalPaid: 1500,
    paymentDate: '2026-08-03',
    paymentMethod: 'Online Transfer',
    referenceNo: 'TXN-99882211',
    collectorId: 'u-2',
    collectorName: 'Syed Tariq Mahmood (Treasurer)',
    notes: 'Direct bank transfer',
    createdAt: '2026-08-03T11:20:00Z',
  },
  {
    id: 'col-1003',
    receiptNo: 'REC-202608-003',
    houseId: 'h-105',
    houseNo: 'MS-A-105',
    headName: 'Sheikh Waqar Ali',
    sector: 'Sector A',
    street: 'Street 2',
    month: 'August 2026',
    amount: 1500,
    lateFee: 0,
    totalPaid: 1500,
    paymentDate: '2026-08-04',
    paymentMethod: 'Mobile Wallet',
    referenceNo: 'EP-4455221',
    collectorId: 'u-3',
    collectorName: 'Muhammad Usman (Collector)',
    createdAt: '2026-08-04T14:00:00Z',
  },
  {
    id: 'col-1004',
    receiptNo: 'REC-202608-004',
    houseId: 'h-203',
    houseNo: 'MS-C-101',
    headName: 'Madina General Store (Tariq)',
    sector: 'Commercial Lane',
    street: 'Commercial Market',
    month: 'August 2026',
    amount: 2500,
    lateFee: 0,
    totalPaid: 2500,
    paymentDate: '2026-08-05',
    paymentMethod: 'Cash',
    collectorId: 'u-3',
    collectorName: 'Muhammad Usman (Collector)',
    createdAt: '2026-08-05T09:30:00Z',
  },
  {
    id: 'col-1005',
    receiptNo: 'REC-202608-005',
    houseId: 'h-204',
    houseNo: 'MS-C-102',
    headName: 'Al-Madina Milk & Bakery',
    sector: 'Commercial Lane',
    street: 'Commercial Market',
    month: 'August 2026',
    amount: 2500,
    lateFee: 0,
    totalPaid: 2500,
    paymentDate: '2026-08-05',
    paymentMethod: 'Cash',
    collectorId: 'u-3',
    collectorName: 'Muhammad Usman (Collector)',
    createdAt: '2026-08-05T10:00:00Z',
  },
  {
    id: 'col-0901',
    receiptNo: 'REC-202607-088',
    houseId: 'h-101',
    houseNo: 'MS-A-101',
    headName: 'Chaudhry Abdul Rehman',
    sector: 'Sector A',
    street: 'Street 1',
    month: 'July 2026',
    amount: 1500,
    lateFee: 0,
    totalPaid: 1500,
    paymentDate: '2026-07-05',
    paymentMethod: 'Cash',
    collectorId: 'u-3',
    collectorName: 'Muhammad Usman (Collector)',
    createdAt: '2026-07-05T10:00:00Z',
  },
  {
    id: 'col-0902',
    receiptNo: 'REC-202607-089',
    houseId: 'h-102',
    houseNo: 'MS-A-102',
    headName: 'Dr. Zafar Iqbal',
    sector: 'Sector A',
    street: 'Street 1',
    month: 'July 2026',
    amount: 1500,
    lateFee: 0,
    totalPaid: 1500,
    paymentDate: '2026-07-08',
    paymentMethod: 'Online Transfer',
    collectorId: 'u-2',
    collectorName: 'Syed Tariq Mahmood (Treasurer)',
    createdAt: '2026-07-08T11:00:00Z',
  }
];

const initialExpenses: Expense[] = [
  {
    id: 'exp-101',
    voucherNo: 'VCH-202608-01',
    title: 'Replacement of Street Lights LED (Street 1 & 2)',
    category: 'Street Lighting',
    amount: 8500,
    date: '2026-08-01',
    paidTo: 'Al-Rehman Electric Store',
    paymentMethod: 'Cash',
    createdBy: 'Syed Tariq Mahmood',
    approvedBy: 'Syed Tariq Mahmood (Treasurer)',
    status: 'Approved',
    notes: 'Purchased 10 high lumen LED street lights and heavy duty wire.',
    createdAt: '2026-08-01T12:00:00Z',
  },
  {
    id: 'exp-102',
    voucherNo: 'VCH-202608-02',
    title: 'Weekly Garbage Dumping & Disposal Van Charges',
    category: 'Sanitation & Waste',
    amount: 12000,
    date: '2026-08-03',
    paidTo: 'Model Town Waste Management Crew',
    paymentMethod: 'Cash',
    createdBy: 'Haji Mohammad Ismail',
    approvedBy: 'Haji Mohammad Ismail (President)',
    status: 'Approved',
    notes: 'Payment for weekly waste truck clearance.',
    createdAt: '2026-08-03T16:00:00Z',
  },
  {
    id: 'exp-103',
    voucherNo: 'VCH-202608-03',
    title: 'Repair of Security Barrier Gate at Gate 2',
    category: 'Security Staff',
    amount: 4500,
    date: '2026-08-05',
    paidTo: 'Ustad Tariq Welding Shop',
    paymentMethod: 'Cash',
    createdBy: 'Syed Tariq Mahmood',
    approvedBy: 'Syed Tariq Mahmood (Treasurer)',
    status: 'Approved',
    notes: 'Fixed broken gate latch and installed new security chain.',
    createdAt: '2026-08-05T14:30:00Z',
  },
  {
    id: 'exp-104',
    voucherNo: 'VCH-202607-45',
    title: 'Mosque Carpet Cleaning & Air Conditioning Repair',
    category: 'Mosque Contribution',
    amount: 15000,
    date: '2026-07-25',
    paidTo: 'Super Clean HVAC Services',
    paymentMethod: 'Online Transfer',
    createdBy: 'Syed Tariq Mahmood',
    approvedBy: 'Syed Tariq Mahmood (Treasurer)',
    status: 'Approved',
    createdAt: '2026-07-25T11:00:00Z',
  }
];

const initialStaff: Staff[] = [
  {
    id: 'st-1',
    empNo: 'EMP-001',
    name: 'Subedar (R) Muhammad Aslam',
    fatherName: 'Chaudhry Ghulam Muhammad',
    role: 'Security Guard',
    phone: '0301-8881122',
    cnic: '35201-9988776-3',
    emergencyContact: '0300-4445566 (Son)',
    address: 'Quarter # 1, Gate 1, Madina Street',
    joiningDate: '2023-01-15',
    monthlySalary: 32000,
    status: 'Active',
    notes: 'Head Security Guard - Day Shift',
    createdAt: '2023-01-15T10:00:00Z',
  },
  {
    id: 'st-2',
    empNo: 'EMP-002',
    name: 'Tariq Mehmood Guard',
    fatherName: 'Mehmood Khan',
    role: 'Security Guard',
    phone: '0302-7772233',
    cnic: '35201-8877665-1',
    emergencyContact: '0321-9988771 (Brother)',
    address: 'Quarter # 2, Gate 2, Madina Street',
    joiningDate: '2023-06-01',
    monthlySalary: 30000,
    status: 'Active',
    notes: 'Night Shift Guard',
    createdAt: '2023-06-01T10:00:00Z',
  },
  {
    id: 'st-3',
    empNo: 'EMP-003',
    name: 'Babu Lal Sanitary',
    fatherName: 'Kishan Lal',
    role: 'Sweeper',
    phone: '0303-6663344',
    cnic: '35201-7766554-9',
    emergencyContact: '0303-1122334',
    address: 'Basti Colony, Lahore',
    joiningDate: '2023-03-10',
    monthlySalary: 25000,
    status: 'Active',
    notes: 'Daily morning street cleaning & garbage pickup',
    createdAt: '2023-03-10T10:00:00Z',
  },
  {
    id: 'st-4',
    empNo: 'EMP-004',
    name: 'Muhammad Yasin Electrician',
    fatherName: 'Abdul Rehman',
    role: 'Electrician',
    phone: '0304-5554455',
    cnic: '35201-6655443-7',
    emergencyContact: '0345-8877661',
    address: 'Street 4, Sector B',
    joiningDate: '2024-01-01',
    monthlySalary: 28000,
    status: 'Active',
    notes: 'Part-time electrician & water motor operator',
    createdAt: '2024-01-01T10:00:00Z',
  }
];

const initialSalaries: SalaryPayment[] = [
  {
    id: 'sal-101',
    slipNo: 'SLIP-202607-01',
    staffId: 'st-1',
    staffName: 'Subedar (R) Muhammad Aslam',
    staffRole: 'Security Guard',
    month: 'July 2026',
    baseSalary: 32000,
    bonus: 1000,
    deductions: 0,
    netPaid: 33000,
    paymentDate: '2026-08-01',
    paymentMethod: 'Cash',
    notes: 'Includes Eid Mubarak bonus',
  },
  {
    id: 'sal-102',
    slipNo: 'SLIP-202607-02',
    staffId: 'st-2',
    staffName: 'Tariq Mehmood Guard',
    staffRole: 'Security Guard',
    month: 'July 2026',
    baseSalary: 30000,
    bonus: 0,
    deductions: 500,
    netPaid: 29500,
    paymentDate: '2026-08-01',
    paymentMethod: 'Cash',
    notes: 'Deduction for 1 day unauthorized absence',
  },
  {
    id: 'sal-103',
    slipNo: 'SLIP-202607-03',
    staffId: 'st-3',
    staffName: 'Babu Lal Sanitary',
    staffRole: 'Waste Collector',
    month: 'July 2026',
    baseSalary: 25000,
    bonus: 500,
    deductions: 0,
    netPaid: 25500,
    paymentDate: '2026-08-01',
    paymentMethod: 'Cash',
  }
];

const initialAttendance: AttendanceRecord[] = [
  {
    id: 'att-20260807-1',
    date: '2026-08-07',
    staffId: 'st-1',
    staffName: 'Subedar (R) Muhammad Aslam',
    status: 'Present',
    checkIn: '07:00 AM',
  },
  {
    id: 'att-20260807-2',
    date: '2026-08-07',
    staffId: 'st-2',
    staffName: 'Tariq Mehmood Guard',
    status: 'Present',
    checkIn: '07:00 PM',
  },
  {
    id: 'att-20260807-3',
    date: '2026-08-07',
    staffId: 'st-3',
    staffName: 'Babu Lal Sanitary',
    status: 'Present',
    checkIn: '06:30 AM',
  },
  {
    id: 'att-20260807-4',
    date: '2026-08-07',
    staffId: 'st-4',
    staffName: 'Muhammad Yasin Electrician',
    status: 'Present',
    checkIn: '09:00 AM',
  },
  {
    id: 'att-20260806-1',
    date: '2026-08-06',
    staffId: 'st-1',
    staffName: 'Subedar (R) Muhammad Aslam',
    status: 'Present',
    checkIn: '07:00 AM',
  },
  {
    id: 'att-20260806-2',
    date: '2026-08-06',
    staffId: 'st-2',
    staffName: 'Tariq Mehmood Guard',
    status: 'Late',
    checkIn: '07:45 PM',
    notes: 'Traffic delay on ring road',
  }
];

const initialLedger: LedgerEntry[] = [
  {
    id: 'led-1',
    date: '2026-08-01',
    referenceNo: 'SYS-INIT-01',
    type: 'INCOME',
    accountHead: 'Opening Balance',
    description: 'Opening Cash & Bank Balance brought forward for August 2026',
    debit: 145000,
    credit: 0,
    runningBalance: 145000,
    performedBy: 'System Admin',
  },
  {
    id: 'led-2',
    date: '2026-08-01',
    referenceNo: 'VCH-202608-01',
    type: 'EXPENSE',
    accountHead: 'Street Lighting Expense',
    description: 'Replacement of Street Lights LED (Street 1 & 2)',
    debit: 0,
    credit: 8500,
    runningBalance: 136500,
    performedBy: 'Syed Tariq Mahmood',
  },
  {
    id: 'led-3',
    date: '2026-08-02',
    referenceNo: 'REC-202608-001',
    type: 'INCOME',
    accountHead: 'Monthly House Collections',
    description: 'Contribution received from House MS-A-101 (Chaudhry Abdul Rehman)',
    debit: 1500,
    credit: 0,
    runningBalance: 138000,
    performedBy: 'Muhammad Usman',
  },
  {
    id: 'led-4',
    date: '2026-08-03',
    referenceNo: 'REC-202608-002',
    type: 'INCOME',
    accountHead: 'Monthly House Collections',
    description: 'Contribution received from House MS-A-102 (Dr. Zafar Iqbal)',
    debit: 1500,
    credit: 0,
    runningBalance: 139500,
    performedBy: 'Syed Tariq Mahmood',
  },
  {
    id: 'led-5',
    date: '2026-08-03',
    referenceNo: 'VCH-202608-02',
    type: 'EXPENSE',
    accountHead: 'Sanitation & Waste Expense',
    description: 'Weekly Garbage Dumping & Disposal Van Charges',
    debit: 0,
    credit: 12000,
    runningBalance: 127500,
    performedBy: 'Syed Tariq Mahmood',
  },
  {
    id: 'led-6',
    date: '2026-08-05',
    referenceNo: 'VCH-202608-03',
    type: 'EXPENSE',
    accountHead: 'Security Maintenance Expense',
    description: 'Repair of Security Barrier Gate at Gate 2',
    debit: 0,
    credit: 4500,
    runningBalance: 123000,
    performedBy: 'Syed Tariq Mahmood',
  }
];

const initialAuditLogs: AuditLog[] = [
  {
    id: 'log-101',
    timestamp: '2026-08-07T04:30:00Z',
    userId: 'u-1',
    userName: 'Administrator',
    userRole: 'Administrator',
    action: 'LOGIN',
    module: 'Authentication',
    description: 'Successful administrator portal login',
    ipAddress: '127.0.0.1',
  },
  {
    id: 'log-102',
    timestamp: '2026-08-05T10:00:00Z',
    userId: 'u-3',
    userName: 'Muhammad Usman',
    userRole: 'Collector',
    action: 'CREATE',
    module: 'Monthly Collection',
    description: 'Recorded payment of Rs. 2,500 for House MS-C-102 (Receipt # REC-202608-005)',
    ipAddress: '192.168.1.45',
  },
  {
    id: 'log-103',
    timestamp: '2026-08-05T14:30:00Z',
    userId: 'u-2',
    userName: 'Syed Tariq Mahmood',
    userRole: 'Treasurer',
    action: 'CREATE',
    module: 'Expense Management',
    description: 'Added expense of Rs. 4,500 for Gate 2 barrier repair (Voucher # VCH-202608-03)',
    ipAddress: '192.168.1.12',
  }
];

class Database {
  private localData!: DatabaseSchema;
  private context = new AsyncLocalStorage<{ data: DatabaseSchema; dirty: boolean }>();
  private pool = process.env.DATABASE_URL ? new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 15000, enableChannelBinding: true }) : undefined;
  private relational = new RelationalStore();

  private get data(): DatabaseSchema { return this.context.getStore()?.data ?? this.localData; }
  private set data(value: DatabaseSchema) { this.localData = value; }

  constructor() {
    if (!this.pool) {
      this.ensureDirectory();
      this.data = this.loadData();
    }
  }

  public async initialize() {
    if (!this.pool) return;
    this.pool.on('error', () => console.error('Unexpected idle PostgreSQL connection error'));
    const client = await this.pool.connect();
    try {
      const migration = await client.query('SELECT id FROM public.app_schema_migrations WHERE id = $1', [MIGRATION_ID]);
      if (!migration.rowCount) throw new Error('Run npm run db:migrate before starting the server.');
      await this.relational.initialize(client);
    } finally { client.release(); }
    console.log('PostgreSQL connected: 16 relational tables active');
  }

  public async close() {
    await this.pool?.end();
  }

  // Writes are serialized across servers. Reads use a consistent, read-only snapshot.
  public middleware = async (_req: Request, res: Response, next: NextFunction) => {
    if (!this.pool) return next();
    let client;
    try {
      client = await this.pool.connect();
      const readOnly = ['GET', 'HEAD'].includes(_req.method);
      await client.query(`${readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN'};
        SET LOCAL lock_timeout = '15s'; SET LOCAL statement_timeout = '30s'`);
      if (!readOnly) await client.query('SELECT pg_advisory_xact_lock($1)', [STORAGE_LOCK]);
      const data = await this.relational.load(client);
      if (res.destroyed) {
        await client.query('ROLLBACK');
        client.release();
        return;
      }
      const previous = structuredClone(data);
      const state = { data, dirty: false };
      const end = res.end.bind(res);
      let ended = false;
      res.end = ((...args: any[]) => {
        if (ended) return res;
        ended = true;
        void (async () => {
          try {
            if (res.statusCode < 400) {
              if (state.dirty) await this.relational.persist(client!, state.data, previous);
              await client!.query('COMMIT');
            } else {
              await client!.query('ROLLBACK');
            }
            (end as any)(...args);
          } catch (error: any) {
            await client!.query('ROLLBACK').catch(() => {});
            console.error('Database transaction failed:', error.code || error.name);
            res.statusCode = ['23001', '23505', '23503', '23514', '23502', '22P02', '22007', '22008'].includes(error.code) ? 409 : 503;
            res.removeHeader('Content-Length');
            res.removeHeader('ETag');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            end(JSON.stringify({ success: false, message: res.statusCode === 409 ? 'Record conflicts with existing data or contains invalid values.' : 'Database operation failed. Please retry.' }));
          } finally { client!.release(); }
        })();
        return res;
      }) as Response['end'];
      res.on('close', () => {
        if (!ended) {
          ended = true;
          void client!.query('ROLLBACK').catch(() => {}).finally(() => client!.release());
        }
      });
      this.context.run(state, next);
    } catch {
      if (client) {
        await client.query('ROLLBACK').catch(() => {});
        client.release();
      }
      res.status(503).json({ success: false, message: 'Database unavailable. Please retry.' });
    }
  };

  private ensureDirectory() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  private loadData(): DatabaseSchema {
    const defaultDesignations: StaffDesignation[] = [
      { id: 'des-1', title: 'Security Guard', isDefault: true, description: 'Gate & street security personnel' },
      { id: 'des-2', title: 'Sweeper', isDefault: true, description: 'Street cleaning & sanitation crew' },
      { id: 'des-3', title: 'Electrician', isDefault: true, description: 'Street lights & motor electrician' },
      { id: 'des-4', title: 'Plumber', isDefault: true, description: 'Water pipe & motor technician' },
      { id: 'des-5', title: 'Office Staff', isDefault: true, description: 'Mohalla welfare office administrative assistant' },
      { id: 'des-6', title: 'Other', isDefault: true, description: 'General & contractual staff' },
    ];

    const defaultDb: DatabaseSchema = {
      users: initialUsers,
      roles: defaultRoles,
      notifications: initialNotifications,
      backupHistory: initialBackupHistory,
      loginHistory: initialLoginHistory,
      houses: initialHouses,
      collections: initialCollections,
      expenses: initialExpenses,
      staff: initialStaff,
      designations: defaultDesignations,
      salaries: initialSalaries,
      attendance: initialAttendance,
      ledger: initialLedger,
      settings: initialSettings,
      auditLogs: initialAuditLogs,
    };

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed: DatabaseSchema = JSON.parse(raw);

        // Ensure new modules are merged if missing
        if (!parsed.roles || parsed.roles.length === 0) parsed.roles = defaultRoles;
        if (!parsed.notifications) parsed.notifications = initialNotifications;
        if (!parsed.backupHistory) parsed.backupHistory = initialBackupHistory;
        if (!parsed.loginHistory) parsed.loginHistory = initialLoginHistory;
        if (!parsed.designations) parsed.designations = defaultDesignations;
        parsed.settings = { ...initialSettings, ...parsed.settings };

        // Ensure users have status and permissions
        parsed.users = parsed.users.map(u => {
          const matchedRole = defaultRoles.find(r => r.name === u.role);
          return {
            ...u,
            username: u.username || u.email.split('@')[0],
            status: u.status || (u.active === false ? 'Inactive' : 'Active'),
            active: u.status === 'Active' || u.active !== false,
            permissions: u.permissions || (matchedRole ? matchedRole.permissions : defaultRoles[0].permissions),
            avatar: u.avatar || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80`,
          };
        });

        return parsed;
      } catch (e) {
        console.error('Error reading JSON database, restoring initial data...', e);
      }
    }

    this.saveDataDirect(defaultDb);
    return defaultDb;
  }

  private saveDataDirect(dbData: DatabaseSchema) {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2), 'utf-8');
  }

  public save() {
    if (this.pool) {
      const state = this.context.getStore();
      if (!state) throw new Error('Database writes require an API request transaction');
      state.dirty = true;
      return;
    }
    this.saveDataDirect(this.data);
  }

  public get<K extends keyof DatabaseSchema>(key: K): DatabaseSchema[K] {
    return this.data[key];
  }

  public set<K extends keyof DatabaseSchema>(key: K, value: DatabaseSchema[K]) {
    this.data[key] = value;
    this.save();
  }

  public logAudit(user: { id: string; name: string; role: any }, action: AuditLog['action'], module: string, description: string, ip: string = '127.0.0.1') {
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      userId: user.id || 'system',
      userName: user.name || 'System User',
      userRole: user.role || 'Administrator',
      action,
      module,
      description,
      ipAddress: ip,
    };
    if (!this.data.auditLogs) this.data.auditLogs = [];
    this.data.auditLogs.unshift(newLog);
    if (this.data.auditLogs.length > 500) {
      this.data.auditLogs = this.data.auditLogs.slice(0, 500);
    }
    this.save();
  }

  public logLogin(user: User, reqInfo: { ip?: string; userAgent?: string }) {
    const record: LoginHistoryRecord = {
      id: `lh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: user.id,
      userName: user.name,
      loginTime: new Date().toISOString(),
      ipAddress: reqInfo.ip || '127.0.0.1',
      browser: reqInfo.userAgent ? (reqInfo.userAgent.includes('Chrome') ? 'Chrome' : reqInfo.userAgent.includes('Firefox') ? 'Firefox' : reqInfo.userAgent.includes('Safari') ? 'Safari' : 'Browser') : 'Chrome 127.0 (Desktop)',
      os: reqInfo.userAgent ? (reqInfo.userAgent.includes('Windows') ? 'Windows' : reqInfo.userAgent.includes('Mac') ? 'macOS' : reqInfo.userAgent.includes('Android') ? 'Android' : reqInfo.userAgent.includes('iPhone') ? 'iOS' : 'Linux') : 'Windows / Linux',
      location: 'Lahore, Pakistan',
    };
    if (!this.data.loginHistory) this.data.loginHistory = [];
    this.data.loginHistory.unshift(record);
    if (this.data.loginHistory.length > 200) {
      this.data.loginHistory = this.data.loginHistory.slice(0, 200);
    }
    this.save();
    return record;
  }

  public addNotification(notif: Omit<SystemNotification, 'id' | 'createdAt' | 'read'>) {
    const newNotif: SystemNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    if (!this.data.notifications) this.data.notifications = [];
    this.data.notifications.unshift(newNotif);
    if (this.data.notifications.length > 100) {
      this.data.notifications = this.data.notifications.slice(0, 100);
    }
    this.save();
    return newNotif;
  }

  public recalculateHouseDues(houseId: string) {
    const house = this.data.houses.find(h => h.id === houseId);
    if (!house) return;
    // Calculate unpaid dues based on house collections
    // For simplicity: currentDues is preserved or updated on payments/bulk generation
  }
}

export const db = new Database();
