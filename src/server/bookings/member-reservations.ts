import { and, eq, sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { classOccurrences, passLedger, passes, reservations } from '@/server/db/schema';
import { evaluateBookingWindow } from './booking-window';
import { selectPass } from '@/server/passes/select-pass';
import { systemClock } from '@/server/time/clock';

export type BookingResult = { ok: true; value: { id: string } } | { ok: false; error: 'FORBIDDEN' | 'PASS_UNAVAILABLE' | 'ALREADY_BOOKED' | 'CLASS_FULL' | 'BOOKING_CLOSED' };
export type CancelResult = { ok: true } | { ok: false; error: 'FORBIDDEN' | 'CANCELLATION_CLOSED' };

export async function createReservation(input: { memberId: string; occurrenceId: string; passId: string }): Promise<BookingResult> {
  try {
    return await getDb().transaction(async tx => {
      const [occurrence] = await tx.select().from(classOccurrences).where(eq(classOccurrences.id, input.occurrenceId));
      if (!occurrence || occurrence.status !== 'NORMAL' || !evaluateBookingWindow(systemClock.now(), occurrence.startsAt).canBook) return { ok: false, error: 'BOOKING_CLOSED' };
      await tx.execute(sql`select id from class_occurrences where id = ${input.occurrenceId} for update`);
      const existing = await tx.select({ id: reservations.id }).from(reservations).where(and(eq(reservations.memberId, input.memberId), eq(reservations.occurrenceId, input.occurrenceId), eq(reservations.status, 'CONFIRMED')));
      if (existing.length) return { ok: false, error: 'ALREADY_BOOKED' };
      const occupied = await tx.execute<{ count: string }>(sql`select count(*)::text as count from reservations where occurrence_id = ${input.occurrenceId} and status = 'CONFIRMED'`);
      if (Number(occupied[0].count) >= occurrence.capacity) return { ok: false, error: 'CLASS_FULL' };
      const candidates = await tx.select().from(passes).where(eq(passes.memberId, input.memberId));
      const selected = selectPass(candidates, occurrence.startsAt);
      if (!selected || selected.id !== input.passId) return { ok: false, error: 'PASS_UNAVAILABLE' };
      const [reservation] = await tx.insert(reservations).values({ memberId: input.memberId, occurrenceId: input.occurrenceId, passId: input.passId, requestId: crypto.randomUUID(), startsAt: occurrence.startsAt, endsAt: occurrence.endsAt }).returning({ id: reservations.id });
      await tx.update(passes).set({ remainingCredits: sql`${passes.remainingCredits} - 1` }).where(and(eq(passes.id, input.passId), eq(passes.memberId, input.memberId)));
      await tx.insert(passLedger).values({ passId: input.passId, reservationId: reservation.id, type: 'RESERVATION_DEBIT', delta: -1, dedupeKey: `reservation:${reservation.id}:debit` });
      return { ok: true, value: reservation };
    });
  } catch { return { ok: false, error: 'ALREADY_BOOKED' }; }
}

export async function cancelReservation(input: { memberId: string; reservationId: string }): Promise<CancelResult> {
  return getDb().transaction(async tx => {
    const [reservation] = await tx.select().from(reservations).where(and(eq(reservations.id, input.reservationId), eq(reservations.memberId, input.memberId), eq(reservations.status, 'CONFIRMED')));
    if (!reservation) return { ok: false, error: 'FORBIDDEN' };
    if (!evaluateBookingWindow(systemClock.now(), reservation.startsAt).canCancel) return { ok: false, error: 'CANCELLATION_CLOSED' };
    const changed = await tx.update(reservations).set({ status: 'MEMBER_CANCELLED', cancelledAt: systemClock.now() }).where(and(eq(reservations.id, reservation.id), eq(reservations.status, 'CONFIRMED'))).returning({ id: reservations.id });
    if (!changed.length) return { ok: false, error: 'FORBIDDEN' };
    await tx.update(passes).set({ remainingCredits: sql`${passes.remainingCredits} + 1` }).where(eq(passes.id, reservation.passId));
    await tx.insert(passLedger).values({ passId: reservation.passId, reservationId: reservation.id, type: 'MEMBER_CANCEL_RESTORE', delta: 1, dedupeKey: `reservation:${reservation.id}:restore` });
    return { ok: true };
  });
}
