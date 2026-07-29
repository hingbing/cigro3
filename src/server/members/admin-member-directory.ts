import { and, eq, inArray } from 'drizzle-orm';
import { type CookieStore } from '@/server/auth/session';
import { type AuthorizationResult, requireRole } from '@/server/authorization/guards';
import { getDb } from '@/server/db/client';
import { branches, passes, users } from '@/server/db/schema';

const demoBranchNames = ['서울', '수원', '인천'];

export type DirectoryMember = {
  id: string;
  phone: string;
  role: 'HEAD_ADMIN' | 'BRANCH_ADMIN' | 'INSTRUCTOR' | 'MEMBER';
  status: 'ACTIVE' | 'INVITED' | 'DISABLED';
  branchName: string | null;
  remainingCredits: number;
  createdAt: string;
};

export type AdminMemberDirectory = {
  branches: Array<{ id: string; name: string }>;
  members: DirectoryMember[];
  resetMembers: Array<{ id: string; phone: string }>;
};

export async function getAdminMemberDirectory(cookieStore?: CookieStore): Promise<AuthorizationResult<AdminMemberDirectory>> {
  const actor = await requireRole(['HEAD_ADMIN', 'BRANCH_ADMIN'], cookieStore);
  if (!actor.ok) return actor;

  const db = getDb();
  const branchFilter = actor.value.role === 'HEAD_ADMIN'
    ? inArray(branches.name, demoBranchNames)
    : actor.value.defaultBranchId ? eq(branches.id, actor.value.defaultBranchId) : undefined;
  if (!branchFilter) return { ok: false, error: 'FORBIDDEN' };

  const availableBranches = await db.select({ id: branches.id, name: branches.name }).from(branches).where(branchFilter);
  const visibleBranchIds = availableBranches.map((branch) => branch.id);
  if (visibleBranchIds.length === 0) return { ok: true, value: { branches: [], members: [], resetMembers: [] } };

  const memberRows = await db.select({
    id: users.id,
    phone: users.phone,
    role: users.role,
    status: users.status,
    defaultBranchId: users.defaultBranchId,
    createdAt: users.createdAt,
  }).from(users).where(inArray(users.defaultBranchId, visibleBranchIds));
  const passRows = memberRows.length
    ? await db.select({ memberId: passes.memberId, remainingCredits: passes.remainingCredits }).from(passes).where(inArray(passes.memberId, memberRows.map((member) => member.id)))
    : [];
  const creditsByMember = new Map<string, number>();
  for (const pass of passRows) creditsByMember.set(pass.memberId, (creditsByMember.get(pass.memberId) ?? 0) + pass.remainingCredits);
  const branchNameById = new Map(availableBranches.map((branch) => [branch.id, branch.name]));

  return {
    ok: true,
    value: {
      branches: availableBranches,
      members: memberRows.map((member) => ({
        ...member,
        branchName: member.defaultBranchId ? branchNameById.get(member.defaultBranchId) ?? null : null,
        remainingCredits: creditsByMember.get(member.id) ?? 0,
        createdAt: member.createdAt.toISOString(),
      })),
      resetMembers: memberRows.filter((member) => member.role === 'MEMBER').map((member) => ({ id: member.id, phone: member.phone })),
    },
  };
}
