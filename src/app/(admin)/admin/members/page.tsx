import MemberForm from './member-form';
import { redirect } from 'next/navigation';
import { getAdminMemberDirectory } from '@/server/members/admin-member-directory';

export default async function MembersPage() {
  const directory = await getAdminMemberDirectory();
  if (!directory.ok) redirect('/forbidden');
  return <main><h1>Members</h1><MemberForm branches={directory.value.branches} members={directory.value.members} /></main>;
}
