'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireRole } from '@/server/authorization/guards';
import { cancelWaitlist, joinWaitlist } from '@/server/waitlist/member-waitlist';

export type WaitlistActionState = { error?: string; success?: boolean };
const form = z.object({ occurrenceId: z.string().uuid() });
const messages = { ALREADY_WAITING: '\uC774\uBBF8 \uB300\uAE30 \uC2E0\uCCAD\uD55C \uC218\uC5C5\uC785\uB2C8\uB2E4.', ALREADY_BOOKED: '\uC774\uBBF8 \uC608\uC57D\uD55C \uC218\uC5C5\uC785\uB2C8\uB2E4.', SEATS_AVAILABLE: '\uC544\uC9C1 \uC608\uC57D \uAC00\uB2A5\uD55C \uC88C\uC11D\uC774 \uC788\uC2B5\uB2C8\uB2E4.', WINDOW_CLOSED: '\uB300\uAE30 \uC2E0\uCCAD \uAC00\uB2A5 \uAE30\uAC04\uC774 \uC544\uB2D9\uB2C8\uB2E4.', FAILED: '\uB300\uAE30 \uC2E0\uCCAD\uC744 \uCC98\uB9AC\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.' } as const;

export async function joinWaitlistAction(_: WaitlistActionState, formData: FormData): Promise<WaitlistActionState> {
  const parsed = form.safeParse({ occurrenceId: formData.get('occurrenceId') }); if (!parsed.success) return { error: messages.FAILED };
  const session = await requireRole(['MEMBER']); if (!session.ok) return { error: '\uD68C\uC6D0\uB9CC \uB300\uAE30 \uC2E0\uCCAD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.' };
  const result = await joinWaitlist({ memberId: session.value.userId, occurrenceId: parsed.data.occurrenceId });
  if (!result.ok) return { error: messages[result.error] };
  revalidatePath('/classes'); return { success: true };
}
export async function cancelWaitlistAction(_: WaitlistActionState, formData: FormData): Promise<WaitlistActionState> {
  const parsed = form.safeParse({ occurrenceId: formData.get('occurrenceId') }); if (!parsed.success) return { error: messages.FAILED };
  const session = await requireRole(['MEMBER']); if (!session.ok) return { error: '\uD68C\uC6D0\uB9CC \uB300\uAE30 \uCDE8\uC18C\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.' };
  const result = await cancelWaitlist({ memberId: session.value.userId, occurrenceId: parsed.data.occurrenceId });
  if (!result.ok) return { error: messages.FAILED };
  revalidatePath('/classes'); return { success: true };
}
