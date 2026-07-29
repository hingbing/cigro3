// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createSession, type CookieStore } from '@/server/auth/session';
import { requireAssignedOccurrence, requireBranchAccess, requireOwnMember, requireRole } from '@/server/authorization/guards';
import { branches, classOccurrences, classTemplates, users } from '@/server/db/schema';
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

describe('server authorization guards', () => {
  beforeAll(async () => { await db.execute('select 1'); });
  beforeEach(async () => { await resetDatabase(); });
  afterAll(async () => { await connection.close(); });

  it('returns FORBIDDEN when a member attempts an administrator role', async () => {
    const [member] = await db.insert(users).values({ role: 'MEMBER', phone: '01011112222', status: 'ACTIVE' }).returning();

    await expect(requireRole(['HEAD_ADMIN', 'BRANCH_ADMIN'], await signedInAs(member.id))).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('limits a branch administrator to its assigned default branch', async () => {
    const [assignedBranch] = await db.insert(branches).values({ name: 'Gangnam', address: 'Seoul' }).returning();
    const [otherBranch] = await db.insert(branches).values({ name: 'Jamsil', address: 'Seoul' }).returning();
    const [admin] = await db.insert(users).values({ role: 'BRANCH_ADMIN', phone: '01022223333', status: 'ACTIVE', defaultBranchId: assignedBranch.id }).returning();
    const store = await signedInAs(admin.id);

    await expect(requireBranchAccess(assignedBranch.id, store)).resolves.toMatchObject({ ok: true, value: { userId: admin.id } });
    await expect(requireBranchAccess(otherBranch.id, store)).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('allows a member to access only its own member record', async () => {
    const [member] = await db.insert(users).values({ role: 'MEMBER', phone: '01033334444', status: 'ACTIVE' }).returning();
    const [otherMember] = await db.insert(users).values({ role: 'MEMBER', phone: '01055556666', status: 'ACTIVE' }).returning();
    const store = await signedInAs(member.id);

    await expect(requireOwnMember(member.id, store)).resolves.toMatchObject({ ok: true, value: { userId: member.id } });
    await expect(requireOwnMember(otherMember.id, store)).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('allows an instructor to read only an occurrence assigned to that instructor', async () => {
    const [branch] = await db.insert(branches).values({ name: 'Gangnam', address: 'Seoul' }).returning();
    const [instructor] = await db.insert(users).values({ role: 'INSTRUCTOR', phone: '01077778888', status: 'ACTIVE', defaultBranchId: branch.id }).returning();
    const [otherInstructor] = await db.insert(users).values({ role: 'INSTRUCTOR', phone: '01099990000', status: 'ACTIVE', defaultBranchId: branch.id }).returning();
    const [template] = await db.insert(classTemplates).values({ branchId: branch.id, name: 'Yoga', weekday: 1, localStartTime: '09:00', durationMinutes: 60, defaultInstructorId: instructor.id, defaultCapacity: 10 }).returning();
    const [assigned] = await db.insert(classOccurrences).values({ templateId: template.id, branchId: branch.id, classDate: '2026-08-03', startsAt: new Date('2026-08-03T00:00:00Z'), endsAt: new Date('2026-08-03T01:00:00Z'), instructorId: instructor.id, capacity: 10 }).returning();
    const [unassigned] = await db.insert(classOccurrences).values({ templateId: template.id, branchId: branch.id, classDate: '2026-08-10', startsAt: new Date('2026-08-10T00:00:00Z'), endsAt: new Date('2026-08-10T01:00:00Z'), instructorId: otherInstructor.id, capacity: 10 }).returning();
    const store = await signedInAs(instructor.id);

    await expect(requireAssignedOccurrence(assigned.id, store)).resolves.toMatchObject({ ok: true, value: { userId: instructor.id } });
    await expect(requireAssignedOccurrence(unassigned.id, store)).resolves.toEqual({ ok: false, error: 'FORBIDDEN' });
  });
});
