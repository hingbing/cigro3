import { acceptInvitationAction } from './actions';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <main><h1>Set your password</h1><form action={acceptInvitationAction.bind(null, token)}>
    <label htmlFor="password">New password</label><input id="password" name="password" type="password" required />
    <label htmlFor="confirmation">Confirm password</label><input id="confirmation" name="confirmation" type="password" required />
    <button type="submit">Activate account</button>
  </form></main>;
}
