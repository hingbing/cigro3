import { index, integer, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './identity';
import { passes } from './passes';
import { classOccurrences } from './scheduling';
import { ledgerType, reservationStatus, waitlistStatus } from './enums';

export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id').notNull().references(() => users.id),
  occurrenceId: uuid('occurrence_id').notNull().references(() => classOccurrences.id),
  passId: uuid('pass_id').notNull().references(() => passes.id),
  status: reservationStatus('status').notNull().default('CONFIRMED'),
  requestId: varchar('request_id', { length: 255 }).notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
  bookedAt: timestamp('booked_at', { withTimezone: true }).notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
}, table => ({
  requestId: uniqueIndex('reservations_request_id_uq').on(table.requestId),
  activeMemberOccurrence: uniqueIndex('reservations_active_member_occurrence_uq').on(table.memberId, table.occurrenceId).where(sql`${table.status} = 'CONFIRMED'`),
  occurrenceStatus: index('reservations_occurrence_status_idx').on(table.occurrenceId, table.status),
}));

export const passLedger = pgTable('pass_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  passId: uuid('pass_id').notNull().references(() => passes.id),
  reservationId: uuid('reservation_id').references(() => reservations.id),
  type: ledgerType('type').notNull(),
  delta: integer('delta').notNull(),
  dedupeKey: varchar('dedupe_key', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, table => ({
  dedupeKey: uniqueIndex('pass_ledger_dedupe_key_uq').on(table.dedupeKey),
  passCreated: index('pass_ledger_pass_created_idx').on(table.passId, table.createdAt),
}));

export const waitlistEntries = pgTable('waitlist_entries', {
  id: uuid('id').defaultRandom().primaryKey(),
  memberId: uuid('member_id').notNull().references(() => users.id),
  occurrenceId: uuid('occurrence_id').notNull().references(() => classOccurrences.id),
  status: waitlistStatus('status').notNull().default('WAITING'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  offerExpiresAt: timestamp('offer_expires_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolutionReason: varchar('resolution_reason', { length: 255 }),
}, table => ({
  activeMemberOccurrence: uniqueIndex('waitlist_active_member_occurrence_uq').on(table.memberId, table.occurrenceId).where(sql`${table.status} in ('WAITING', 'OFFERED')`),
  queue: index('waitlist_queue_idx').on(table.occurrenceId, table.status, table.joinedAt, table.id),
}));
