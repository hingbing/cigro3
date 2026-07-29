import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const invitationService = vi.hoisted(() => ({ createPasswordReset: vi.fn() }));
const authorizationGuards = vi.hoisted(() => ({
  requireRole: vi.fn().mockResolvedValue({ ok: true, value: { userId: 'admin', role: 'HEAD_ADMIN', defaultBranchId: null } }),
  requireBranchAccess: vi.fn().mockResolvedValue({ ok: true, value: { userId: 'admin', role: 'HEAD_ADMIN', defaultBranchId: null } }),
  requireOwnMember: vi.fn().mockResolvedValue({ ok: true, value: { userId: 'admin', role: 'HEAD_ADMIN', defaultBranchId: null } }),
}));
vi.mock('@/server/auth/invitations', () => invitationService);
vi.mock('@/server/authorization/guards', () => authorizationGuards);

import MemberForm from '@/app/(admin)/admin/members/member-form';
import { createPasswordResetAction } from '@/app/(admin)/admin/members/actions';
import InvitePage from '@/app/(auth)/invite/[token]/page';
import ResetPage from '@/app/(auth)/reset/[token]/page';

describe('invitation and password reset forms', () => {
  it('renders the administrator member form with a phone, default branch, and generated invitation link', () => {
    render(<MemberForm branches={[{ id: 'branch-1', name: 'Gangnam' }]} invitationUrl="/invite/opaque-token" />);

    expect(screen.getByLabelText('Phone')).toBeRequired();
    expect(screen.getByLabelText('Default branch')).toHaveValue('branch-1');
    expect(screen.getByRole('button', { name: 'Copy invitation link' })).toBeInTheDocument();
    expect(screen.getByText('/invite/opaque-token')).toBeInTheDocument();
    expect(screen.getByText('Send this link through your existing channel.')).toBeInTheDocument();
  });

  it('lets an administrator request and copy a password reset URL for a selected member', async () => {
    invitationService.createPasswordReset.mockResolvedValue({ resetUrl: '/reset/opaque-reset-token' });
    const formData = new FormData();
    formData.set('memberId', '00000000-0000-4000-8000-000000000001');
    const result = await createPasswordResetAction({}, formData);
    const view = render(<MemberForm
      branches={[{ id: 'branch-1', name: 'Gangnam' }]}
      members={[{ id: '00000000-0000-4000-8000-000000000001', phone: '01012345678' }]}
      resetUrl="/reset/opaque-reset-token"
    />);
    const form = within(view.container);

    expect(result).toEqual({ resetUrl: '/reset/opaque-reset-token' });
    expect(form.getByRole('option', { name: '01012345678' })).toHaveValue('00000000-0000-4000-8000-000000000001');
    expect(form.getByRole('button', { name: 'Create password reset' })).toBeInTheDocument();
    expect(form.getByRole('button', { name: 'Copy password reset link' })).toBeInTheDocument();
    expect(form.getByText('/reset/opaque-reset-token')).toBeInTheDocument();
  });

  it('renders invitation and reset forms with two password fields without exposing their tokens', async () => {
    render(await InvitePage({ params: Promise.resolve({ token: 'opaque-invite-token' }) }));
    expect(screen.getByRole('heading', { name: 'Set your password' })).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
    expect(screen.queryByText('opaque-invite-token')).not.toBeInTheDocument();

    render(await ResetPage({ params: Promise.resolve({ token: 'opaque-reset-token' }) }));
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'password');
    expect(screen.queryByText('opaque-reset-token')).not.toBeInTheDocument();
  });
});
