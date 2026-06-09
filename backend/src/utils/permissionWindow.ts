export const WORK_START = '09:00';
export const WORK_END = '17:00';
export const WORK_END_HOUR = 17;
export const WORK_END_MINUTE = 0;

export function formatTimeHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** Permission requests cannot be submitted at or after 5:00 PM. */
export function isPermissionWindowClosed(now = new Date()): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= WORK_END_HOUR * 60 + WORK_END_MINUTE;
}

export function resolvePermissionTimes(
  type: 'late_arrival' | 'early_leave' | 'hourly' | 'remote' | 'correction',
  now = new Date()
): { fromTime: string; toTime: string } {
  const nowStr = formatTimeHHMM(now);

  switch (type) {
    case 'late_arrival':
      return { fromTime: WORK_START, toTime: nowStr };
    case 'early_leave':
      return { fromTime: nowStr, toTime: WORK_END };
    case 'hourly': {
      const endMins = Math.min(timeToMinutes(nowStr) + 60, WORK_END_HOUR * 60);
      const h = Math.floor(endMins / 60);
      const m = endMins % 60;
      return {
        fromTime: nowStr,
        toTime: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      };
    }
    case 'remote':
    case 'correction':
    default:
      return { fromTime: WORK_START, toTime: WORK_END };
  }
}

export function permissionDurationMins(fromTime: string, toTime: string): number {
  return Math.max(0, timeToMinutes(toTime) - timeToMinutes(fromTime));
}
