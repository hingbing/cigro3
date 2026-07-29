'use server';

import { z } from 'zod';
import { consumePasswordReset } from '@/server/auth/invitations';

const passwordForm = z.object({ password: z.string().min(1), confirmation: z.string().min(1) });

export async function resetPasswordAction(token: string, formData: FormData): Promise<void> {
  const parsed = passwordForm.safeParse({ password: formData.get('password'), confirmation: formData.get('confirmation') });
  if (!parsed.success || parsed.data.password !== parsed.data.confirmation) return;
  const result = await consumePasswordReset(token, parsed.data.password);
  if (!result.ok) return;
}
