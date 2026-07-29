'use client';
import { useActionState } from 'react'; import { reserveAction } from './actions';
export function ReservationForm({ occurrenceId, passId, disabled }: { occurrenceId: string; passId: string; disabled: boolean }) { const [state, action, pending] = useActionState(reserveAction, {}); return <form action={action}><input type="hidden" name="occurrenceId" value={occurrenceId}/><input type="hidden" name="passId" value={passId}/><button disabled={disabled || pending}>예약하기</button>{state.error && <p className="error" aria-live="polite">{state.error}</p>}</form>; }
