'use server';
import { z } from 'zod';
import { requireRole } from '@/server/authorization/guards';
import { createReservation } from '@/server/bookings/member-reservations';
const schema = z.object({ occurrenceId: z.string().uuid(), passId: z.string().uuid() });
export async function reserveAction(_: { error?: string; success?: string }, formData: FormData) {
  const parsed = schema.safeParse({ occurrenceId: formData.get('occurrenceId'), passId: formData.get('passId') });
  if (!parsed.success) return { error: 'Select a class and an available pass.' };
  const session = await requireRole(['MEMBER']); if (!session.ok) return { error: 'FORBIDDEN' };
  const result = await createReservation({ memberId: session.value.userId, ...parsed.data });
  return result.ok ? { success: 'Reservation confirmed.' } : { error: result.error };
}
