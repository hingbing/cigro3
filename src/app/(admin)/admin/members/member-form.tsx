'use client';

import { useActionState } from 'react';
import { createMemberAction, createPasswordResetAction, type CreateMemberActionState, type CreatePasswordResetActionState } from './actions';

const initialState: CreateMemberActionState = {};
const initialResetState: CreatePasswordResetActionState = {};

export default function MemberForm({ branches, members = [], invitationUrl, resetUrl }: { branches: Array<{ id: string; name: string }>; members?: Array<{ id: string; phone: string }>; invitationUrl?: string; resetUrl?: string }) {
  const [state, formAction, pending] = useActionState(createMemberAction, invitationUrl ? { invitationUrl } : initialState);
  const [resetState, resetFormAction, resetPending] = useActionState(createPasswordResetAction, resetUrl ? { resetUrl } : initialResetState);

  return <section className="form-grid">
    <form action={formAction} className="form-card">
      <div className="section-header"><div><h2>회원 초대</h2><p>전화번호로 회원 가입 링크를 발급합니다.</p></div></div>
      <label htmlFor="phone">전화번호</label>
      <input id="phone" name="phone" inputMode="tel" required />
      <label htmlFor="defaultBranchId">기본 지점</label>
      <select id="defaultBranchId" name="defaultBranchId" defaultValue={branches[0]?.id} required>
        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
      </select>
      <button type="submit" disabled={pending}>{pending ? '생성 중...' : '초대 링크 생성'}</button>
      {state.error ? <p className="error" aria-live="polite">{state.error}</p> : null}
      {state.invitationUrl ? <div className="result-box"><strong>초대 링크가 생성되었습니다.</strong><p>{state.invitationUrl}</p><button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(state.invitationUrl!)}>링크 복사</button></div> : null}
    </form>
    <form action={resetFormAction} className="form-card">
      <div className="section-header"><div><h2>비밀번호 재설정</h2><p>회원에게 재설정 링크를 발급합니다.</p></div></div>
      <label htmlFor="memberId">비밀번호 재설정 대상</label>
      <select id="memberId" name="memberId" defaultValue={members[0]?.id} required disabled={members.length === 0}>
        {members.map((member) => <option key={member.id} value={member.id}>{member.phone}</option>)}
      </select>
      <button type="submit" disabled={resetPending || members.length === 0}>{resetPending ? '생성 중...' : '재설정 링크 생성'}</button>
      {resetState.error ? <p className="error" aria-live="polite">{resetState.error}</p> : null}
      {resetState.resetUrl ? <div className="result-box"><strong>재설정 링크가 생성되었습니다.</strong><p>{resetState.resetUrl}</p><button className="secondary" type="button" onClick={() => navigator.clipboard.writeText(resetState.resetUrl!)}>링크 복사</button></div> : null}
    </form>
  </section>;
}
