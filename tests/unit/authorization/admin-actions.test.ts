import { beforeEach, describe, expect, it, vi } from 'vitest';

const invitationService = vi.hoisted(() => ({ createPasswordReset: vi.fn() }));
const memberService = vi.hoisted(() => ({ createMemberAndInvitation: vi.fn() }));
const authorizationGuards = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireBranchAccess: vi.fn(),
  requireOwnMember: vi.fn(),
}));

vi.mock('@/server/auth/invitations', () => invitationService);
vi.mock('@/server/members/member-service', () => memberService);
vi.mock('@/server/authorization/guards', () => authorizationGuards);

import { createMemberAction, createPasswordResetAction } from '@/app/(admin)/admin/members/actions';

describe('administrator member actions', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns FORBIDDEN without creating an invitation when the actor lacks an administrator role', async () => {
    authorizationGuards.requireRole.mockResolvedValue({ ok: false, error: 'FORBIDDEN' });
    const formData = new FormData();
    formData.set('phone', '01012345678');
    formData.set('defaultBranchId', '00000000-0000-4000-8000-000000000001');

    await expect(createMemberAction({}, formData)).resolves.toEqual({ error: 'FORBIDDEN' });
    expect(memberService.createMemberAndInvitation).not.toHaveBeenCalled();
  });

  it('returns FORBIDDEN without creating a reset when the selected member is outside the actor scope', async () => {
    authorizationGuards.requireRole.mockResolvedValue({ ok: true, value: { userId: 'admin', role: 'BRANCH_ADMIN', defaultBranchId: 'branch-a' } });
    authorizationGuards.requireOwnMember.mockResolvedValue({ ok: false, error: 'FORBIDDEN' });
    const formData = new FormData();
    formData.set('memberId', '00000000-0000-4000-8000-000000000001');

    await expect(createPasswordResetAction({}, formData)).resolves.toEqual({ error: 'FORBIDDEN' });
    expect(invitationService.createPasswordReset).not.toHaveBeenCalled();
  });
});
