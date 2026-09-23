import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { registerAuthentication, requireJwtSecret, type AuthUser } from '../server/auth';

let checks = 0;
const check = (value: unknown, message: string) => { assert.ok(value, message); checks++; };
assert.throws(() => requireJwtSecret(''), /JWT_SECRET/); checks++;
assert.throws(() => requireJwtSecret('short'), /JWT_SECRET/); checks++;
const missing = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', "await import('./server.ts')"], { encoding: 'utf8', env: { ...process.env, JWT_SECRET: '', MADINA_TEST_MODE: '1' } });
check(missing.status !== 0 && missing.stderr.includes('JWT_SECRET must be configured'), 'Actual server import fails safely without JWT_SECRET');
const secret = randomBytes(64).toString('base64url');
const password = randomBytes(24).toString('base64url');
const fixture: AuthUser = { id: 'isolated-auth-user', name: 'Isolated verification', email: 'test@example.invalid', username: 'test-user', role: 'Administrator', active: true, status: 'Active', createdAt: new Date().toISOString(), passwordHash: await bcrypt.hash(password, 10) };
const state = { users: [fixture], loginHistory: [] as any[], auditLogs: [] as any[] };
let saves = 0;
const store = { get: (key: keyof typeof state) => state[key], save: () => { saves++; }, logLogin: () => {}, logAudit: () => {} };
const app = express(); app.use(express.json()); registerAuthentication(app, store as any, secret);
app.get('/api/private', (_req, res) => res.json({ success: true }));
app.get('/api/users', (_req, res) => res.json({ success: true }));
const server = app.listen(0, '127.0.0.1'); await new Promise<void>(r => server.once('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;
const request = async (path: string, body?: unknown, token?: string) => {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() as any };
};
try {
  const before = JSON.stringify(state);
  check((await request('/api/private')).status === 401, 'Missing token rejected');
  for (const body of [{}, { email: fixture.email }, { email: fixture.email, password: 'wrong' }, { email: 'missing@example.invalid', password }, { role: 'Administrator' }]) check((await request('/api/auth/login', body)).status === 401, 'Invalid credentials and role-only login rejected');
  check(saves === 0 && JSON.stringify(state) === before, 'Rejected authentication does not modify users');
  const login = await request('/api/auth/login', { email: fixture.email, password });
  check(login.status === 200 && typeof login.data.token === 'string', 'Correct password issues token');
  check(!('passwordHash' in login.data.user) && !('sessionVersion' in login.data.user), 'Sensitive user fields omitted');
  const token = login.data.token;
  check((await request('/api/private', undefined, token)).status === 200, 'New token accesses protected API');
  check((await request('/api/auth/me', undefined, token)).data.user.id === fixture.id, 'Session reload succeeds');
  check((await request('/api/auth/me', undefined, token)).data.user.passwordHash === undefined, 'Session endpoint redacts hash');
  const historical = execFileSync('git', ['show', '7e3dbcb:server.ts'], { encoding: 'utf8' });
  const oldSecret = historical.match(/const JWT_SECRET\s*=\s*process\.env\.JWT_SECRET\s*\|\|\s*'([^']+)'/)?.[1];
  if (!oldSecret) throw new Error('Historical key unavailable for rotation verification');
  const options = { algorithm: 'HS256' as const, issuer: 'madina-street-erp', audience: 'madina-street-erp', expiresIn: 60 };
  const payload = { id: fixture.id, sessionVersion: 0 };
  const rejected = [
    jwt.sign(payload, oldSecret, options),
    jwt.sign(payload, secret, { ...options, expiresIn: -1 }),
    jwt.sign(payload, secret, { ...options, audience: 'wrong' }),
    jwt.sign(payload, secret, { ...options, algorithm: 'HS384' }),
    jwt.sign({ ...payload, id: 'deleted-user' }, secret, options),
    token.slice(0, -5) + 'xxxxx',
  ];
  for (const invalid of rejected) check((await request('/api/private', undefined, invalid)).status === 401, 'Old, expired, wrong-audience/algorithm, unknown-user and modified tokens rejected');
  fixture.status = 'Suspended';
  check((await request('/api/private', undefined, token)).status === 401, 'Suspended session rejected');
  check((await request('/api/auth/login', { email: fixture.email, password })).status === 401, 'Suspended login rejected');
  fixture.status = 'Active'; fixture.role = 'Viewer';
  check((await request('/api/users', undefined, token)).status === 403, 'Stored role controls administrator access');
  fixture.role = 'Administrator';
  check((await request('/api/auth/logout', {}, token)).status === 200, 'Logout succeeds');
  check((await request('/api/private', undefined, token)).status === 401, 'Logged-out token revoked');
  check((await request('/api/auth/login', { username: fixture.username, password })).status === 200, 'Username login succeeds after logout');
  delete fixture.passwordHash;
  check((await request('/api/auth/login', { email: fixture.email, password })).status === 401, 'Unenrolled real-style account fails closed');
  console.log(`PASS: ${checks} authentication checks; isolated users only; no real user/password/database changes.`);
} finally { await new Promise<void>(r => server.close(() => r())); }
