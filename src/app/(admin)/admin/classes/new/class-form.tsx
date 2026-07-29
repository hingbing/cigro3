'use client';

import { useActionState } from 'react';
import { instructorDisplayName } from '@/server/users/display-name';
import { createClassAction } from './actions';

export function ClassForm({ templates, branches, instructors, branchLocked = false }: { templates: Array<{ id: string; name: string }>; branches: Array<{ id: string; name: string }>; instructors: Array<{ id: string; phone: string }>; branchLocked?: boolean }) {
  const [state, action, pending] = useActionState(createClassAction, {});
  const selectedBranchId = branches[0]?.id;
  return <form action={action} className="form-card class-create-form">
    <label htmlFor="templateId">수업 템플릿</label><select id="templateId" name="templateId" required>{templates.map((template) => <option key={template.id} value={template.id}>{template.name || '그룹 수업'}</option>)}</select>
    <label htmlFor="branchId">지점</label>{branchLocked ? <><input value={branches[0]?.name ?? ''} disabled /><input type="hidden" name="branchId" value={selectedBranchId} /></> : <select id="branchId" name="branchId" required>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>}
    <label htmlFor="instructorId">담당 강사</label><select id="instructorId" name="instructorId" required>{instructors.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructorDisplayName(instructor.phone)}</option>)}</select>
    <label htmlFor="startsAt">시작 날짜와 시간</label><input id="startsAt" name="startsAt" type="datetime-local" required />
    <label htmlFor="duration">수업 시간(분)</label><input id="duration" name="duration" type="number" defaultValue="60" min="1" required />
    <label htmlFor="capacity">정원</label><input id="capacity" name="capacity" type="number" defaultValue="10" min="1" required />
    <button type="submit" disabled={pending || !selectedBranchId || templates.length === 0 || instructors.length === 0}>{pending ? '추가 중...' : '수업 일정 추가'}</button>
    {state.error ? <p className="error" aria-live="polite">{state.error}</p> : null}
  </form>;
}
