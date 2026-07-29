import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { classOccurrences, reservations, waitlistEntries } from '@/server/db/schema';
import { systemClock } from '@/server/time/clock';
import { evaluateWaitlistWindow } from './waitlist-window';

export type WaitlistResult = { ok: true } | { ok: false; error: 'ALREADY_WAITING' | 'ALREADY_BOOKED' | 'SEATS_AVAILABLE' | 'WINDOW_CLOSED' | 'FAILED' };

export async function joinWaitlist(input: { memberId: string; occurrenceId: string }): Promise<WaitlistResult> {
  try {
    return await getDb().transaction(async (tx) => {
      const [occurrence] = await tx.select().from(classOccurrences).where(eq(classOccurrences.id, input.occurrenceId));
      if (!occurrence || occurrence.status !== 'NORMAL' || evaluateWaitlistWindow(systemClock.now(), occurrence.startsAt) === 'CLOSED') return { ok: false, error: 'WINDOW_CLOSED' };
      await tx.execute(sql`select id from class_occurrences where id = ${input.occurrenceId} for update`);
      const [booked] = await tx.select({ id: reservations.id }).from(reservations).where(and(eq(reservations.memberId, input.memberId), eq(reservations.occurrenceId, input.occurrenceId), eq(reservations.status, 'CONFIRMED')));
      if (booked) return { ok: false, error: 'ALREADY_BOOKED' };
      const [existing] = await tx.select({ id: waitlistEntries.id }).from(waitlistEntries).where(and(eq(waitlistEntries.memberId, input.memberId), eq(waitlistEntries.occurrenceId, input.occurrenceId), eq(waitlistEntries.status, 'WAITING')));
      if (existing) return { ok: false, error: 'ALREADY_WAITING' };
      const occupied = await tx.execute<{ count: string }>(sql`select count(*)::text as count from reservations where occurrence_id = ${input.occurrenceId} and status = 'CONFIRMED'`);
      if (Number(occupied[0]?.count ?? 0) < occurrence.capacity) return { ok: false, error: 'SEATS_AVAILABLE' };
      await tx.insert(waitlistEntries).values({ memberId: input.memberId, occurrenceId: input.occurrenceId, status: 'WAITING' });
      return { ok: true };
    });
  } catch { return { ok: false, error: 'FAILED' }; }
}

export async function cancelWaitlist(input: { memberId: string; occurrenceId: string }): Promise<WaitlistResult> {
  try {
    const changed = await getDb().update(waitlistEntries).set({ status: 'CANCELLED', resolvedAt: systemClock.now(), resolutionReason: 'MEMBER_CANCELLED' }).where(and(eq(waitlistEntries.memberId, input.memberId), eq(waitlistEntries.occurrenceId, input.occurrenceId), eq(waitlistEntries.status, 'WAITING'))).returning({ id: waitlistEntries.id });
    return changed.length ? { ok: true } : { ok: false, error: 'FAILED' };
  } catch { return { ok: false, error: 'FAILED' }; }
}
