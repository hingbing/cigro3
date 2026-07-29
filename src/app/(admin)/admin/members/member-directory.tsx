'use client';

import { useMemo, useState } from 'react';
import type { DirectoryMember } from '@/server/members/admin-member-directory';

const ko = {
  member: '\uD68C\uC6D0', instructor: '\uAC15\uC0AC', branchAdmin: '\uC9C0\uC810 \uAD00\uB9AC\uC790', headAdmin: '\uCD5C\uACE0 \uAD00\uB9AC\uC790',
  active: '\uD65C\uC131', invited: '\uCD08\uB300 \uB300\uAE30', inactive: '\uBE44\uD65C\uC131', all: '\uC804\uCCB4',
  seoul: '\uC11C\uC6B8', suwon: '\uC218\uC6D0', incheon: '\uC778\uCC9C',
};
const roleLabel: Record<DirectoryMember['role'], string> = { MEMBER: ko.member, INSTRUCTOR: ko.instructor, BRANCH_ADMIN: ko.branchAdmin, HEAD_ADMIN: ko.headAdmin };
const statusLabel: Record<DirectoryMember['status'], string> = { ACTIVE: ko.active, INVITED: ko.invited, DISABLED: ko.inactive };

export default function MemberDirectory({ members }: { members: DirectoryMember[] }) {
  const [phone, setPhone] = useState('');
  const [branch, setBranch] = useState('');
  const [role, setRole] = useState('');
  const [pass, setPass] = useState('');
  const filtered = useMemo(() => members.filter((member) => member.phone.includes(phone) && (!branch || member.branchName === branch) && (!role || member.role === role) && (!pass || (pass === 'has' ? member.remainingCredits > 0 : pass === 'none' ? member.remainingCredits === 0 : member.remainingCredits <= 3))), [members, phone, branch, role, pass]);
  const reset = () => { setPhone(''); setBranch(''); setRole(''); setPass(''); };
  const date = (value: string) => new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
  return <section className="content-card member-directory">
    <div className="section-header"><div><h2>{'\uAE30\uC874 \uD68C\uC6D0'}</h2><p>{'\uCD1D '}{filtered.length}{'\uBA85'}</p></div></div>
    <div className="filters">
      <label>{'\uC804\uD654\uBC88\uD638'}<input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder={'\uC804\uD654\uBC88\uD638 \uAC80\uC0C9'} /></label>
      <label>{'\uC9C0\uC810'}<select value={branch} onChange={(event) => setBranch(event.target.value)}><option value="">{ko.all}</option><option>{ko.seoul}</option><option>{ko.suwon}</option><option>{ko.incheon}</option></select></label>
      <label>{'\uC5ED\uD560'}<select value={role} onChange={(event) => setRole(event.target.value)}><option value="">{ko.all}</option><option value="MEMBER">{ko.member}</option><option value="INSTRUCTOR">{ko.instructor}</option><option value="BRANCH_ADMIN">{ko.branchAdmin}</option><option value="HEAD_ADMIN">{ko.headAdmin}</option></select></label>
      <label>{'\uC774\uC6A9\uAD8C'}<select value={pass} onChange={(event) => setPass(event.target.value)}><option value="">{ko.all}</option><option value="has">{'\uC774\uC6A9\uAD8C \uC788\uC74C'}</option><option value="none">{'\uC774\uC6A9\uAD8C \uC5C6\uC74C'}</option><option value="low">{'3\uD68C \uC774\uD558'}</option></select></label>
      <button type="button" className="secondary filter-reset" onClick={reset}>{'\uCD08\uAE30\uD654'}</button>
    </div>
    {filtered.length === 0 ? <div className="empty-state">{'\uC870\uAC74\uC5D0 \uB9DE\uB294 \uD68C\uC6D0\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}</div> : <>
      <div className="member-table-wrap"><table className="member-table"><thead><tr><th>{'\uC804\uD654\uBC88\uD638'}</th><th>{'\uC5ED\uD560'}</th><th>{'\uC0C1\uD0DC'}</th><th>{'\uAE30\uBCF8 \uC9C0\uC810'}</th><th>{'\uB0A8\uC740 \uC774\uC6A9\uAD8C'}</th><th>{'\uB4F1\uB85D\uC77C'}</th></tr></thead><tbody>{filtered.map((member) => <tr key={member.id}><td>{member.phone}</td><td><span className="badge">{roleLabel[member.role]}</span></td><td><span className="badge">{statusLabel[member.status]}</span></td><td>{member.branchName ?? '\uBBF8\uC9C0\uC815'}</td><td>{member.remainingCredits}{'\uD68C'}</td><td>{date(member.createdAt)}</td></tr>)}</tbody></table></div>
      <div className="member-mobile-list">{filtered.map((member) => <article key={member.id} className="mobile-member-card"><strong>{member.phone}</strong><p><span className="badge">{roleLabel[member.role]}</span> <span className="badge">{statusLabel[member.status]}</span></p><p>{'\uAE30\uBCF8 \uC9C0\uC810: '}{member.branchName ?? '\uBBF8\uC9C0\uC815'}</p><p>{'\uB0A8\uC740 \uC774\uC6A9\uAD8C: '}{member.remainingCredits}{'\uD68C \u00B7 \uB4F1\uB85D\uC77C: '}{date(member.createdAt)}</p></article>)}</div>
    </>}
  </section>;
}
