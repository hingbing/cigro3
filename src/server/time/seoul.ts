import { DateTime } from 'luxon';

const SEOUL_ZONE = 'Asia/Seoul';

export function seoulDate(value: Date): string {
  return DateTime.fromJSDate(value, { zone: 'utc' }).setZone(SEOUL_ZONE).toISODate()!;
}
