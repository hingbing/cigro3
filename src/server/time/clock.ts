export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function millisecondsUntil(now: Date, target: Date): number {
  return target.getTime() - now.getTime();
}
