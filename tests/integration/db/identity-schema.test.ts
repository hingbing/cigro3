// @vitest-environment node
import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { branches, invitations, sessions, users } from '@/server/db/schema';
import { getPostgresErrorCode, resetDatabase, testDb } from '../helpers/database';

const connection = testDb();
const db = connection.db;
const branch = { name: 'Test Branch', address: 'Seoul' };
const user = { role: 'MEMBER' as const, phone: '01012345678', status: 'ACTIVE' as const };

describe('identity schema', () => {
  beforeAll(async () => { await db.execute('select 1'); });
  beforeEach(async () => { await resetDatabase(); });
  afterAll(async () => { await connection.close(); });

  it('enforces normalized phone uniqueness and token uniqueness', async () => {
    const [createdBranch] = await db.insert(branches).values(branch).returning();
    const [createdUser] = await db.insert(users).values({ ...user, defaultBranchId: createdBranch.id }).returning();
    let error: unknown;
    try { await db.insert(users).values({ ...user, phone: user.phone }); } catch (caught) { error = caught; }
    expect(getPostgresErrorCode(error)).toBe('23505');
    await db.insert(invitations).values({ userId: createdUser.id, purpose: 'INVITE', tokenHash: 'same', expiresAt: new Date(Date.now() + 60_000) });
    try { await db.insert(invitations).values({ userId: createdUser.id, purpose: 'INVITE', tokenHash: 'same', expiresAt: new Date(Date.now() + 60_000) }); } catch (caught) { error = caught; }
    expect(getPostgresErrorCode(error)).toBe('23505');
    await db.insert(sessions).values({ userId: createdUser.id, tokenHash: 'session', expiresAt: new Date(Date.now() + 60_000) });
    try { await db.insert(sessions).values({ userId: createdUser.id, tokenHash: 'session', expiresAt: new Date(Date.now() + 60_000) }); } catch (caught) { error = caught; }
    expect(getPostgresErrorCode(error)).toBe('23505');
    expect((await db.select().from(users).where(eq(users.id, createdUser.id))).length).toBe(1);
  });
});
