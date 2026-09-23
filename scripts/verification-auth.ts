import { issueToken, requireJwtSecret, type AuthUser } from '../server/auth';
import type { User } from '../src/types';

// Operator-run regression scripts already have server credentials. Sign only in
// memory so they can read protected APIs without logging in or modifying users.
// This verifies API authentication, not the real user's password enrollment.
export function verificationAuthorization(users: User[]) {
  const user = users.find(u => u.role === 'Administrator' && u.active !== false && !['Inactive', 'Suspended'].includes(u.status || ''));
  if (!user) throw new Error('An active administrator is required for API verification.');
  return { Authorization: `Bearer ${issueToken(user as AuthUser, requireJwtSecret())}` };
}
