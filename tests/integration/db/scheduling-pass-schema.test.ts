// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { branches, classOccurrences, classTemplates, passProducts, passes, users } from '@/server/db/schema';
import { getPostgresErrorCode, resetDatabase, testDb } from '../helpers/database';

const connection = testDb();
const db = connection.db;
describe('scheduling and pass schema', () => {
  beforeEach(async () => { await resetDatabase(); });
  afterAll(async () => { await connection.close(); });
  it('enforces scheduling, credit, and active product constraints', async () => {
    const [branch] = await db.insert(branches).values({ name: 'Test', address: 'Seoul' }).returning();
    const [member] = await db.insert(users).values({ role: 'MEMBER', phone: '01011112222', status: 'ACTIVE' }).returning();
    const [instructor] = await db.insert(users).values({ role: 'INSTRUCTOR', phone: '01033334444', status: 'ACTIVE' }).returning();
    const [template] = await db.insert(classTemplates).values({ branchId: branch.id, name: 'Yoga', weekday: 1, localStartTime: '09:00', durationMinutes: 60, defaultInstructorId: instructor.id, defaultCapacity: 10 }).returning();
    await db.insert(classOccurrences).values({ templateId: template.id, classDate: '2026-08-03', startsAt: new Date('2026-08-03T00:00:00Z'), endsAt: new Date('2026-08-03T01:00:00Z'), branchId: branch.id, capacity: 10 });
    let error: unknown;
    try { await db.insert(classOccurrences).values({ templateId: template.id, classDate: '2026-08-03', startsAt: new Date('2026-08-03T00:00:00Z'), endsAt: new Date('2026-08-03T01:00:00Z'), branchId: branch.id, capacity: 10 }); } catch (caught) { error = caught; }
    expect(getPostgresErrorCode(error)).toBe('23505');
    const [product] = await db.insert(passProducts).values({ name: 'Group', defaultCredits: 10, defaultValidDays: 30, defaultPrice: '100.00', isActive: true }).returning();
    try { await db.insert(passProducts).values({ name: 'Second', defaultCredits: 10, defaultValidDays: 30, defaultPrice: '100.00', isActive: true }); } catch (caught) { error = caught; }
    expect(getPostgresErrorCode(error)).toBe('23505');
    try { await db.insert(passes).values({ memberId: member.id, productId: product.id, sellingBranchId: branch.id, paidAmount: '100.00', totalCredits: 10, remainingCredits: 11, startsOn: '2026-08-01', expiresOn: '2026-08-31', issuedBy: instructor.id }); } catch (caught) { error = caught; }
    expect(getPostgresErrorCode(error)).toBe('23514');
  });
});
