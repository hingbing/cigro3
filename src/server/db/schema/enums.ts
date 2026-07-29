import { pgEnum } from 'drizzle-orm/pg-core';
export const userRole = pgEnum('user_role', ['HEAD_ADMIN','BRANCH_ADMIN','INSTRUCTOR','MEMBER']);
export const userStatus = pgEnum('user_status', ['INVITED','ACTIVE','DISABLED']);
export const invitationPurpose = pgEnum('invitation_purpose', ['INVITE','PASSWORD_RESET']);
export const occurrenceStatus = pgEnum('occurrence_status', ['NORMAL','CANCELLED']);
