'use client';

import { useActionState } from 'react';
import { createMemberAction, createPasswordResetAction, type CreateMemberActionState, type CreatePasswordResetActionState } from './actions';

const initialState: CreateMemberActionState = {};
const initialResetState: CreatePasswordResetActionState = {};

export default function MemberForm({ branches, members = [], invitationUrl, resetUrl }: { branches: Array<{ id: string; name: string }>; members?: Array<{ id: string; phone: string }>; invitationUrl?: string; resetUrl?: string }) {
  const [state, formAction, pending] = useActionState(createMemberAction, invitationUrl ? { invitationUrl } : initialState);
  const [resetState, resetFormAction, resetPending] = useActionState(createPasswordResetAction, resetUrl ? { resetUrl } : initialResetState);
  const url = state.invitationUrl;
  const passwordResetUrl = resetState.resetUrl;

  return <>
  <form action={formAction}>
    <label htmlFor="phone">Phone</label>
    <input id="phone" name="phone" inputMode="tel" required />
    <label htmlFor="defaultBranchId">Default branch</label>
    <select id="defaultBranchId" name="defaultBranchId" defaultValue={branches[0]?.id} required>
      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
    </select>
    <button type="submit" disabled={pending}>Create invitation</button>
    {state.error ? <p aria-live="polite">{state.error}</p> : null}
    {url ? <section>
      <p>{url}</p>
      <button type="button" onClick={() => navigator.clipboard.writeText(url)}>Copy invitation link</button>
      <p>Send this link through your existing channel.</p>
    </section> : null}
  </form>
  <form action={resetFormAction}>
    <label htmlFor="memberId">Member to reset</label>
    <select id="memberId" name="memberId" defaultValue={members[0]?.id} required>
      {members.map((member) => <option key={member.id} value={member.id}>{member.phone}</option>)}
    </select>
    <button type="submit" disabled={resetPending}>Create password reset</button>
    {resetState.error ? <p aria-live="polite">{resetState.error}</p> : null}
    {passwordResetUrl ? <section>
      <p>{passwordResetUrl}</p>
      <button type="button" onClick={() => navigator.clipboard.writeText(passwordResetUrl)}>Copy password reset link</button>
      <p>Send this link through your existing channel.</p>
    </section> : null}
  </form>
  </>;
}
