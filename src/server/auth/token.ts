import { createHash, createHmac, randomBytes } from 'node:crypto';

export function createOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function hashSessionToken(token: string, sessionSecret: string): string {
  return createHmac('sha256', sessionSecret).update(token).digest('hex');
}

export function getSessionSecret(): string {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return sessionSecret;
}
