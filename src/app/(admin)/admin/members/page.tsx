import MemberForm from './member-form';
import { redirect } from 'next/navigation';
import { getAdminMemberDirectory } from '@/server/members/admin-member-directory';
import { AppHeader } from '@/components/app-header';

export default async function MembersPage() {
  const directory = await getAdminMemberDirectory();
  if (!directory.ok) redirect('/forbidden');
  return <main className="shell"><AppHeader/><section className="card"><h1>회원 관리</h1><p>전화번호로 회원을 초대하고 비밀번호 재설정 링크를 발급합니다.</p><MemberForm branches={directory.value.branches} members={directory.value.members} /><section className="item"><h2>기존 회원</h2>{directory.value.members.length?<ul>{directory.value.members.map(member=><li key={member.id}>{member.phone} <span className="badge">회원</span> <span className="badge">활성</span></li>)}</ul>:<p>등록된 회원이 없습니다.</p>}</section></section></main>;
}
