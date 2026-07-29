import { describe, expect, it } from 'vitest';
import { selectPass } from '@/server/passes/select-pass';

const classStartsAt = new Date('2026-08-15T01:00:00.000Z');

describe('selectPass', () => {
  it('excludes exhausted and expired passes, then selects the earliest expiry', () => {
    const selected = selectPass([
      { id: 'exhausted', remainingCredits: 0, startsOn: '2026-08-01', expiresOn: '2026-08-31', issuedAt: new Date('2026-08-01T00:00:00.000Z') },
      { id: 'expired', remainingCredits: 1, startsOn: '2026-08-01', expiresOn: '2026-08-14', issuedAt: new Date('2026-08-01T00:00:00.000Z') },
      { id: 'later-expiry', remainingCredits: 1, startsOn: '2026-08-01', expiresOn: '2026-08-31', issuedAt: new Date('2026-08-01T00:00:00.000Z') },
      { id: 'earliest-expiry', remainingCredits: 1, startsOn: '2026-08-01', expiresOn: '2026-08-16', issuedAt: new Date('2026-08-05T00:00:00.000Z') },
    ], classStartsAt);

    expect(selected?.id).toBe('earliest-expiry');
  });

  it('breaks equal expiry ties by oldest issue time and then id', () => {
    expect(selectPass([
      { id: 'z-last', remainingCredits: 1, startsOn: '2026-08-01', expiresOn: '2026-08-31', issuedAt: new Date('2026-08-02T00:00:00.000Z') },
      { id: 'b-second', remainingCredits: 1, startsOn: '2026-08-01', expiresOn: '2026-08-31', issuedAt: new Date('2026-08-01T00:00:00.000Z') },
      { id: 'a-first', remainingCredits: 1, startsOn: '2026-08-01', expiresOn: '2026-08-31', issuedAt: new Date('2026-08-01T00:00:00.000Z') },
    ], classStartsAt)?.id).toBe('a-first');
  });
});
