'use server';

import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { login } from '@/server/auth/login';
import { setSessionCookie, type CookieStore } from '@/server/auth/session';
import { getDb } from '@/server/db/client';
import { users } from '@/server/db/schema';

const loginForm = z.object({ phone: z.string().min(1), password: z.string().min(1) });

export type LoginActionState = { error?: string };

function destinationFor(role: 'HEAD_ADMIN' | 'BRANCH_ADMIN' | 'INSTRUCTOR' | 'MEMBER'): string {
  if (role === 'MEMBER') return '/';
  if (role === 'INSTRUCTOR') return '/instructor';
  return '/admin';
}

export async function loginAction(_: LoginActionState, formData: FormData): Promise<LoginActionState> {
  const parsed = loginForm.safeParse({ phone: formData.get('phone'), password: formData.get('password') });
  if (!parsed.success) return { error: '전화번호와 비밀번호를 입력해 주세요.' };

  const result = await login(parsed.data.phone, parsed.data.password);
  if (!result.ok) return { error: result.error === 'ACCOUNT_DISABLED' ? '비활성화된 계정입니다.' : '전화번호 또는 비밀번호가 올바르지 않습니다.' };

  const [user] = await getDb().select({ role: users.role }).from(users).where(eq(users.id, result.value.userId));
  if (!user) return { error: '전화번호 또는 비밀번호가 올바르지 않습니다.' };
  setSessionCookie((await cookies()) as unknown as CookieStore, result.value.token, result.value.expiresAt);
  redirect(destinationFor(user.role));
}
