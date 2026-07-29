import { redirect } from 'next/navigation';
import { requireRole } from '@/server/authorization/guards';

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const result = await requireRole(['HEAD_ADMIN', 'BRANCH_ADMIN']);
  if (!result.ok) redirect('/forbidden');
  return children;
}
