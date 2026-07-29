// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { login } from '@/server/auth/login';
import { hashPassword, verifyPassword } from '@/server/auth/password';
import { createSession, getCurrentSession, logout, type CookieStore } from '@/server/auth/session';
import { hashSessionToken } from '@/server/auth/token';
import { sessions, users } from '@/server/db/schema';
import { resetDatabase, testDb } from '../helpers/database';

process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-bytes';

const connection = testDb();
const db = connection.db;
const sessionSecret = process.env.SESSION_SECRET;

function cookieStore(token?: string): CookieStore & { deleted: string[] } {
  let value = token;
  const deleted: string[] = [];

  return {
    get: (name) => name === 'lf_session' && value ? { value } : undefined,
    set: (name, nextValue) => { if (name === 'lf_session') value = nextValue; },
    delete: (name) => { if (name === 'lf_session') { value = undefined; deleted.push(name); } },
    deleted,
  };
}

describe('password login and opaque sessions', () => {
  beforeAll(async () => { await db.execute('select 1'); });
  beforeEach(async () => { await resetDatabase(); });
  afterAll(async () => {
    await connection.close();
  });

  it('logs in a normalized phone number and stores only an HMAC hash of its opaque session token', async () => {
    const password = 'correct-password';
    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(users).values({ role: 'MEMBER', phone: '01012345678', passwordHash, status: 'ACTIVE' }).returning();
    const beforeLogin = Date.now();

    const result = await login('010-1234-5678', password);
    const [sessionRow] = await db.select().from(sessions).where(eq(sessions.userId, user.id));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(sessionRow.tokenHash).not.toBe(result.value.token);
    expect(sessionRow.tokenHash).toBe(hashSessionToken(result.value.token, sessionSecret));
    expect(result.value.expiresAt.getTime()).toBeGreaterThanOrEqual(beforeLogin + 7 * 24 * 60 * 60 * 1000);
    expect(result.value.expiresAt.getTime()).toBeLessThan(beforeLogin + 7 * 24 * 60 * 60 * 1000 + 1_000);
  });

  it('returns the same invalid-credentials error for an unknown phone and an incorrect password', async () => {
    const passwordHash = await hashPassword('correct-password');
    await db.insert(users).values({ role: 'MEMBER', phone: '01012345678', passwordHash, status: 'ACTIVE' });

    await expect(login('010-9999-9999', 'incorrect-password')).resolves.toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
    await expect(login('010-1234-5678', 'incorrect-password')).resolves.toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });
  });

  it('performs bcrypt comparison for an unknown phone before returning invalid credentials', async () => {
    const passwordVerifier = vi.fn(verifyPassword);
    const loginWithVerifier = login as (phone: string, password: string, verifier: typeof verifyPassword) => ReturnType<typeof login>;

    await expect(loginWithVerifier('010-9999-9999', 'incorrect-password', passwordVerifier)).resolves.toEqual({ ok: false, error: 'INVALID_CREDENTIALS' });

    expect(passwordVerifier).toHaveBeenCalledOnce();
  });

  it('does not authenticate an expired session and removes a logged-out session', async () => {
    const [user] = await db.insert(users).values({ role: 'MEMBER', phone: '01012345678', status: 'ACTIVE' }).returning();
    const created = await createSession(user.id);
    const cookies = cookieStore(created.token);

    await db.update(sessions).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(sessions.tokenHash, hashSessionToken(created.token, sessionSecret)));
    await expect(getCurrentSession(cookies)).resolves.toBeNull();

    const activeSession = await createSession(user.id);
    cookies.set('lf_session', activeSession.token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
      expires: activeSession.expiresAt,
    });
    await logout(cookies);

    expect(cookies.deleted).toEqual(['lf_session', 'lf_session']);
    await expect(db.select().from(sessions).where(and(eq(sessions.userId, user.id), eq(sessions.tokenHash, hashSessionToken(activeSession.token, sessionSecret))))).resolves.toEqual([]);
  });
});
