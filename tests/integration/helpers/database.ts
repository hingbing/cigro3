import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { resetDatabase } from '@/server/db/client';

export function getPostgresErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const directCode = (error as { code?: unknown }).code;
  if (typeof directCode === 'string') return directCode;

  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const causeCode = (cause as { code?: unknown }).code;
    if (typeof causeCode === 'string') return causeCode;
  }

  return undefined;
}

export function testDb() {
  const sql = postgres(process.env.DATABASE_URL_TEST ?? '', { max: 1 });
  return { db: drizzle(sql), close: () => sql.end({ timeout: 1 }) };
}

export { resetDatabase };
