export function destinationFor(role: 'HEAD_ADMIN' | 'BRANCH_ADMIN' | 'INSTRUCTOR' | 'MEMBER'): string {
  if (role === 'MEMBER') return '/classes';
  if (role === 'INSTRUCTOR') return '/instructor';
  return '/admin';
}
