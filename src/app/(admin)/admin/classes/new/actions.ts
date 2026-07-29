'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireBranchAccess, requireRole } from '@/server/authorization/guards';
import { getDb } from '@/server/db/client';
import { classOccurrences } from '@/server/db/schema';
import { seoulDate } from '@/server/time/seoul';

const form = z.object({ templateId: z.string().uuid(), branchId: z.string().uuid(), instructorId: z.string().uuid(), startsAt: z.string().min(1), duration: z.coerce.number().int().min(1), capacity: z.coerce.number().int().min(1) });
export type State = { error?: string };

export async function createClassAction(_: State, data: FormData): Promise<State> {
  const parsed = form.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: '필수 항목을 모두 입력해 주세요.' };
  const actor = await requireRole(['HEAD_ADMIN', 'BRANCH_ADMIN']);
  if (!actor.ok) return { error: '수업 일정을 추가할 권한이 없습니다.' };
  const access = await requireBranchAccess(parsed.data.branchId);
  if (!access.ok) return { error: '해당 지점에 수업을 추가할 수 없습니다.' };
  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { error: '필수 항목을 모두 입력해 주세요.' };
  try {
    await getDb().insert(classOccurrences).values({ templateId: parsed.data.templateId, branchId: parsed.data.branchId, instructorId: parsed.data.instructorId, startsAt, endsAt: new Date(startsAt.getTime() + parsed.data.duration * 60_000), classDate: seoulDate(startsAt), capacity: parsed.data.capacity, status: 'NORMAL' });
    revalidatePath('/admin/classes');
    revalidatePath('/classes');
    redirect('/admin/classes');
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505') return { error: '같은 날짜에 동일한 수업 일정이 이미 있습니다.' };
    return { error: '수업 일정을 추가하지 못했습니다.' };
  }
}
