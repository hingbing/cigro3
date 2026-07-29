import { eq } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { systemClock } from '@/server/time/clock';
import { normalizePhone, verifyPassword } from './password';
import { createSession } from './session';

export type LoginResult =
  | { ok: true; value: { userId: string; token: string; expiresAt: Date } }
  | { ok: false; error: 'INVALID_CREDENTIALS' | 'ACCOUNT_DISABLED' };

const DUMMY_PASSWORD_HASH = '$2b$12$tZwjCbw3Q6hZk26uckkxzuEP.sI42FwrhCThchYw9GKsyND/ebE2q';

export async function login(phone: string, password: string, passwordVerifier = verifyPassword): Promise<LoginResult> {
  const [user] = await getDb().select().from(users).where(eq(users.phone, normalizePhone(phone)));
  const passwordMatches = await passwordVerifier(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) return { ok: false, error: 'INVALID_CREDENTIALS' };
  if (user.status === 'DISABLED') return { ok: false, error: 'ACCOUNT_DISABLED' };
  if (user.status !== 'ACTIVE') return { ok: false, error: 'INVALID_CREDENTIALS' };

  const session = await createSession(user.id);
  await getDb().update(users).set({ lastLoginAt: systemClock.now(), updatedAt: systemClock.now() }).where(eq(users.id, user.id));
  return { ok: true, value: { userId: user.id, ...session } };
}
