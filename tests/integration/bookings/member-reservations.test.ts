// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { branches, classOccurrences, classTemplates, passLedger, passProducts, passes, reservations, users } from '@/server/db/schema';
import { createReservation, cancelReservation } from '@/server/bookings/member-reservations';
import { resetDatabase, testDb } from '../helpers/database';

const connection = testDb(); const db = connection.db;
async function setup(capacity = 2) {
  const [branch] = await db.insert(branches).values({ name: 'Demo', address: 'Seoul' }).returning();
  const [member] = await db.insert(users).values({ role: 'MEMBER', phone: '01011112222', status: 'ACTIVE' }).returning();
  const [other] = await db.insert(users).values({ role: 'MEMBER', phone: '01033334444', status: 'ACTIVE' }).returning();
  const [instructor] = await db.insert(users).values({ role: 'INSTRUCTOR', phone: '01055556666', status: 'ACTIVE' }).returning();
  const [template] = await db.insert(classTemplates).values({ branchId: branch.id, name: 'Yoga', weekday: 1, localStartTime: '09:00', durationMinutes: 60, defaultInstructorId: instructor.id, defaultCapacity: capacity }).returning();
  const start = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); const end = new Date(start.getTime() + 3600000);
  const [occurrence] = await db.insert(classOccurrences).values({ templateId: template.id, classDate: '2030-01-01', startsAt: start, endsAt: end, branchId: branch.id, instructorId: instructor.id, capacity }).returning();
  const [product] = await db.insert(passProducts).values({ name: 'Demo pass', defaultCredits: 2, defaultValidDays: 30, defaultPrice: '1', isActive: true }).returning();
  const issue = async (userId: string) => (await db.insert(passes).values({ memberId: userId, productId: product.id, sellingBranchId: branch.id, paidAmount: '1', totalCredits: 2, remainingCredits: 2, startsOn: '2020-01-01', expiresOn: '2040-01-01', issuedBy: instructor.id }).returning())[0];
  return { member, other, occurrence, pass: await issue(member.id), otherPass: await issue(other.id) };
}
describe('member reservations', () => { beforeEach(resetDatabase); afterAll(() => connection.close());
  it('debits once, rejects duplicate/capacity, and restores once on cancellation', async () => {
    const { member, other, occurrence, pass, otherPass } = await setup(1);
    const booked = await createReservation({ memberId: member.id, occurrenceId: occurrence.id, passId: pass.id }); expect(booked.ok).toBe(true);
    expect((await db.select().from(passes).where(eq(passes.id, pass.id)))[0].remainingCredits).toBe(1);
    await expect(createReservation({ memberId: member.id, occurrenceId: occurrence.id, passId: pass.id })).resolves.toEqual({ ok: false, error: 'ALREADY_BOOKED' });
    await expect(createReservation({ memberId: other.id, occurrenceId: occurrence.id, passId: otherPass.id })).resolves.toEqual({ ok: false, error: 'CLASS_FULL' });
    if (!booked.ok) return; expect(await cancelReservation({ memberId: member.id, reservationId: booked.value.id })).toEqual({ ok: true });
    expect((await db.select().from(passes).where(eq(passes.id, pass.id)))[0].remainingCredits).toBe(2);
    expect(await db.select().from(passLedger).where(eq(passLedger.reservationId, booked.value.id))).toHaveLength(2);
  });
});
