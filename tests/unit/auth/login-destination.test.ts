import { describe, expect, it } from 'vitest';
import { destinationFor } from '@/server/auth/destination';
describe('member login destination', () => { it('opens the member class list after login', () => expect(destinationFor('MEMBER')).toBe('/classes')); });
