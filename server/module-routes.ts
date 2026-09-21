import type { Express, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { db, type DatabaseSchema } from './db';
import type { User } from '../src/types';
import { financeData } from './collection-routes';
import { reconcile, validPayment, contribution, currentMonth } from './collection-finance';

type AuthRequest = Request & { user?: User };
const id = (prefix: string) => `${prefix}-${randomUUID()}`;
const now = () => new Date().toISOString();
const today = () => now().slice(0, 10);
const fail = (res: Response, message: string, status = 400) => res.status(status).json({ success: false, message });

export function registerModuleRoutes(app: Express) {
  const reads: [string, keyof DatabaseSchema, string][] = [
    ['/api/roles', 'roles', 'roles'], ['/api/staff/designations', 'designations', 'designations'],
    ['/api/staff', 'staff', 'staff'], ['/api/salaries', 'salaries', 'salaries'],
    ['/api/attendance', 'attendance', 'attendance'],
    ['/api/expense-categories', 'expenseCategories', 'categories'],
    ['/api/notifications', 'notifications', 'notifications'], ['/api/audit-logs', 'auditLogs', 'auditLogs'],
    ['/api/system/login-history', 'loginHistory', 'loginHistory'], ['/api/system/backups', 'backupHistory', 'backups'],
  ];
  for (const [route, key, responseKey] of reads) app.get(route, (_req, res) => res.json({ success: true, [responseKey]: db.get(key) || [] }));

  // Restrict editable fields; request bodies cannot replace primary keys.
  function update(route: string, key: keyof DatabaseSchema, responseKey: string, fields: string[]) {
    app.put(route, (req, res) => {
      const records = db.get(key) as any[];
      const record = records.find(r => r.id === req.params.id);
      if (!record) return fail(res, 'Record not found.', 404);
      for (const field of fields) if (Object.hasOwn(req.body, field)) record[field] = req.body[field];
      if (key === 'users') record.active = record.status === 'Active';
      if (['users', 'staff', 'expenses'].includes(key)) record.updatedAt = now();
      db.save();
      res.json({ success: true, [responseKey]: record });
    });
  }
  update('/api/users/:id', 'users', 'user', ['name', 'email', 'username', 'role', 'status', 'phone', 'avatar', 'permissions']);
  update('/api/staff/:id', 'staff', 'staff', ['name', 'fatherName', 'cnic', 'phone', 'emergencyContact', 'address', 'role', 'joiningDate', 'monthlySalary', 'status', 'notes', 'photoUrl']);
  update('/api/roles/:id', 'roles', 'role', ['name', 'description', 'permissions']);

  for (const [route, key, field, responseKey] of [
    ['/api/expense-categories', 'expenseCategories', 'name', 'category'],
    ['/api/staff/designations', 'designations', 'title', 'designation'],
    ['/api/roles', 'roles', 'name', 'role'],
  ] as const) {
    app.post(route, (req, res) => {
      const value = String(req.body[field] || '').trim();
      if (!value) return fail(res, `${field} is required.`);
      const records = db.get(key) || [];
      if (records.some((r: any) => r[field].toLowerCase() === value.toLowerCase())) return fail(res, 'This name already exists.', 409);
      const record: any = { id: id(key), [field]: value, description: String(req.body.description || ''), createdAt: now(), isDefault: false };
      if (key === 'roles') { record.permissions = req.body.permissions || []; record.isSystem = false; }
      (records as any[]).push(record);
      db.set(key, records as any);
      res.json({ success: true, [responseKey]: record });
    });
    app.delete(`${route}/:id`, (req, res) => {
      const records = db.get(key) || [];
      const record: any = records.find(r => r.id === req.params.id);
      if (!record) return fail(res, 'Record not found.', 404);
      if (record.isSystem || record.isDefault) return fail(res, 'System/default records cannot be deleted.', 409);
      db.set(key, records.filter(r => r.id !== req.params.id) as any);
      res.json({ success: true });
    });
  }

  app.post('/api/staff', (req, res) => {
    const body = req.body;
    if (!body.name || !body.role || !body.cnic || !body.phone || !body.joiningDate) return fail(res, 'Name, designation, CNIC, phone and joining date are required.');
    const salary = Number(body.monthlySalary);
    if (!Number.isFinite(salary) || salary < 0) return fail(res, 'Monthly salary must be a non-negative number.');
    const staff = { id: id('staff'), empNo: body.empNo || `EMP-${randomUUID().slice(0, 8).toUpperCase()}`, name: body.name, fatherName: body.fatherName, cnic: body.cnic, phone: body.phone, emergencyContact: body.emergencyContact, address: body.address || '', role: body.role, joiningDate: body.joiningDate, monthlySalary: salary, status: body.status || 'Active', notes: body.notes || '', photoUrl: body.photoUrl, createdAt: now() };
    db.get('staff').push(staff);
    db.save();
    res.json({ success: true, staff });
  });
  app.delete('/api/staff/:id', (req, res) => {
    const staff = db.get('staff').find(r => r.id === req.params.id);
    if (!staff) return fail(res, 'Staff member not found.', 404);
    // Retain payroll and attendance history for former employees.
    staff.status = 'Inactive';
    db.save();
    res.json({ success: true });
  });
  app.post('/api/salaries', (req: AuthRequest, res) => {
    const staff = db.get('staff').find(r => r.id === req.body.staffId);
    if (!staff || !req.body.month) return fail(res, 'A valid staff member and salary month are required.');
    const baseSalary = Number(req.body.baseSalary ?? staff.monthlySalary);
    const allowance = Number(req.body.allowance || 0), bonus = Number(req.body.bonus || 0), deductions = Number(req.body.deductions || 0);
    if (![baseSalary, allowance, bonus, deductions].every(v => Number.isFinite(v) && v >= 0)) return fail(res, 'Salary amounts must be non-negative numbers.');
    const netPaid = baseSalary + allowance + bonus - deductions;
    if (netPaid < 0) return fail(res, 'Deductions exceed the salary amount.');
    if (db.get('salaries').some(s => s.staffId === staff.id && s.month === req.body.month && s.year === req.body.year)) return fail(res, 'Salary already paid for this month.', 409);
    const salary = { id: id('salary'), slipNo: `SAL-${randomUUID().slice(0, 8).toUpperCase()}`, staffId: staff.id, staffName: staff.name, staffRole: staff.role, month: req.body.month, year: req.body.year, baseSalary, allowance, bonus, deductions, netPaid, paymentDate: req.body.paymentDate || today(), paymentMethod: req.body.paymentMethod || 'Cash', notes: req.body.notes || '', paidBy: req.user?.name || 'System' };
    db.get('salaries').unshift(salary);
    db.save();
    res.json({ success: true, salary });
  });
  function attendance(req: Request, res: Response, all: boolean) {
    const date = req.body.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return fail(res, 'A valid attendance date is required.');
    const records = all ? db.get('staff').filter(s => s.status === 'Active').map(s => ({ staffId: s.id, status: req.body.status })) : req.body.records;
    if (!Array.isArray(records)) return fail(res, 'Attendance records are required.');
    for (const item of records) {
      const staff = db.get('staff').find(s => s.id === item.staffId);
      if (!staff || !['Present', 'Absent', 'Leave', 'Half Day', 'Late'].includes(item.status)) return fail(res, 'Invalid attendance record.');
      const existing = db.get('attendance').find(a => a.staffId === staff.id && a.date === date);
      const value = { id: existing?.id || id('attendance'), staffId: staff.id, staffName: staff.name, date, status: item.status, checkIn: item.checkIn || '', notes: item.notes || '' };
      if (existing) Object.assign(existing, value); else db.get('attendance').push(value);
    }
    db.save();
    res.json({ success: true });
  }
  app.post('/api/attendance', (req, res) => attendance(req, res, false));
  app.post('/api/attendance/mark-all', (req, res) => attendance(req, res, true));

  app.post('/api/collections/:id/cancel', (req: AuthRequest, res) => {
    const collection = db.get('collections').find(c => c.id === req.params.id);
    if (!collection) return fail(res, 'Collection not found.', 404);
    collection.status = 'Cancelled'; collection.cancelledBy = req.user?.name; collection.cancelledReason = req.body.reason || ''; collection.cancelledAt = now();
    const data = financeData();
    reconcile(data);
    db.set('monthlyDues', data.monthlyDues);
    db.save(); res.json({ success: true, collection, message: 'Collection cancelled.' });
  });
  app.put('/api/notifications/read-all', (_req, res) => {
    for (const n of db.get('notifications') || []) n.read = true;
    db.save(); res.json({ success: true });
  });
  app.put('/api/notifications/:id/read', (req, res) => {
    const notification = db.get('notifications')?.find(n => n.id === req.params.id);
    if (!notification) return fail(res, 'Notification not found.', 404);
    notification.read = true; db.save(); res.json({ success: true });
  });
  app.post('/api/notifications', (req, res) => {
    if (!req.body.title || !req.body.message || !req.body.type) return fail(res, 'Notification title, message and type are required.');
    res.json({ success: true, notification: db.addNotification({ title: req.body.title, message: req.body.message, type: req.body.type, link: req.body.link }) });
  });
  app.delete('/api/notifications/:id', (req, res) => {
    db.set('notifications', (db.get('notifications') || []).filter(n => n.id !== req.params.id));
    res.json({ success: true });
  });
  app.post('/api/audit-logs/log-action', (req: AuthRequest, res) => {
    if (!req.body.action || !req.body.module || !req.body.description) return fail(res, 'Action, module and description are required.');
    db.logAudit(req.user!, req.body.action, req.body.module, req.body.description);
    res.json({ success: true });
  });
  app.post('/api/system/backup', (req: AuthRequest, res) => {
    const keys: (keyof DatabaseSchema)[] = ['users', 'roles', 'houses', 'monthlyDues', 'collections', 'expenses', 'expenseCategories', 'staff', 'designations', 'salaries', 'attendance', 'ledger', 'settings', 'auditLogs', 'notifications', 'loginHistory', 'backupHistory'];
    const backup = structuredClone(Object.fromEntries(keys.map(k => [k, db.get(k)])));
    const backupRecord = { id: id('backup'), filename: `Madina_Street_Backup_${today()}.json`, sizeBytes: Buffer.byteLength(JSON.stringify(backup)), createdAt: now(), createdBy: req.user?.name || 'System', type: req.body.type === 'SCHEDULED' ? 'SCHEDULED' as const : 'MANUAL' as const, status: 'COMPLETED' as const };
    db.set('backupHistory', [backupRecord, ...(db.get('backupHistory') || [])]);
    res.json({ success: true, backup, backupPayload: backup, backupRecord, message: 'Backup generated.' });
  });
  app.get('/api/system/health', (_req, res) => res.json({ success: true, health: { dbStatus: 'Healthy', storage: process.env.DATABASE_URL ? 'PostgreSQL relational' : 'Local JSON', totalUsers: db.get('users').length, totalHouses: db.get('houses').length, totalCollections: db.get('collections').length, totalExpenses: db.get('expenses').length, totalLogs: db.get('auditLogs').length, diskUsageKb: 0, appVersion: '0.0.0', nodeVersion: process.version, serverTime: now(), uptimeSeconds: process.uptime() } }));

  app.get('/api/financial-summary', (_req, res) => {
    const income = db.get('collections').filter(validPayment);
    const expenses = db.get('expenses').filter(e => e.status === 'Approved');
    const salaries = db.get('salaries');
    const sum = (rows: any[], field: string) => rows.reduce((total, r) => total + Number(r[field] || 0), 0);
    const totals = (prefix: string) => ({ income: sum(income.filter(c => (prefix.length === 10 ? c.paymentDate : contribution(c)).startsWith(prefix)), 'totalPaid'), expenses: sum(expenses.filter(e => e.date.startsWith(prefix)), 'amount') + sum(salaries.filter(s => s.paymentDate.startsWith(prefix)), 'netPaid') });
    const all = totals(''), day = totals(today()), month = totals(today().slice(0, 7)), year = totals(today().slice(0, 4));
    const categories = new Map<string, number>();
    for (const e of expenses) categories.set(e.category, (categories.get(e.category) || 0) + e.amount);
    const expenseByCategory = [...categories].map(([category, amount]) => ({ category, amount, percentage: all.expenses ? amount / all.expenses * 100 : 0 }));
    res.json({ success: true, summary: { totalIncome: all.income, totalExpenses: all.expenses, currentBalance: all.income - all.expenses, todayIncome: day.income, todayExpenses: day.expenses, monthlyIncome: month.income, monthlyExpenses: month.expenses, yearlyIncome: year.income, yearlyExpenses: year.expenses, expenseByCategory, monthlyTrends: Array.from({ length: 12 }, (_, i) => { const date = new Date(); date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() - 11 + i); const prefix = date.toISOString().slice(0, 7); return { month: prefix, ...totals(prefix) }; }), topCategories: [...expenseByCategory].sort((a,b) => b.amount - a.amount).slice(0, 5) } });
  });
}
