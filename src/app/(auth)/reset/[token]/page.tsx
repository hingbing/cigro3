import { resetPasswordAction } from './actions';

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main><h1>Reset your password</h1><form action={resetPasswordAction.bind(null, token)}>
    <label htmlFor="password">New password</label><input id="password" name="password" type="password" required />
    <label htmlFor="confirmation">Confirm password</label><input id="confirmation" name="confirmation" type="password" required />
    <button type="submit">Reset password</button>
  </form></main>;
}
