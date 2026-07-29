'use client';
import { useActionState } from 'react'; import { cancelAction } from './actions';
export function CancelForm({ reservationId }: { reservationId: string }) { const [state, action, pending] = useActionState(cancelAction, {}); return <form action={action}><input type="hidden" name="reservationId" value={reservationId}/><button className="secondary" disabled={pending}>예약 취소</button>{state.error && <p className="error" aria-live="polite">{state.error}</p>}</form>; }
