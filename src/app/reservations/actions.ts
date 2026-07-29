'use server';
import { z } from 'zod';
import { requireRole } from '@/server/authorization/guards';
import { cancelReservation } from '@/server/bookings/member-reservations';
export async function cancelAction(_: { error?: string; success?: string }, formData: FormData) {
  const parsed = z.object({ reservationId: z.string().uuid() }).safeParse({ reservationId: formData.get('reservationId') });
  if (!parsed.success) return { error: 'Invalid reservation.' };
  const session = await requireRole(['MEMBER']); if (!session.ok) return { error: 'FORBIDDEN' };
  const result = await cancelReservation({ memberId: session.value.userId, reservationId: parsed.data.reservationId });
  return result.ok ? { success: 'Reservation cancelled and pass restored.' } : { error: result.error };
}
