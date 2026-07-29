'use client';
import { useActionState } from 'react';
import { cancelWaitlistAction, joinWaitlistAction } from './waitlist-actions';
export function WaitlistForm({ occurrenceId, waiting }: { occurrenceId: string; waiting: boolean }) {
  const [state, action, pending] = useActionState(waiting ? cancelWaitlistAction : joinWaitlistAction, {});
  return <form action={action}><input type="hidden" name="occurrenceId" value={occurrenceId} />{waiting ? <><span className="badge">{'\uB300\uAE30 \uC911'}</span><button type="submit" className="secondary" disabled={pending}>{pending ? '\uCC98\uB9AC \uC911...' : '\uB300\uAE30 \uCDE8\uC18C'}</button></> : <button type="submit" className="secondary" disabled={pending}>{pending ? '\uC2E0\uCCAD \uC911...' : '\uB300\uAE30 \uC2E0\uCCAD'}</button>}{state.success ? <p aria-live="polite">{'\uB300\uAE30 \uC2E0\uCCAD \uC644\uB8CC'}</p> : null}{state.error ? <p className="error" aria-live="polite">{state.error}</p> : null}</form>;
}
