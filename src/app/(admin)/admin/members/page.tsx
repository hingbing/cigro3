import MemberForm from './member-form';
import { redirect } from 'next/navigation';
import { getAdminMemberDirectory } from '@/server/members/admin-member-directory';
import { AppHeader } from '@/components/app-header';

export default async function MembersPage() {
  const directory = await getAdminMemberDirectory();
  if (!directory.ok) redirect('/forbidden');
  return <main className="shell"><AppHeader/><section className="card"><h1>회원 관리</h1><MemberForm branches={directory.value.branches} members={directory.value.members} /></section></main>;
}
