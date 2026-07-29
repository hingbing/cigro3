import { seoulDate } from '@/server/time/seoul';

export interface PassCandidate {
  id: string;
  remainingCredits: number;
  startsOn: string;
  expiresOn: string;
  issuedAt: Date;
}

export function selectPass<T extends PassCandidate>(candidates: readonly T[], classStartsAt: Date): T | undefined {
  const classDate = seoulDate(classStartsAt);
  return candidates
    .filter(pass => pass.remainingCredits > 0 && pass.startsOn <= classDate && pass.expiresOn >= classDate)
    .slice()
    .sort((left, right) => left.expiresOn.localeCompare(right.expiresOn) || left.issuedAt.getTime() - right.issuedAt.getTime() || left.id.localeCompare(right.id))[0];
}
