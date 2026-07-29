import { describe, expect, it } from 'vitest';
import { calculateOfferExpiry, evaluateWaitlistWindow } from '@/server/waitlist/waitlist-window';

const classStart = new Date('2026-08-15T05:00:00.000Z');

describe('waitlist window rules', () => {
  it('uses automatic confirmation before 4 hours and acceptance from exactly 4 hours until 1 hour before class', () => {
    expect(evaluateWaitlistWindow(new Date('2026-08-15T00:59:59.999Z'), classStart)).toBe('OFFER_AUTO');
    expect(evaluateWaitlistWindow(new Date('2026-08-15T01:00:00.000Z'), classStart)).toBe('OFFER_ACCEPT');
    expect(evaluateWaitlistWindow(new Date('2026-08-15T03:59:59.999Z'), classStart)).toBe('OFFER_ACCEPT');
    expect(evaluateWaitlistWindow(new Date('2026-08-15T04:00:00.000Z'), classStart)).toBe('CLOSED');
  });

  it('expires an offer at the earlier of 30 minutes from now and one hour before class', () => {
    expect(calculateOfferExpiry(new Date('2026-08-15T02:00:00.000Z'), classStart)).toEqual(new Date('2026-08-15T02:30:00.000Z'));
    expect(calculateOfferExpiry(new Date('2026-08-15T03:45:00.000Z'), classStart)).toEqual(new Date('2026-08-15T04:00:00.000Z'));
  });
});
