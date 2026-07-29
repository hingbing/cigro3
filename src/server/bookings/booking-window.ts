const HOUR = 60 * 60 * 1000;
const BOOKING_OPEN_LEAD = 14 * 24 * HOUR;
const BOOKING_CLOSE_LEAD = HOUR;
const CANCELLATION_CLOSE_LEAD = 2 * HOUR;

export function evaluateBookingWindow(now: Date, startsAt: Date) {
  const millisecondsUntilStart = millisecondsUntil(now, startsAt);
  return {
    canBook: millisecondsUntilStart <= BOOKING_OPEN_LEAD && millisecondsUntilStart > BOOKING_CLOSE_LEAD,
    canCancel: millisecondsUntilStart >= CANCELLATION_CLOSE_LEAD,
  };
}
import { millisecondsUntil } from '@/server/time/clock';
