import { and, eq, gt } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { sessions, users } from '@/server/db/schema';
import { systemClock } from '@/server/time/clock';
import { createOpaqueToken, getSessionSecret, hashSessionToken } from './token';

export const SESSION_COOKIE_NAME = 'lf_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface CookieStore {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: { httpOnly: true; sameSite: 'lax'; path: '/'; secure: boolean; expires: Date }): void;
  delete(name: string): void;
}

export type CurrentSession = {
  userId: string;
  expiresAt: Date;
  role: 'HEAD_ADMIN' | 'BRANCH_ADMIN' | 'INSTRUCTOR' | 'MEMBER';
  defaultBranchId: string | null;
};

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = createOpaqueToken();
  const expiresAt = new Date(systemClock.now().getTime() + SESSION_DURATION_MS);
  await getDb().insert(sessions).values({ userId, tokenHash: hashSessionToken(token, getSessionSecret()), expiresAt });
  return { token, expiresAt };
}

export async function getCurrentSession(cookieStore: CookieStore): Promise<CurrentSession | null> {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const db = getDb();
  const tokenHash = hashSessionToken(token, getSessionSecret());
  const now = systemClock.now();
  const [current] = await db.select({
    userId: sessions.userId,
    expiresAt: sessions.expiresAt,
    role: users.role,
    defaultBranchId: users.defaultBranchId,
  }).from(sessions).innerJoin(users, eq(users.id, sessions.userId)).where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now), eq(users.status, 'ACTIVE')));

  if (current) return current;

  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
  cookieStore.delete(SESSION_COOKIE_NAME);
  return null;
}

export async function requireSession(cookieStore: CookieStore): Promise<CurrentSession> {
  const currentSession = await getCurrentSession(cookieStore);
  if (!currentSession) throw new Error('UNAUTHENTICATED');
  return currentSession;
}

export async function logout(cookieStore: CookieStore): Promise<void> {
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(token, getSessionSecret())));
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export function setSessionCookie(cookieStore: CookieStore, token: string, expiresAt: Date): void {
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV !== 'development',
    expires: expiresAt,
  });
}
