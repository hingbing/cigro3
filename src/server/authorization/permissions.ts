export type UserRole = 'HEAD_ADMIN' | 'BRANCH_ADMIN' | 'INSTRUCTOR' | 'MEMBER';

export type AuthorizationActor = {
  userId: string;
  role: UserRole;
  defaultBranchId: string | null;
};

export type AuthorizationResource = {
  branchId?: string | null;
  memberId?: string | null;
  occurrenceInstructorId?: string | null;
};

export type Permission =
  | 'MEMBER_CREATE'
  | 'MEMBER_READ'
  | 'MEMBER_UPDATE'
  | 'INVITATION_CREATE'
  | 'PASSWORD_RESET_CREATE'
  | 'OCCURRENCE_ROSTER_READ'
  | 'PASS_ISSUE'
  | 'PASS_READ'
  | 'RESERVATION_READ'
  | 'ATTENDANCE_UPDATE';

function hasAssignedBranch(actor: AuthorizationActor, resource: AuthorizationResource): boolean {
  return actor.defaultBranchId !== null && actor.defaultBranchId === resource.branchId;
}

export function can(permission: Permission, actor: AuthorizationActor, resource: AuthorizationResource): boolean {
  if (actor.role === 'HEAD_ADMIN') return true;

  if (actor.role === 'BRANCH_ADMIN') {
    return hasAssignedBranch(actor, resource) && [
      'MEMBER_CREATE',
      'MEMBER_READ',
      'MEMBER_UPDATE',
      'INVITATION_CREATE',
      'PASSWORD_RESET_CREATE',
      'OCCURRENCE_ROSTER_READ',
      'PASS_ISSUE',
      'ATTENDANCE_UPDATE',
    ].includes(permission);
  }

  if (actor.role === 'INSTRUCTOR') {
    return permission === 'OCCURRENCE_ROSTER_READ' && resource.occurrenceInstructorId === actor.userId;
  }

  return resource.memberId === actor.userId && [
    'MEMBER_READ',
    'MEMBER_UPDATE',
    'PASS_READ',
    'RESERVATION_READ',
  ].includes(permission);
}
