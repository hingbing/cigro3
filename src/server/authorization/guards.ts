import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { requireSession, type CookieStore, type CurrentSession } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { classOccurrences, users } from '@/server/db/schema';
import { can, type AuthorizationActor, type UserRole } from './permissions';

export type AuthorizationResult<T> = { ok: true; value: T } | { ok: false; error: 'FORBIDDEN' };

const forbidden = (): AuthorizationResult<never> => ({ ok: false, error: 'FORBIDDEN' });

async function currentActor(cookieStore?: CookieStore): Promise<AuthorizationResult<CurrentSession>> {
  try {
    const store = cookieStore ?? ((await cookies()) as unknown as CookieStore);
    return { ok: true, value: await requireSession(store) };
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHENTICATED') return forbidden();
    throw error;
  }
}

function authorizationActor(session: CurrentSession): AuthorizationActor {
  return { userId: session.userId, role: session.role, defaultBranchId: session.defaultBranchId };
}

export async function requireRole(roles: readonly UserRole[], cookieStore?: CookieStore): Promise<AuthorizationResult<CurrentSession>> {
  const actor = await currentActor(cookieStore);
  if (!actor.ok || !roles.includes(actor.value.role)) return forbidden();
  return actor;
}

export async function requireBranchAccess(branchId: string, cookieStore?: CookieStore): Promise<AuthorizationResult<CurrentSession>> {
  const actor = await currentActor(cookieStore);
  if (!actor.ok || !can('MEMBER_READ', authorizationActor(actor.value), { branchId })) return forbidden();
  return actor;
}

export async function requireOwnMember(memberId: string, cookieStore?: CookieStore): Promise<AuthorizationResult<CurrentSession>> {
  const actor = await currentActor(cookieStore);
  if (!actor.ok) return forbidden();

  const [member] = await getDb().select({
    id: users.id,
    role: users.role,
    defaultBranchId: users.defaultBranchId,
  }).from(users).where(eq(users.id, memberId));
  if (!member || member.role !== 'MEMBER') return forbidden();
  if (!can('MEMBER_READ', authorizationActor(actor.value), { memberId: member.id, branchId: member.defaultBranchId })) return forbidden();
  return actor;
}

export async function requireAssignedOccurrence(occurrenceId: string, cookieStore?: CookieStore): Promise<AuthorizationResult<CurrentSession>> {
  const actor = await currentActor(cookieStore);
  if (!actor.ok) return forbidden();

  const [occurrence] = await getDb().select({
    branchId: classOccurrences.branchId,
    instructorId: classOccurrences.instructorId,
  }).from(classOccurrences).where(eq(classOccurrences.id, occurrenceId));
  if (!occurrence || !can('OCCURRENCE_ROSTER_READ', authorizationActor(actor.value), { branchId: occurrence.branchId, occurrenceInstructorId: occurrence.instructorId })) return forbidden();
  return actor;
}
