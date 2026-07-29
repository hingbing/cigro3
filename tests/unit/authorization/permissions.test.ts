import { describe, expect, it } from 'vitest';
import { can, type AuthorizationActor, type AuthorizationResource } from '@/server/authorization/permissions';

const branchA = '00000000-0000-4000-8000-000000000001';
const branchB = '00000000-0000-4000-8000-000000000002';
const headAdmin: AuthorizationActor = { userId: 'head-admin', role: 'HEAD_ADMIN', defaultBranchId: null };
const branchAdmin: AuthorizationActor = { userId: 'branch-admin', role: 'BRANCH_ADMIN', defaultBranchId: branchA };
const instructor: AuthorizationActor = { userId: 'instructor', role: 'INSTRUCTOR', defaultBranchId: branchA };
const member: AuthorizationActor = { userId: 'member', role: 'MEMBER', defaultBranchId: branchA };

describe('permission matrix', () => {
  it.each([
    ['HEAD_ADMIN can issue a pass in any branch', 'PASS_ISSUE', headAdmin, { branchId: branchB }, true],
    ['BRANCH_ADMIN can create a member in its assigned branch', 'MEMBER_CREATE', branchAdmin, { branchId: branchA }, true],
    ['BRANCH_ADMIN cannot read a member in another branch', 'MEMBER_READ', branchAdmin, { branchId: branchB, memberId: 'other-member' }, false],
    ['INSTRUCTOR can read a roster for an assigned occurrence', 'OCCURRENCE_ROSTER_READ', instructor, { branchId: branchA, occurrenceInstructorId: 'instructor' }, true],
    ['INSTRUCTOR cannot issue a pass', 'PASS_ISSUE', instructor, { branchId: branchA }, false],
    ['INSTRUCTOR cannot change attendance', 'ATTENDANCE_UPDATE', instructor, { branchId: branchA, occurrenceInstructorId: 'instructor' }, false],
    ['MEMBER can read only its own data', 'MEMBER_READ', member, { branchId: branchA, memberId: 'member' }, true],
    ['MEMBER cannot read another member data', 'MEMBER_READ', member, { branchId: branchA, memberId: 'other-member' }, false],
  ] as const)('%s', (_, permission, actor, resource, expected) => {
    expect(can(permission, actor, resource as AuthorizationResource)).toBe(expected);
  });
});
