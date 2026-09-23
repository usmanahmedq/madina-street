import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import express from 'express';
import { createDatabasePool } from '../server/database-pool';
import { db, type DatabaseSchema } from '../server/db';
import { RelationalStore, STORAGE_LOCK, TABLES } from '../server/relational-store';

const pool = createDatabasePool();
const testId = `verify-${randomUUID()}`;
const client = await pool.connect();
let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock($1)', [STORAGE_LOCK]);
  const store = new RelationalStore();
  await store.initialize(client);
  const original = await store.load(client);
  const data = structuredClone(original);
  const stamp = '2026-09-15T10:20:30.123Z', date = '2026-09-15';
  const role = testId, user = testId, house = testId, staff = testId;
  data.roles!.push({ id: role, name: role, description: 'Verification', permissions: [{ module: 'Dashboard', view: true, create: false, edit: false, delete: false, print: false, export: false }], createdAt: stamp });
  data.users.push({ id: user, name: 'Verification', email: `${testId}@example.invalid`, role, active: true, createdAt: stamp });
  data.houses.push({ id: house, houseNo: testId, street: 'Test', sector: 'Test', category: 'Residential Standard', residentType: 'Owner', headName: 'Verification', phone: '000', familyMembers: 1, monthlyFee: 1234.56, status: 'Active', currentDues: 12.34, joinedDate: date });
  data.expenseCategories!.push({ id: testId, name: testId });
  data.designations!.push({ id: testId, title: testId });
  data.staff.push({ id: staff, empNo: testId, name: 'Verification', cnic: '000', phone: '000', address: 'Test', role: testId, joiningDate: date, monthlySalary: 100.25, status: 'Active' });
  data.collections.push({ id: testId, receiptNo: testId, houseId: house, houseNo: testId, headName: 'Verification', sector: 'Test', street: 'Test', month: 'September 2026', amount: 10.25, lateFee: 0.5, totalPaid: 10.75, paymentDate: date, paymentMethod: 'Cash', collectorId: user, collectorName: 'Verification', createdAt: stamp });
  data.expenses.push({ id: testId, voucherNo: testId, title: 'Verification', category: testId, amount: 1.25, date, paidTo: 'Test', paymentMethod: 'Cash', createdBy: 'Test', status: 'Approved', createdAt: stamp });
  data.salaries.push({ id: testId, slipNo: testId, staffId: staff, staffName: 'Test', staffRole: testId, month: 'September 2026', baseSalary: 100.25, bonus: 0, deductions: 0, netPaid: 100.25, paymentDate: date, paymentMethod: 'Cash' });
  data.attendance.push({ id: testId, date, staffId: staff, staffName: 'Test', status: 'Present', checkIn: '09:30 AM' });
  data.ledger.push({ id: testId, date, referenceNo: testId, type: 'INCOME', accountHead: 'Test', description: 'Verification', debit: 0, credit: 10.75, runningBalance: 10.75, performedBy: 'Test' });
  data.settings.receiptFooter = testId;
  data.notifications!.push({ id: testId, title: 'Verification', message: '0', type: 'BACKUP', read: false, createdAt: stamp });
  data.backupHistory!.push({ id: testId, filename: 'Verification.json', sizeBytes: 123, createdAt: stamp, createdBy: 'Test', type: 'MANUAL', status: 'COMPLETED' });
  data.loginHistory!.push({ id: testId, userId: user, userName: 'Test', loginTime: stamp, ipAddress: '127.0.0.1', browser: 'Test', os: 'Test' });
  data.auditLogs.push({ id: testId, timestamp: stamp, userId: user, userName: 'Test', userRole: role, action: 'VIEW', module: 'Verification', description: 'Verification', ipAddress: '127.0.0.1' });
  (data.houses.at(-1) as any).futureField = { retained: true };
  await store.persist(client, data, original);
  const read = await store.load(client);
  for (const key of Object.keys(TABLES) as (keyof DatabaseSchema)[]) {
    if (key === 'settings') assert.equal(read.settings.receiptFooter, testId);
    else assert.equal((read[key] as any[]).length, ((original[key] || []) as any[]).length + (key === 'monthlyDues' ? 0 : 1), `${key} insertion`);
  }
  const readHouse = read.houses.find(h => h.id === house)!;
  assert.equal(readHouse.monthlyFee, 1234.56);
  assert.equal(readHouse.joinedDate, date);
  assert.deepEqual((readHouse as any).futureField, { retained: true });
  assert.equal(Date.parse(read.users.find(u => u.id === user)!.createdAt), Date.parse(stamp));
  assert.deepEqual(read.roles!.find(r => r.id === role)!.permissions, data.roles!.at(-1)!.permissions);
  const changed = structuredClone(read);
  changed.houses.find(h => h.id === house)!.monthlyFee = 999.99;
  await store.persist(client, changed, read);
  assert.equal((await store.load(client)).houses.find(h => h.id === house)!.monthlyFee, 999.99);
  await client.query('SAVEPOINT invalid_write');
  await assert.rejects(client.query('DELETE FROM public.houses WHERE id = $1', [house]), (e: any) => ['23503', '23001'].includes(e.code));
  await client.query('ROLLBACK TO SAVEPOINT invalid_write');
  await store.persist(client, original, changed);
  const removed = await store.load(client);
  for (const key of Object.keys(TABLES) as (keyof DatabaseSchema)[]) {
    if (key !== 'settings') assert.equal((removed[key] as any[]).length, ((original[key] || []) as any[]).length);
  }
  await client.query('ROLLBACK');
  console.log('PASS: all 16 tables insert/update/delete; dates, decimals, permissions, extra fields, FK protection; fixtures rolled back.');

  await db.initialize();
  const app = express();
  app.use(db.middleware);
  app.post('/create', (_req, res) => {
    db.set('notifications', [...(db.get('notifications') || []), { id: testId, title: 'Database verification', message: '0', type: 'BACKUP', read: true, createdAt: new Date().toISOString() }]);
    res.json({ success: true });
  });
  app.post('/increment', (_req, res) => {
    const record = db.get('notifications')!.find(n => n.id === testId)!;
    record.message = String(Number(record.message) + 1);
    db.save(); res.json({ success: true });
  });
  app.post('/invalid', (_req, res) => {
    db.get('notifications')!.find(n => n.id === testId)!.message = 'invalid';
    db.get('houses').push({ ...db.get('houses')[0], id: testId });
    db.save(); res.json({ success: true });
  });
  app.post('/reject', (_req, res) => {
    db.get('notifications')!.find(n => n.id === testId)!.message = 'rejected';
    db.save(); res.status(400).json({ success: false });
  });
  app.delete('/cleanup', (_req, res) => {
    db.set('notifications', db.get('notifications')!.filter(n => n.id !== testId));
    res.json({ success: true });
  });
  server = await new Promise(resolve => { const running = app.listen(0, '127.0.0.1', () => resolve(running)); });
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const call = async (route: string, method = 'POST') => {
    const response = await fetch(base + route, { method });
    await response.json(); return response.status;
  };
  assert.equal(await call('/create'), 200);
  assert.deepEqual(await Promise.all([call('/increment'), call('/increment')]), [200, 200]);
  assert.equal(await call('/invalid'), 409);
  assert.equal(await call('/reject'), 400);
  const persisted = await pool.query('SELECT message FROM public.notifications WHERE id = $1', [testId]);
  assert.equal(persisted.rows[0].message, '2');
  assert.equal(await call('/cleanup', 'DELETE'), 200);
  assert.equal((await pool.query('SELECT id FROM public.notifications WHERE id = $1', [testId])).rowCount, 0);
  console.log('PASS: HTTP commits, independent connection persistence, concurrent updates, atomic failure rollback and cleanup.');
} catch (error: any) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Verification failed:', error.code || error.name, error.message);
  process.exitCode = 1;
} finally {
  if (server) await new Promise<void>((resolve, reject) => server!.close(e => e ? reject(e) : resolve()));
  // Only our uniquely identified verification notification can be removed here.
  await pool.query('DELETE FROM public.notifications WHERE id = $1', [testId]).catch(() => {});
  client.release();
  await db.close();
  await pool.end();
}
