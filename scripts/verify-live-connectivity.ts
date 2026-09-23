import 'dotenv/config';
import { verificationAuthorization } from './verification-auth';
import assert from 'node:assert/strict';
import { fork, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createDatabasePool, databaseTransport } from '../server/database-pool';
import { RelationalStore, STORAGE_LOCK } from '../server/relational-store';
import { monthSummary } from '../server/collection-finance';

// Separate OS processes prove persistence across an application/pool restart.
if (process.argv.includes('--serve-test')) {
  process.env.MADINA_TEST_MODE = '1';
  const { app } = await import('../server');
  const { db } = await import('../server/db');
  await db.initialize();
  const server = app.listen(0, '127.0.0.1', () => process.send?.({ port: (server.address() as any).port }));
  process.on('message', message => {
    if (message === 'stop') server.close(() => void db.close().then(() => process.exit(0)));
  });
} else {
  const pool = createDatabasePool();
  const store = new RelationalStore();
  let child: ChildProcess | undefined;
  const marker = `TEMP-CONNECTIVITY-${randomUUID()}`;
  let attemptedStaffWrite = false;
  const snapshot = async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await store.initialize(client);
      const data = await store.load(client);
      await client.query('ROLLBACK');
      return data;
    } finally { client.release(); }
  };
  const stop = async () => {
    if (!child) return;
    const current = child; child = undefined;
    if (current.exitCode !== null) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { current.kill(); reject(new Error('Test application shutdown timed out')); }, 15000);
      current.once('exit', () => { clearTimeout(timer); resolve(); });
      current.send('stop');
    });
  };
  const start = async () => {
    child = fork(fileURLToPath(import.meta.url), ['--serve-test'], {
      execArgv: ['--import', 'tsx'], env: { ...process.env, MADINA_TEST_MODE: '1', NODE_ENV: 'production' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Test application startup timed out')), 45000);
      child!.once('error', error => { clearTimeout(timer); reject(error); });
      child!.once('exit', code => { clearTimeout(timer); reject(new Error(`Test application exited: ${code}`)); });
      child!.once('message', (message: any) => { clearTimeout(timer); resolve(`http://127.0.0.1:${message.port}`); });
    });
  };
  const request = async (base: string, path: string, body?: unknown) => {
    const response = await fetch(base + path, { method: body === undefined ? 'GET' : 'POST', headers: { ...verificationAuthorization(original!.users), 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000) });
    assert.equal(response.status, 200, `HTTP ${response.status}: ${path}`);
    return await response.json() as any;
  };
  let original: Awaited<ReturnType<typeof snapshot>> | undefined;
  try {
    assert.equal((await pool.query('SELECT 1 AS connected')).rows[0].connected, 1);
    original = await snapshot();
    const month = monthSummary(original, '2026-09');
    const ledger = original.ledger.filter(e => e.status !== 'Voided' && e.date.startsWith('2026-09'));
    const totals = {
      houses: original.houses.filter(h => !h.isDeleted).length,
      expected: month.expected, collected: month.collected, outstanding: month.remaining,
      expenses: original.expenses.filter(e => e.status === 'Approved' && e.date.startsWith('2026-09')).reduce((s, e) => s + e.amount, 0),
      inflow: ledger.reduce((s, e) => s + e.credit, 0), outflow: ledger.reduce((s, e) => s + e.debit, 0), ledgerTransactions: ledger.length,
    };
    // User-supplied identity references: assert them, never alter records to match.
    assert.deepEqual(totals, { houses: 22, expected: 85500, collected: 4000, outstanding: 81500, expenses: 86000, inflow: 4000, outflow: 86000, ledgerTransactions: 2 });
    assert.equal(original.ledger.filter(e => e.expenseId === 'exp-1789805406010').length, 1);
    console.log(JSON.stringify({ transport: databaseTransport(), selectOne: 1, verifiedSeptember: totals }));
    let base = await start();
    for (const path of ['/api/staff', '/api/houses', '/api/collections', '/api/expenses', '/api/ledger', '/api/dashboard/stats', '/api/reports/summary', '/api/financial-summary', '/api/reports/monthly-closing?month=2026-09']) await request(base, path);
    console.log('All application read endpoints returned HTTP 200.');
    if (process.argv.includes('--live-staff')) {
      assert.equal(original.staff.length, 0, 'Stop: staff baseline changed; review before temporary test.');
      const body = { empNo: marker, name: marker, cnic: marker, phone: '03000000000', address: 'Temporary connectivity verification only', role: original.designations![0].title, joiningDate: '2026-09-21', monthlySalary: 1, status: 'Active' };
      console.log('Temporary staff marker:', marker);
      attemptedStaffWrite = true;
      const created = await request(base, '/api/staff', body);
      const staffId = created.staff.id;
      const retries = await Promise.all([request(base, '/api/staff', body), request(base, '/api/staff', body)]);
      assert.ok(retries.every(result => result.staff.id === staffId));
      assert.equal((await request(base, '/api/staff')).staff.filter((s: any) => s.id === staffId).length, 1);
      await stop(); base = await start();
      assert.equal((await request(base, '/api/staff')).staff.filter((s: any) => s.id === staffId).length, 1);
      const afterPost = await snapshot();
      assert.equal(afterPost.staff.length, 1);
      for (const key of Object.keys(original) as (keyof typeof original)[]) {
        if (key !== 'staff') assert.deepEqual(afterPost[key], original[key], `${key} changed during staff registration`);
      }
      console.log('Live POST, simultaneous retries, fresh list read and full server-process restart: PASS. No financial side effects.');
    }
  } finally {
    try { await stop(); }
    finally {
      try {
        if (attemptedStaffWrite) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='30s'");
            await client.query('SELECT pg_advisory_xact_lock($1)', [STORAGE_LOCK]);
            // Exact unique test identity only; ordinary staff DELETE retains history.
            const removed = await client.query('DELETE FROM public.staff WHERE emp_no=$1 AND name=$1 AND cnic=$1 RETURNING id', [marker]);
            assert.ok((removed.rowCount || 0) <= 1);
            await client.query('COMMIT');
            console.log('Temporary test rows removed:', removed.rowCount);
          } catch (error) { await client.query('ROLLBACK'); throw error; }
          finally { client.release(); }
        }
        if (original) {
          const final = await snapshot();
          assert.deepEqual(final, original, 'All database records must exactly match the initial snapshot after cleanup');
          console.log(JSON.stringify({ allExistingRecordsUnchanged: true, finalStaffCount: final.staff.length, finalLedgerCount: final.ledger.length }));
        }
      } finally { await pool.end(); }
    }
  }
}
