const HOUR = 60 * 60 * 1000;
const OFFER_ACCEPT_LEAD = 4 * HOUR;
const CLOSED_LEAD = HOUR;
const OFFER_DURATION = 30 * 60 * 1000;

export type WaitlistWindow = 'OFFER_AUTO' | 'OFFER_ACCEPT' | 'CLOSED';

export function evaluateWaitlistWindow(now: Date, startsAt: Date): WaitlistWindow {
  const millisecondsUntilStart = millisecondsUntil(now, startsAt);
  if (millisecondsUntilStart > OFFER_ACCEPT_LEAD) return 'OFFER_AUTO';
  if (millisecondsUntilStart > CLOSED_LEAD) return 'OFFER_ACCEPT';
  return 'CLOSED';
}

export function calculateOfferExpiry(now: Date, startsAt: Date): Date {
  return new Date(Math.min(now.getTime() + OFFER_DURATION, startsAt.getTime() - CLOSED_LEAD));
}
import { millisecondsUntil } from '@/server/time/clock';
