import { and, eq } from 'drizzle-orm';
import { type CookieStore } from '@/server/auth/session';
import { type AuthorizationResult, requireRole } from '@/server/authorization/guards';
import { getDb } from '@/server/db/client';
import { branches, users } from '@/server/db/schema';

export type AdminMemberDirectory = {
  branches: Array<{ id: string; name: string }>;
  members: Array<{ id: string; phone: string }>;
};

export async function getAdminMemberDirectory(cookieStore?: CookieStore): Promise<AuthorizationResult<AdminMemberDirectory>> {
  const actor = await requireRole(['HEAD_ADMIN', 'BRANCH_ADMIN'], cookieStore);
  if (!actor.ok) return actor;

  const db = getDb();
  if (actor.value.role === 'HEAD_ADMIN') {
    const [availableBranches, members] = await Promise.all([
      db.select({ id: branches.id, name: branches.name }).from(branches),
      db.select({ id: users.id, phone: users.phone }).from(users).where(eq(users.role, 'MEMBER')),
    ]);
    return { ok: true, value: { branches: availableBranches, members } };
  }

  const branchId = actor.value.defaultBranchId;
  if (!branchId) return { ok: false, error: 'FORBIDDEN' };

  const [availableBranches, members] = await Promise.all([
    db.select({ id: branches.id, name: branches.name }).from(branches).where(eq(branches.id, branchId)),
    db.select({ id: users.id, phone: users.phone }).from(users).where(and(eq(users.role, 'MEMBER'), eq(users.defaultBranchId, branchId))),
  ]);
  return { ok: true, value: { branches: availableBranches, members } };
}
