import 'dotenv/config';
import assert from 'node:assert/strict';
import express from 'express';
import { registerStaffRoutes } from '../server/staff-routes';
import { acquireConnection } from '../server/database-errors';
import type { DatabaseSchema } from '../server/db';

let checks = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
let attempts = 0;
check(await acquireConnection(async () => { if (++attempts === 1) throw Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' }); return 'connected'; }) === 'connected' && attempts === 2, 'Retry transient acquisition once');
attempts = 0;
await assert.rejects(() => acquireConnection(async () => { attempts++; throw Object.assign(new Error('Invalid credentials'), { code: '28P01' }); }));
check(attempts === 1, 'Do not retry authentication/configuration errors');
attempts = 0;
await assert.rejects(() => acquireConnection(async () => { attempts++; throw Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }); }));
check(attempts === 2, 'Bounded connection retry');

const live = process.argv.includes('--database');
let client: import('pg').PoolClient | undefined;
let pool: import('pg').Pool | undefined;
let relational: import('../server/relational-store').RelationalStore | undefined;
let original: DatabaseSchema;
let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
try {
  if (live) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for rollback-only verification.');
    const { createDatabasePool } = await import('../server/database-pool');
    const { RelationalStore, STORAGE_LOCK } = await import('../server/relational-store');
    pool = createDatabasePool();
    client = await acquireConnection(() => pool!.connect());
    await client.query("BEGIN; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='30s'");
    await client.query('SELECT pg_advisory_xact_lock($1)', [STORAGE_LOCK]);
    relational = new RelationalStore(); await relational.initialize(client);
    original = await relational.load(client);
    console.log('Existing staff:', original.staff.length);
    console.log('Staff/payroll constraints:', (await client.query("SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('public.staff'::regclass, 'public.salaries'::regclass)")).rows);
    console.log('Migrations:', (await client.query('SELECT id FROM public.app_schema_migrations')).rows);
  } else {
    original = { staff: [{ id: 'existing-staff', empNo: 'EMP-007', name: 'Existing isolated fixture', cnic: 'existing-cnic', phone: '03000000000', address: '', role: 'Security Guard', joiningDate: '2026-01-01', monthlySalary: 100, status: 'Active' }], designations: [{ id: 'test-designation', title: 'Security Guard' }], salaries: [], ledger: [], houses: [], expenses: [], collections: [] } as unknown as DatabaseSchema;
  }
  let committed = structuredClone(original), working = structuredClone(original), failSave = false;
  const store = { get: (key: keyof DatabaseSchema) => working[key], save: () => { if (failSave) throw new Error('Simulated storage failure'); } };
  const app = express(); app.use(express.json());
  app.use((_req, res, next) => {
    working = structuredClone(committed);
    const end = res.end.bind(res);
    res.end = ((...args: any[]) => {
      void (async () => {
        if (res.statusCode < 400) {
          if (client && relational) await relational.persist(client, working, committed);
          committed = working;
        }
        (end as any)(...args);
      })().catch(error => { console.error(error); res.statusCode = 500; res.removeHeader('Content-Length'); end('{}'); });
      return res;
    }) as typeof res.end;
    next();
  });
  registerStaffRoutes(app, store as any);
  app.use((_error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(503).json({ success: false, message: 'Storage operation failed. Please retry.' }));
  server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server!.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = async (method: string, body?: unknown, path = '/api/staff') => {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json() as any };
  };
  const unique = crypto.randomUUID();
  const body = { empNo: `VERIFY-${unique}`, name: 'Rollback-only staff verification', role: original.designations![0].title, cnic: `VERIFY-${unique}`, phone: '03001234567', joiningDate: '2026-09-21', monthlySalary: 30000, status: 'Active' };
  for (const invalid of [{ name: '' }, { cnic: ' ' }, { phone: null }, { role: 'missing-designation' }, { joiningDate: '2026-02-30' }, { status: 'Unknown' }, { monthlySalary: null }, { monthlySalary: -1 }, { monthlySalary: 'abc' }, { monthlySalary: 1.234 }, { monthlySalary: 1e14 }]) {
    check((await request('POST', { ...body, ...invalid })).status === 400, 'Invalid staff input rejected');
  }
  check(JSON.stringify(committed) === JSON.stringify(original), 'Validation leaves all records unchanged');
  const created = await request('POST', body);
  check(created.status === 200 && created.data.staff.id, 'Valid staff POST succeeds');
  const staffId = created.data.staff.id;
  check((await request('GET')).data.staff.some((s: any) => s.id === staffId), 'Saved staff immediately appears in list');
  check((await request('POST', body)).data.staff.id === staffId, 'Retry returns the same staff record');
  check((await request('POST', { ...body, name: 'Conflicting name' })).status === 409, 'Conflicting employee ID/CNIC rejected');
  check((await request('POST', { ...body, empNo: 'different' })).status === 409, 'Duplicate CNIC rejected');
  check(committed.staff.length === original.staff.length + 1, 'Exactly one new staff record');
  check((await request('PUT', { monthlySalary: 31000 }, '/api/staff/' + staffId)).status === 200, 'Staff update compatible with salary field');
  check(committed.staff.find(s => s.id === staffId)?.monthlySalary === 31000, 'Stable staff ID available for salary foreign key');
  const beforeFailure = structuredClone(committed); failSave = true;
  const failed = await request('POST', { ...body, empNo: 'failure-only', cnic: 'failure-only' }); failSave = false;
  check(failed.status === 503 && !failed.data.message.includes('Simulated'), 'Safe storage failure response');
  assert.deepEqual(committed, beforeFailure); checks++;
  for (const key of Object.keys(original) as (keyof DatabaseSchema)[]) {
    if (key !== 'staff') assert.deepEqual(committed[key], original[key]);
  }
  check(original.staff.every(s => JSON.stringify(committed.staff.find(r => r.id === s.id)) === JSON.stringify(s)), 'Existing staff unchanged');
  checks++;
  if (client && relational) {
    const { RelationalStore } = await import('../server/relational-store');
    const freshAdapter = new RelationalStore(); await freshAdapter.initialize(client);
    const reloaded = await freshAdapter.load(client);
    check(reloaded.staff.some(s => s.id === staffId && s.monthlySalary === 31000), 'Fresh adapter reload reads persisted staff within rollback transaction');
    await client.query('ROLLBACK');
    const after = await freshAdapter.load(client);
    assert.deepEqual(after, original); checks++;
    console.log('All database records identical after rollback; no salary or ledger records created.');
  }
  console.log(`PASS: ${checks} staff checks (${live ? 'PostgreSQL rollback-only' : 'isolated memory; persistence not asserted'}).`);
} finally {
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  if (client) { await client.query('ROLLBACK').catch(() => {}); client.release(); }
  await pool?.end();
}
