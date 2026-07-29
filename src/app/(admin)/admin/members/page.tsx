import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { getAdminMemberDirectory } from '@/server/members/admin-member-directory';
import MemberDirectory from './member-directory';
import MemberForm from './member-form';

export default async function MembersPage() {
  const directory = await getAdminMemberDirectory();
  if (!directory.ok) redirect('/forbidden');
  return <main className="shell"><AppHeader /><section className="page-header"><h1>회원 관리</h1><p>전화번호로 회원을 초대하고 비밀번호 재설정 링크를 발급합니다.</p></section><MemberForm branches={directory.value.branches} members={directory.value.resetMembers} /><MemberDirectory members={directory.value.members} /></main>;
}
