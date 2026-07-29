import { redirect } from 'next/navigation';
import { requireRole } from '@/server/authorization/guards';

export default async function MemberLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const result = await requireRole(['MEMBER']);
  if (!result.ok) redirect('/forbidden');
  return children;
}
