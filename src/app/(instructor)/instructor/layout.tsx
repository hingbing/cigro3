import { redirect } from 'next/navigation';
import { requireRole } from '@/server/authorization/guards';

export default async function InstructorLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const result = await requireRole(['INSTRUCTOR']);
  if (!result.ok) redirect('/forbidden');
  return children;
}
