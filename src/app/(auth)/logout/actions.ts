'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { logout, type CookieStore } from '@/server/auth/session';

export async function logoutAction(): Promise<never> {
  await logout((await cookies()) as unknown as CookieStore);
  redirect('/login');
}
