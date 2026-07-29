import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '@/server/db/client';
import { invitations, sessions, users } from '@/server/db/schema';
import { hashPassword, normalizePhone } from './password';
import { createOpaqueToken, hashToken } from './token';

type TokenPurpose = 'INVITE' | 'PASSWORD_RESET';

type TokenResult =
  | { ok: true; value: { userId: string } }
  | { ok: false; error: 'TOKEN_INVALID' };

export type CreateMemberAndInvitationInput = {
  phone: string;
  defaultBranchId: string;
  createdBy?: string;
};

export async function createMemberAndInvitation(input: CreateMemberAndInvitationInput): Promise<{ memberId: string; rawToken: string; invitationUrl: string }> {
  const phone = normalizePhone(input.phone);
  const rawToken = createOpaqueToken();
  const tokenHash = hashToken(rawToken);

  return getDb().transaction(async (tx) => {
    const [existing] = await tx.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.phone, phone)).for('update');
    if (existing && (existing.role !== 'MEMBER' || existing.status !== 'INVITED')) throw new Error('PHONE_ALREADY_EXISTS');

    const member = existing ?? (await tx.insert(users).values({
      role: 'MEMBER',
      phone,
      status: 'INVITED',
      defaultBranchId: input.defaultBranchId,
    }).returning({ id: users.id }))[0];

    await tx.update(invitations).set({ invalidatedAt: sql`now()` }).where(and(
      eq(invitations.userId, member.id),
      eq(invitations.purpose, 'INVITE'),
      isNull(invitations.usedAt),
      isNull(invitations.invalidatedAt),
    ));
    await tx.insert(invitations).values({
      userId: member.id,
      purpose: 'INVITE',
      tokenHash,
      expiresAt: sql`now() + interval '7 days'`,
      createdBy: input.createdBy,
    });

    return { memberId: member.id, rawToken, invitationUrl: `/invite/${rawToken}` };
  });
}

export async function createPasswordReset(userId: string): Promise<{ rawToken: string; resetUrl: string }> {
  const rawToken = createOpaqueToken();
  const tokenHash = hashToken(rawToken);

  return getDb().transaction(async (tx) => {
    const [member] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    if (!member) throw new Error('USER_NOT_FOUND');

    await tx.update(invitations).set({ invalidatedAt: sql`now()` }).where(and(
      eq(invitations.userId, userId),
      eq(invitations.purpose, 'PASSWORD_RESET'),
      isNull(invitations.usedAt),
      isNull(invitations.invalidatedAt),
    ));
    await tx.insert(invitations).values({
      userId,
      purpose: 'PASSWORD_RESET',
      tokenHash,
      expiresAt: sql`now() + interval '30 minutes'`,
    });

    return { rawToken, resetUrl: `/reset/${rawToken}` };
  });
}

async function consumeToken(token: string, password: string, purpose: TokenPurpose): Promise<TokenResult> {
  const tokenHash = hashToken(token);
  const passwordHash = await hashPassword(password);

  return getDb().transaction(async (tx) => {
    const [invitation] = await tx.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).for('update');
    if (!invitation || invitation.purpose !== purpose || invitation.invalidatedAt || invitation.usedAt) {
      return { ok: false, error: 'TOKEN_INVALID' };
    }

    const databaseTime = await tx.execute<{ now: string | Date }>(sql`select now()`);
    const currentTime = databaseTime[0]?.now;
    const now = currentTime ? new Date(currentTime) : undefined;
    if (!now || invitation.expiresAt.getTime() <= now.getTime()) return { ok: false, error: 'TOKEN_INVALID' };

    if (purpose === 'INVITE') {
      await tx.update(users).set({ passwordHash, status: 'ACTIVE', updatedAt: now }).where(eq(users.id, invitation.userId));
    } else {
      await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, invitation.userId));
    }
    await tx.update(invitations).set({ usedAt: now }).where(eq(invitations.id, invitation.id));
    if (purpose === 'PASSWORD_RESET') await tx.delete(sessions).where(eq(sessions.userId, invitation.userId));

    return { ok: true, value: { userId: invitation.userId } };
  });
}

export function consumeInvitation(token: string, password: string): Promise<TokenResult> {
  return consumeToken(token, password, 'INVITE');
}

export function consumePasswordReset(token: string, password: string): Promise<TokenResult> {
  return consumeToken(token, password, 'PASSWORD_RESET');
}
