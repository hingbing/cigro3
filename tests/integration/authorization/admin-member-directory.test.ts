// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSession, type CookieStore } from '@/server/auth/session';
import { getAdminMemberDirectory } from '@/server/members/admin-member-directory';
import { branches, users } from '@/server/db/schema';
import { resetDatabase, testDb } from '../helpers/database';

const connection = testDb();
const db = connection.db;

process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-bytes';

function cookieStore(token: string): CookieStore {
  return {
    get: (name) => name === 'lf_session' ? { value: token } : undefined,
    set: () => undefined,
    delete: () => undefined,
  };
}

async function signedInAs(userId: string): Promise<CookieStore> {
  const session = await createSession(userId);
  return cookieStore(session.token);
}

describe('admin member directory authorization', () => {
  beforeAll(async () => { await db.execute('select 1'); });
  beforeEach(async () => { await resetDatabase(); });
  afterAll(async () => { await connection.close(); });

  it('returns every branch and member to a head administrator', async () => {
    const [gangnam] = await db.insert(branches).values({ name: 'Gangnam', address: 'Seoul' }).returning();
    const [jamsil] = await db.insert(branches).values({ name: 'Jamsil', address: 'Seoul' }).returning();
    const [headAdmin] = await db.insert(users).values({ role: 'HEAD_ADMIN', phone: '01011112222', status: 'ACTIVE' }).returning();
    const [gangnamMember] = await db.insert(users).values({ role: 'MEMBER', phone: '01022223333', status: 'ACTIVE', defaultBranchId: gangnam.id }).returning();
    const [jamsilMember] = await db.insert(users).values({ role: 'MEMBER', phone: '01033334444', status: 'ACTIVE', defaultBranchId: jamsil.id }).returning();

    const result = await getAdminMemberDirectory(await signedInAs(headAdmin.id));

    expect(result).toEqual({
      ok: true,
      value: {
        branches: expect.arrayContaining([{ id: gangnam.id, name: 'Gangnam' }, { id: jamsil.id, name: 'Jamsil' }]),
        members: expect.arrayContaining([{ id: gangnamMember.id, phone: '01022223333' }, { id: jamsilMember.id, phone: '01033334444' }]),
      },
    });
  });

  it('returns only the assigned branch and its members to a branch administrator', async () => {
    const [gangnam] = await db.insert(branches).values({ name: 'Gangnam', address: 'Seoul' }).returning();
    const [jamsil] = await db.insert(branches).values({ name: 'Jamsil', address: 'Seoul' }).returning();
    const [branchAdmin] = await db.insert(users).values({ role: 'BRANCH_ADMIN', phone: '01044445555', status: 'ACTIVE', defaultBranchId: gangnam.id }).returning();
    const [gangnamMember] = await db.insert(users).values({ role: 'MEMBER', phone: '01066667777', status: 'ACTIVE', defaultBranchId: gangnam.id }).returning();
    await db.insert(users).values({ role: 'MEMBER', phone: '01088889999', status: 'ACTIVE', defaultBranchId: jamsil.id });

    const result = await getAdminMemberDirectory(await signedInAs(branchAdmin.id));

    expect(result).toEqual({
      ok: true,
      value: {
        branches: [{ id: gangnam.id, name: 'Gangnam' }],
        members: [{ id: gangnamMember.id, phone: '01066667777' }],
      },
    });
  });

  it('returns FORBIDDEN without reading the directory for a non-administrator', async () => {
    const [member] = await db.insert(users).values({ role: 'MEMBER', phone: '01000001111', status: 'ACTIVE' }).returning();

    await expect(getAdminMemberDirectory(await signedInAs(member.id))).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
  });
});
