import { describe, expect, it } from 'vitest';
import { hashPassword, normalizePhone, verifyPassword } from '@/server/auth/password';

describe('password authentication helpers', () => {
  it('hashes a password without storing its plaintext and verifies only the matching password', async () => {
    const password = 'correct-password';

    const hash = await hashPassword(password);

    expect(hash).not.toBe(password);
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('normalizes a phone number to digits before account lookup', () => {
    expect(normalizePhone('010-1234-5678')).toBe('01012345678');
  });
});
