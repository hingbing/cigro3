import { index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './identity';

export const notifications = pgTable('notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id').notNull().references(() => users.id),
  type: varchar('type', { length: 80 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: varchar('body', { length: 1000 }).notNull(),
  targetPath: varchar('target_path', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  readAt: timestamp('read_at', { withTimezone: true }),
  dedupeKey: varchar('dedupe_key', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  dedupeKey: uniqueIndex('notifications_dedupe_key_uq').on(table.dedupeKey),
  memberCreated: index('notifications_member_created_idx').on(table.memberId, table.createdAt.desc()),
}));
