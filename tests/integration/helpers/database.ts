import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { resetDatabase } from '@/server/db/client';

export type PostgresConstraintCode = '23505' | '23514' | '23P01';

function asConstraintCode(value: unknown): PostgresConstraintCode | undefined {
  return value === '23505' || value === '23514' || value === '23P01' ? value : undefined;
}

export function getPostgresErrorCode(error: unknown): PostgresConstraintCode | undefined {
  if (typeof error !== 'object' || error === null) return undefined;

  const directCode = (error as { code?: unknown }).code;
  const directConstraintCode = asConstraintCode(directCode);
  if (directConstraintCode) return directConstraintCode;

  const cause = (error as { cause?: unknown }).cause;
  if (typeof cause === 'object' && cause !== null) {
    const causeCode = (cause as { code?: unknown }).code;
    return asConstraintCode(causeCode);
  }

  return undefined;
}

export function testDb() {
  const sql = postgres(process.env.DATABASE_URL_TEST ?? '', { max: 1 });
  return { db: drizzle(sql), close: () => sql.end({ timeout: 1 }) };
}

export { resetDatabase };
