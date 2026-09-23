import type { Express, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { db } from './db';
import type { User } from '../src/types';

export type AuthUser = User & { passwordHash?: string; sessionVersion?: number };
type AuthRequest = Request & { user?: AuthUser };
export function requireJwtSecret(value = process.env.JWT_SECRET): string {
  if (!value || value.trim().length < 32) throw new Error('JWT_SECRET must be configured with at least 32 characters.');
  return value;
}
export function publicUser(user: User) {
  const { passwordHash, password, password_hash, sessionVersion, ...safe } = user as AuthUser & { password?: string; password_hash?: string };
  return safe;
}
export function issueToken(user: AuthUser, secret: string) {
  return jwt.sign({ id: user.id, sessionVersion: user.sessionVersion || 0 }, secret, {
    algorithm: 'HS256', expiresIn: '7d', issuer: 'madina-street-erp', audience: 'madina-street-erp',
  });
}
const enabled = (user: User) => user.active !== false && !['Inactive', 'Suspended'].includes(user.status || '');

export function registerAuthentication(app: Express, store: Pick<typeof db, 'get' | 'save' | 'logAudit' | 'logLogin'>, secret: string) {
  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const identifier = typeof (req.body.username ?? req.body.email) === 'string' ? String(req.body.username ?? req.body.email).trim().toLowerCase() : '';
      const password = req.body.password;
      const user = (store.get('users') as AuthUser[]).find(u => u.email.toLowerCase() === identifier || u.username?.toLowerCase() === identifier);
      if (!identifier || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72 || !user || !enabled(user) || !user.passwordHash || !/^\$2[aby]\$/.test(user.passwordHash) || !(await bcrypt.compare(password, user.passwordHash))) {
        return res.status(401).json({ success: false, message: 'Invalid credentials or account unavailable.' });
      }
      const token = issueToken(user, secret);
      user.lastLogin = user.updatedAt = new Date().toISOString();
      store.save();
      const ip = req.socket.remoteAddress || 'unknown';
      store.logLogin(user, { ip, userAgent: req.headers['user-agent'] || '' });
      store.logAudit(user, 'LOGIN', 'Authentication', 'Successful login', ip);
      return res.json({ success: true, user: publicUser(user), token });
    } catch (error) { next(error); }
  });

  app.use('/api', (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) return res.status(401).json({ success: false, message: 'Authentication required.' });
      const claims = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'], issuer: 'madina-street-erp', audience: 'madina-street-erp' });
      if (typeof claims === 'string' || typeof claims.id !== 'string' || typeof claims.exp !== 'number') throw new Error('Invalid token');
      const user = (store.get('users') as AuthUser[]).find(u => u.id === claims.id);
      if (!user || !enabled(user) || claims.sessionVersion !== (user.sessionVersion || 0)) throw new Error('Inactive session');
      req.user = user;
      next();
    } catch {
      res.status(401).json({ success: false, message: 'Session expired or invalid. Please sign in again.' });
    }
  });

  // User/role and backup administration must not allow a non-admin to promote itself.
  app.use(['/api/users', '/api/roles', '/api/system/restore', '/api/system/backups'], (req: AuthRequest, res, next) => {
    if (req.user?.role !== 'Administrator') return res.status(403).json({ success: false, message: 'Administrator access required.' });
    next();
  });
  app.get('/api/auth/me', (req: AuthRequest, res) => res.json({ success: true, user: publicUser(req.user!) }));
  app.post('/api/auth/logout', (req: AuthRequest, res) => {
    const user = req.user!;
    user.sessionVersion = (user.sessionVersion || 0) + 1;
    const latest = store.get('loginHistory')?.find(lh => lh.userId === user.id && !lh.logoutTime);
    if (latest) latest.logoutTime = new Date().toISOString();
    store.save();
    store.logAudit(user, 'LOGOUT', 'Authentication', 'Logged out; user sessions revoked');
    res.json({ success: true, message: 'Logged out successfully' });
  });
}
