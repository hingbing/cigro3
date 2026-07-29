import { and, eq, inArray } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { AppHeader } from '@/components/app-header';
import { requireRole } from '@/server/authorization/guards';
import { getDb } from '@/server/db/client';
import { branches, classTemplates, users } from '@/server/db/schema';
import { ClassForm } from './class-form';

const demoBranches = ['서울', '수원', '인천'];

export default async function NewClassPage() {
  const actor = await requireRole(['HEAD_ADMIN', 'BRANCH_ADMIN']);
  if (!actor.ok) redirect('/forbidden');
  const db = getDb();
  const branchCondition = actor.value.role === 'HEAD_ADMIN' ? inArray(branches.name, demoBranches) : actor.value.defaultBranchId ? eq(branches.id, actor.value.defaultBranchId) : undefined;
  if (!branchCondition) redirect('/forbidden');
  const [templates, branchRows, instructors] = await Promise.all([
    db.select({ id: classTemplates.id, name: classTemplates.name }).from(classTemplates),
    db.select({ id: branches.id, name: branches.name }).from(branches).where(branchCondition),
    db.select({ id: users.id, phone: users.phone }).from(users).where(and(eq(users.role, 'INSTRUCTOR'), inArray(users.defaultBranchId, demoBranches.length ? (await db.select({ id: branches.id }).from(branches).where(inArray(branches.name, demoBranches))).map((branch) => branch.id) : []))),
  ]);
  return <main className="shell"><AppHeader /><section className="page-header"><h1>수업 일정 추가</h1><p>기존 수업 템플릿으로 예정 수업을 등록합니다.</p></section><ClassForm templates={templates} branches={branchRows} instructors={instructors} branchLocked={actor.value.role === 'BRANCH_ADMIN'} /></main>;
}
