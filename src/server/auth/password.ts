import bcrypt from 'bcryptjs';

const PASSWORD_HASH_COST = 12;

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_HASH_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
