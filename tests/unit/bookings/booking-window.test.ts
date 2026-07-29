import { describe, expect, it } from 'vitest';
import { evaluateBookingWindow } from '@/server/bookings/booking-window';

const classStart = new Date('2026-08-15T01:00:00.000Z');

describe('evaluateBookingWindow', () => {
  it('allows booking exactly 14 days before class start and cancellation exactly 2 hours before', () => {
    expect(evaluateBookingWindow(new Date('2026-08-01T01:00:00.000Z'), classStart)).toEqual({ canBook: true, canCancel: true });
    expect(evaluateBookingWindow(new Date('2026-08-14T23:00:00.000Z'), classStart)).toEqual({ canBook: true, canCancel: true });
  });

  it('closes booking exactly 1 hour before and cancellation after the 2 hour deadline', () => {
    expect(evaluateBookingWindow(new Date('2026-08-15T00:00:00.000Z'), classStart)).toEqual({ canBook: false, canCancel: false });
  });
});
