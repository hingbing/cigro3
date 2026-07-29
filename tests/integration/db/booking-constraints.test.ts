// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { branches, classOccurrences, classTemplates, passProducts, passes, users } from '@/server/db/schema';
import { getPostgresErrorCode, resetDatabase, testDb } from '../helpers/database';

const connection = testDb();
const db = connection.db;

async function fixture() {
  const [branch] = await db.insert(branches).values({ name: 'Test', address: 'Seoul' }).returning();
  const [member] = await db.insert(users).values({ role: 'MEMBER', phone: '01011112222', status: 'ACTIVE' }).returning();
  const [otherMember] = await db.insert(users).values({ role: 'MEMBER', phone: '01033334444', status: 'ACTIVE' }).returning();
  const [instructor] = await db.insert(users).values({ role: 'INSTRUCTOR', phone: '01055556666', status: 'ACTIVE' }).returning();
  const [template] = await db.insert(classTemplates).values({ branchId: branch.id, name: 'Yoga', weekday: 1, localStartTime: '09:00', durationMinutes: 60, defaultInstructorId: instructor.id, defaultCapacity: 10 }).returning();
  const occurrence = async (classDate: string, startsAt: string, endsAt: string) => (await db.insert(classOccurrences).values({ templateId: template.id, classDate, startsAt: new Date(startsAt), endsAt: new Date(endsAt), branchId: branch.id, capacity: 10 }).returning())[0];
  const first = await occurrence('2026-08-03', '2026-08-03T00:00:00Z', '2026-08-03T01:00:00Z');
  const overlapping = await occurrence('2026-08-04', '2026-08-03T00:30:00Z', '2026-08-03T01:30:00Z');
  const adjacent = await occurrence('2026-08-05', '2026-08-03T01:00:00Z', '2026-08-03T02:00:00Z');
  const [product] = await db.insert(passProducts).values({ name: 'Group', defaultCredits: 10, defaultValidDays: 30, defaultPrice: '100.00', isActive: true }).returning();
  const [pass] = await db.insert(passes).values({ memberId: member.id, productId: product.id, sellingBranchId: branch.id, paidAmount: '100.00', totalCredits: 10, remainingCredits: 10, startsOn: '2026-08-01', expiresOn: '2026-08-31', issuedBy: instructor.id }).returning();
  return { member, otherMember, first, overlapping, adjacent, pass };
}

async function errorCode(action: () => Promise<unknown>) {
  try { await action(); } catch (error) { return getPostgresErrorCode(error); }
  return undefined;
}

describe('booking constraints', () => {
  beforeEach(async () => { await resetDatabase(); });
  afterAll(async () => { await connection.close(); });

  it('rejects overlapping confirmed reservations but allows adjacent reservations', async () => {
    const { member, first, overlapping, adjacent, pass } = await fixture();
    await db.execute(sql`INSERT INTO reservations (member_id, occurrence_id, pass_id, status, request_id) VALUES (${member.id}, ${first.id}, ${pass.id}, 'CONFIRMED', 'first')`);
    expect(await errorCode(() => db.execute(sql`INSERT INTO reservations (member_id, occurrence_id, pass_id, status, request_id) VALUES (${member.id}, ${overlapping.id}, ${pass.id}, 'CONFIRMED', 'overlap')`))).toBe('23P01');
    await expect(db.execute(sql`INSERT INTO reservations (member_id, occurrence_id, pass_id, status, request_id) VALUES (${member.id}, ${adjacent.id}, ${pass.id}, 'CONFIRMED', 'adjacent')`)).resolves.toBeDefined();
  });

  it('enforces reservation, waitlist, ledger, and notification idempotency keys', async () => {
    const { member, otherMember, first, adjacent, pass } = await fixture();
    await db.execute(sql`INSERT INTO reservations (member_id, occurrence_id, pass_id, status, request_id) VALUES (${member.id}, ${first.id}, ${pass.id}, 'CONFIRMED', 'same-request')`);
    expect(await errorCode(() => db.execute(sql`INSERT INTO reservations (member_id, occurrence_id, pass_id, status, request_id) VALUES (${otherMember.id}, ${adjacent.id}, ${pass.id}, 'CONFIRMED', 'same-request')`))).toBe('23505');
    expect(await errorCode(() => db.execute(sql`INSERT INTO reservations (member_id, occurrence_id, pass_id, status, request_id) VALUES (${member.id}, ${first.id}, ${pass.id}, 'CONFIRMED', 'same-occurrence')`))).toBe('23505');
    await db.execute(sql`INSERT INTO waitlist_entries (member_id, occurrence_id, status) VALUES (${member.id}, ${adjacent.id}, 'WAITING')`);
    expect(await errorCode(() => db.execute(sql`INSERT INTO waitlist_entries (member_id, occurrence_id, status) VALUES (${member.id}, ${adjacent.id}, 'OFFERED')`))).toBe('23505');
    await db.execute(sql`INSERT INTO pass_ledger (pass_id, type, delta, dedupe_key) VALUES (${pass.id}, 'ISSUE', 10, 'ledger-key')`);
    expect(await errorCode(() => db.execute(sql`INSERT INTO pass_ledger (pass_id, type, delta, dedupe_key) VALUES (${pass.id}, 'ISSUE', 10, 'ledger-key')`))).toBe('23505');
    await db.execute(sql`INSERT INTO notifications (member_id, type, title, body, target_path, dedupe_key) VALUES (${member.id}, 'RESERVATION_CONFIRMED', 'Reserved', 'Your reservation is confirmed', '/reservations', 'notification-key')`);
    expect(await errorCode(() => db.execute(sql`INSERT INTO notifications (member_id, type, title, body, target_path, dedupe_key) VALUES (${member.id}, 'RESERVATION_CONFIRMED', 'Reserved', 'Your reservation is confirmed', '/reservations', 'notification-key')`))).toBe('23505');
  });
});
