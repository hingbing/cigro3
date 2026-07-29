'use server';

import { z } from 'zod';
import { createPasswordReset } from '@/server/auth/invitations';
import { requireBranchAccess, requireOwnMember, requireRole } from '@/server/authorization/guards';
import { createMemberAndInvitation } from '@/server/members/member-service';

const memberForm = z.object({ phone: z.string().min(1), defaultBranchId: z.string().uuid() });
const passwordResetForm = z.object({ memberId: z.string().uuid() });

export type CreateMemberActionState = { error?: string; invitationUrl?: string };
export type CreatePasswordResetActionState = { error?: string; resetUrl?: string };

export async function createMemberAction(_: CreateMemberActionState, formData: FormData): Promise<CreateMemberActionState> {
  const parsed = memberForm.safeParse({ phone: formData.get('phone'), defaultBranchId: formData.get('defaultBranchId') });
  if (!parsed.success) return { error: 'Enter a phone number and default branch.' };

  const role = await requireRole(['HEAD_ADMIN', 'BRANCH_ADMIN']);
  if (!role.ok) return { error: 'FORBIDDEN' };
  const branch = await requireBranchAccess(parsed.data.defaultBranchId);
  if (!branch.ok) return { error: 'FORBIDDEN' };

  try {
    const invitation = await createMemberAndInvitation(parsed.data);
    return { invitationUrl: invitation.invitationUrl };
  } catch (error) {
    if (error instanceof Error && error.message === 'PHONE_ALREADY_EXISTS') return { error: 'That phone number already belongs to a member.' };
    throw error;
  }
}

export async function createPasswordResetAction(_: CreatePasswordResetActionState, formData: FormData): Promise<CreatePasswordResetActionState> {
  const parsed = passwordResetForm.safeParse({ memberId: formData.get('memberId') });
  if (!parsed.success) return { error: 'Select a member.' };

  const role = await requireRole(['HEAD_ADMIN', 'BRANCH_ADMIN']);
  if (!role.ok) return { error: 'FORBIDDEN' };
  const member = await requireOwnMember(parsed.data.memberId);
  if (!member.ok) return { error: 'FORBIDDEN' };

  try {
    const reset = await createPasswordReset(parsed.data.memberId);
    return { resetUrl: reset.resetUrl };
  } catch (error) {
    if (error instanceof Error && error.message === 'USER_NOT_FOUND') return { error: 'That member is unavailable.' };
    throw error;
  }
}
