import 'dotenv/config';
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createDatabasePool } from '../server/database-pool';
import { RelationalStore, STORAGE_LOCK } from '../server/relational-store';
import { requireJwtSecret, type AuthUser } from '../server/auth';
import { monthSummary } from '../server/collection-finance';

// Operator-only CLI; never register an enrollment HTTP endpoint.
const statusPath = 'data/admin-enrollment-status.log';
let phase = 'local input';
let enrolled = false;
let password = '';
let server: import('node:http').Server | undefined;
let closeApp: (() => Promise<void>) | undefined;
const pool = createDatabasePool();
const ensure = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const report = (data: object) => { fs.mkdirSync('data', { recursive: true }); fs.writeFileSync(statusPath, JSON.stringify(data, null, 2)); console.log(JSON.stringify(data)); };
try {
  ensure(process.argv.includes('--password-stdin') && !process.stdin.isTTY, 'Use the masked PowerShell enrollment prompt.');
  let input = '';
  for await (const chunk of process.stdin) { input += chunk; ensure(input.length < 4096, 'Input too large.'); }
  password = JSON.parse(input).password; input = '';
  ensure(typeof password === 'string' && password.length >= 12 && Buffer.byteLength(password, 'utf8') <= 72, 'Invalid password length.');
  const secret = requireJwtSecret();
  process.env.MADINA_TEST_MODE = '1';
  const { app } = await import('../server');
  const { db } = await import('../server/db');
  closeApp = () => db.close();
  await db.initialize();
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server!.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  const request = async (path: string, body?: object, token?: string) => {
    const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(45000) });
    return { status: response.status, data: await response.json() as any };
  };
  phase = 'locked account inspection';
  const client = await pool.connect();
  const store = new RelationalStore();
  let before: Awaited<ReturnType<RelationalStore['load']>>;
  let admin: AuthUser;
  try {
    await client.query("BEGIN; SET LOCAL lock_timeout='15s'; SET LOCAL statement_timeout='30s'");
    await client.query('SELECT pg_advisory_xact_lock($1)', [STORAGE_LOCK]);
    await store.initialize(client);
    before = await store.load(client);
    const admins = before.users.filter(u => u.role === 'Administrator' && u.active !== false && u.status === 'Active');
    ensure(admins.length === 1, 'Expected exactly one active administrator; manual review required.');
    admin = admins[0] as AuthUser;
    ensure(!admin.passwordHash && !(admin as any).password && !(admin as any).password_hash, 'Credential already exists; refusing overwrite.');
    ensure((before.auditLogs?.length || 0) <= 496 && (before.loginHistory?.length || 0) <= 198, 'Audit history capacity requires review before login tests.');
    const rows = await client.query('SELECT extra_data FROM public.users WHERE id=$1 FOR UPDATE', [admin.id]);
    ensure(rows.rowCount === 1 && !rows.rows[0].extra_data?.passwordHash, 'Administrator changed; refusing overwrite.');
    phase = 'credential enrollment';
    const hash = await bcrypt.hash(password, 12);
    const update = await client.query("UPDATE public.users SET extra_data=jsonb_set(extra_data,'{passwordHash}',to_jsonb($2::text),true) WHERE id=$1 AND role='Administrator' AND status='Active' AND active=true AND coalesce(extra_data->>'passwordHash','')='' RETURNING id", [admin.id, hash]);
    ensure(update.rowCount === 1, 'Credential enrollment did not affect exactly one existing administrator.');
    const expected = structuredClone(before);
    (expected.users.find(u => u.id === admin.id)! as AuthUser).passwordHash = hash;
    ensure(isDeepStrictEqual(await store.load(client), expected), 'Unexpected database changes before commit.');
    await client.query('COMMIT');
    enrolled = true;
    report({ completed: false, enrolled: true, phase: 'credential committed; verifying real authentication' });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
  finally { client.release(); }

  phase = 'real login verification';
  const login = await request('/api/auth/login', { username: admin!.username || admin!.email, password });
  ensure(login.status === 200 && typeof login.data.token === 'string', 'Real login failed.');
  ensure(login.data.user.id === admin!.id && login.data.user.role === 'Administrator' && !login.data.user.passwordHash, 'Unexpected authenticated identity.');
  ensure((await request('/api/dashboard/stats', undefined, login.data.token)).status === 200, 'Protected endpoint failed.');
  ensure((await request('/api/auth/login', { email: admin!.email, password: randomBytes(24).toString('base64url') })).status === 401, 'Wrong password was not rejected.');
  ensure((await request('/api/auth/me', undefined, 'invalid-token')).status === 401, 'Invalid token was not rejected.');
  const historical = execFileSync('git', ['show', '7e3dbcb:server.ts'], { encoding: 'utf8' });
  const oldKey = historical.match(/const JWT_SECRET\s*=\s*process\.env\.JWT_SECRET\s*\|\|\s*'([^']+)'/)?.[1];
  ensure(oldKey && oldKey !== secret, 'Rotation could not be verified.');
  const oldToken = jwt.sign({ id: admin!.id }, oldKey!, { expiresIn: '1h' });
  ensure((await request('/api/auth/me', undefined, oldToken)).status === 401, 'Historical token was not rejected.');
  ensure((await request('/api/auth/logout', {}, login.data.token)).status === 200, 'Logout failed.');
  ensure((await request('/api/auth/me', undefined, login.data.token)).status === 401, 'Logged-out token still works.');
  const again = await request('/api/auth/login', { email: admin!.email, password });
  ensure(again.status === 200, 'Repeat login failed.');
  password = '';
  ensure((await request('/api/auth/logout', {}, again.data.token)).status === 200, 'Verification session cleanup failed.');
  phase = 'database preservation verification';
  const finalClient = await pool.connect();
  try {
    const after = await store.load(finalClient);
    for (const key of Object.keys(before!) as (keyof typeof before)[]) {
      if (!['users', 'auditLogs', 'loginHistory'].includes(key)) ensure(isDeepStrictEqual(before![key], after[key]), `${key} changed.`);
    }
    for (const original of before!.users) {
      const current = after.users.find(u => u.id === original.id)! as AuthUser;
      if (original.id !== admin!.id) ensure(isDeepStrictEqual(current, original), 'Another user changed.');
      else {
        const identity = ({ passwordHash, sessionVersion, lastLogin, updatedAt, ...rest }: AuthUser) => rest;
        ensure(isDeepStrictEqual(identity(current), identity(original)), 'Administrator identity/permissions changed.');
        ensure(typeof current.passwordHash === 'string' && await bcrypt.getRounds(current.passwordHash) === 12, 'Expected bcrypt credential missing.');
      }
    }
    ensure(after.users.length === before!.users.length, 'User count changed.');
    for (const key of ['auditLogs','loginHistory'] as const) for (const previous of before![key] || []) ensure(isDeepStrictEqual(after[key]?.find(r => r.id === previous.id), previous), 'Existing audit history changed.');
    const month = monthSummary(after, '2026-09');
    report({ completed: true, enrolled: true, existingAdminPreserved: true, correctLogin: true, wrongPasswordRejected: true, invalidTokenRejected: true, historicalTokenRejected: true, protectedApi: true, logoutAndRelogin: true, operationalDataUnchanged: true, staff: after.staff.length, houses: after.houses.filter(h => !h.isDeleted).length, expected: month.expected, collected: month.collected, outstanding: month.remaining, expenses: after.expenses.filter(e=>e.status==='Approved'&&e.date.startsWith('2026-09')).reduce((s,e)=>s+e.amount,0), ledgerTransactions: after.ledger.length, expenseLedgerMatches: after.ledger.filter(e=>e.expenseId==='exp-1789805406010').length, authenticationAuditEntriesRetained: true });
  } finally { finalClient.release(); }
} catch {
  // Never print exception details: driver/assertion errors may contain credential values.
  report({ completed: false, enrolled, phase, message: enrolled ? 'Credential is enrolled; verification requires review. Do not reset or reenroll.' : 'Enrollment did not complete. No credential was committed.' });
  process.exitCode = 1;
} finally {
  password = '';
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  await closeApp?.();
  await pool.end();
}
