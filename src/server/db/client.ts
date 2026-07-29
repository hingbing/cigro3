import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
let client: ReturnType<typeof postgres> | undefined;
export function getDb() { client ??= postgres(process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? ''); return drizzle(client); }
export async function closeDb() { if (client) { await client.end(); client = undefined; } }
export async function resetDatabase() {
  await getDb().execute('TRUNCATE TABLE passes, pass_products, class_occurrences, class_templates, sessions, invitations, users, branches CASCADE');
}
