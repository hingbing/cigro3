// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { consumeInvitation, consumePasswordReset, createMemberAndInvitation, createPasswordReset } from '@/server/auth/invitations';
import { hashPassword } from '@/server/auth/password';
import { createSession } from '@/server/auth/session';
import { hashToken } from '@/server/auth/token';
import { branches, invitations, sessions, users } from '@/server/db/schema';
import { resetDatabase, testDb } from '../helpers/database';

const connection = testDb();
const db = connection.db;

process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-bytes';

async function createBranch() {
  const [branch] = await db.insert(branches).values({ name: 'Gangnam', address: 'Seoul' }).returning();
  return branch;
}

describe('managed member invitations', () => {
  beforeAll(async () => { await db.execute('select 1'); });
  beforeEach(async () => { await resetDatabase(); });
  afterAll(async () => { await connection.close(); });

  it('creates a normalized, invited member and returns a one-time invitation that expires in seven days', async () => {
    const branch = await createBranch();
    const before = Date.now();

    const result = await createMemberAndInvitation({ phone: '010-1234-5678', defaultBranchId: branch.id });
    const [member] = await db.select().from(users).where(eq(users.id, result.memberId));
    const [token] = await db.select().from(invitations).where(eq(invitations.userId, result.memberId));

    expect(member).toMatchObject({ phone: '01012345678', role: 'MEMBER', status: 'INVITED', defaultBranchId: branch.id, passwordHash: null });
    expect(token).toMatchObject({ purpose: 'INVITE', usedAt: null, invalidatedAt: null });
    expect(token.tokenHash).not.toBe(result.rawToken);
    expect(token.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 7 * 24 * 60 * 60 * 1000);
    expect(token.expiresAt.getTime()).toBeLessThan(before + 7 * 24 * 60 * 60 * 1000 + 1_000);

    await expect(consumeInvitation(result.rawToken, 'new-password')).resolves.toMatchObject({ ok: true, value: { userId: result.memberId } });
    await expect(consumeInvitation(result.rawToken, 'new-password')).resolves.toEqual({ ok: false, error: 'TOKEN_INVALID' });
    await expect(db.select().from(users).where(eq(users.id, result.memberId))).resolves.toEqual([expect.objectContaining({ status: 'ACTIVE', passwordHash: expect.any(String) })]);
  });

  it('rejects an expired invitation using the database expiry timestamp', async () => {
    const branch = await createBranch();
    const invitation = await createMemberAndInvitation({ phone: '010-1234-5678', defaultBranchId: branch.id });

    await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(invitations.userId, invitation.memberId));

    await expect(consumeInvitation(invitation.rawToken, 'new-password')).resolves.toEqual({ ok: false, error: 'TOKEN_INVALID' });
    await expect(db.select().from(users).where(eq(users.id, invitation.memberId))).resolves.toEqual([expect.objectContaining({ status: 'INVITED', passwordHash: null })]);
  });

  it('reissues an invitation for the same invited member by invalidating the old one without creating another user', async () => {
    const branch = await createBranch();
    const first = await createMemberAndInvitation({ phone: '010-1234-5678', defaultBranchId: branch.id });

    const second = await createMemberAndInvitation({ phone: '01012345678', defaultBranchId: branch.id });
    const [oldToken] = await db.select().from(invitations).where(eq(invitations.tokenHash, hashToken(first.rawToken)));

    expect(second.memberId).toBe(first.memberId);
    expect(oldToken).toMatchObject({ purpose: 'INVITE', invalidatedAt: expect.any(Date), usedAt: null });
    await expect(db.select().from(users).where(eq(users.phone, '01012345678'))).resolves.toHaveLength(1);
    await expect(consumeInvitation(first.rawToken, 'new-password')).resolves.toEqual({ ok: false, error: 'TOKEN_INVALID' });
    await expect(consumeInvitation(second.rawToken, 'new-password')).resolves.toMatchObject({ ok: true, value: { userId: first.memberId } });
  });

  it('invalidates an unused reset token before issuing another reset token for the same member', async () => {
    const passwordHash = await hashPassword('old-password');
    const [member] = await db.insert(users).values({ role: 'MEMBER', phone: '01012345678', passwordHash, status: 'ACTIVE' }).returning();
    const first = await createPasswordReset(member.id);
    const second = await createPasswordReset(member.id);
    const [firstToken] = await db.select().from(invitations).where(eq(invitations.tokenHash, hashToken(first.rawToken)));
    const [secondToken] = await db.select().from(invitations).where(eq(invitations.tokenHash, hashToken(second.rawToken)));

    expect(firstToken).toMatchObject({ purpose: 'PASSWORD_RESET', invalidatedAt: expect.any(Date), usedAt: null });
    expect(secondToken).toMatchObject({ purpose: 'PASSWORD_RESET', invalidatedAt: null, usedAt: null });
    await expect(consumePasswordReset(first.rawToken, 'new-password')).resolves.toEqual({ ok: false, error: 'TOKEN_INVALID' });
  });

  it('expires password reset tokens after thirty minutes and revokes all sessions when one is consumed', async () => {
    const passwordHash = await hashPassword('old-password');
    const [member] = await db.insert(users).values({ role: 'MEMBER', phone: '01012345678', passwordHash, status: 'ACTIVE' }).returning();
    const expired = await createPasswordReset(member.id);
    const [expiredRow] = await db.select().from(invitations).where(eq(invitations.tokenHash, hashToken(expired.rawToken)));
    expect(expiredRow.expiresAt.getTime()).toBeGreaterThanOrEqual(Date.now() + 30 * 60 * 1000 - 1_000);
    expect(expiredRow.expiresAt.getTime()).toBeLessThan(Date.now() + 30 * 60 * 1000 + 1_000);
    await db.update(invitations).set({ expiresAt: new Date(Date.now() - 1) }).where(eq(invitations.id, expiredRow.id));
    await expect(consumePasswordReset(expired.rawToken, 'new-password')).resolves.toEqual({ ok: false, error: 'TOKEN_INVALID' });

    const reset = await createPasswordReset(member.id);
    await createSession(member.id);
    await createSession(member.id);
    await expect(consumePasswordReset(reset.rawToken, 'new-password')).resolves.toMatchObject({ ok: true, value: { userId: member.id } });
    await expect(db.select().from(sessions).where(eq(sessions.userId, member.id))).resolves.toEqual([]);
    await expect(db.select().from(users).where(eq(users.id, member.id))).resolves.toEqual([expect.objectContaining({ passwordHash: expect.any(String) })]);
    await expect(consumePasswordReset(reset.rawToken, 'new-password')).resolves.toEqual({ ok: false, error: 'TOKEN_INVALID' });
  });
});
