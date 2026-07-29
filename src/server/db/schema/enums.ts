import { pgEnum } from 'drizzle-orm/pg-core';
export const userRole = pgEnum('user_role', ['HEAD_ADMIN','BRANCH_ADMIN','INSTRUCTOR','MEMBER']);
export const userStatus = pgEnum('user_status', ['INVITED','ACTIVE','DISABLED']);
export const invitationPurpose = pgEnum('invitation_purpose', ['INVITE','PASSWORD_RESET']);
export const occurrenceStatus = pgEnum('occurrence_status', ['NORMAL','CANCELLED']);
export const reservationStatus = pgEnum('reservation_status', ['CONFIRMED','MEMBER_CANCELLED','CLASS_CANCELLED']);
export const waitlistStatus = pgEnum('waitlist_status', ['WAITING','OFFERED','CONFIRMED','DECLINED','EXPIRED','CANCELLED','SKIPPED']);
export const ledgerType = pgEnum('ledger_type', ['ISSUE','RESERVATION_DEBIT','MEMBER_CANCEL_RESTORE','CLASS_CANCEL_RESTORE']);
