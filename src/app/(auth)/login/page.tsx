'use client';

import { useActionState } from 'react';
import { loginAction, type LoginActionState } from './actions';

const initialState: LoginActionState = {};

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return <main>
    <h1>로그인</h1>
    <form action={formAction}>
      <label htmlFor="phone">전화번호</label>
      <input id="phone" name="phone" inputMode="tel" autoComplete="tel" required />
      <label htmlFor="password">비밀번호</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required />
      <p aria-live="polite">{state.error}</p>
      <button type="submit" disabled={pending}>로그인</button>
    </form>
  </main>;
}
