/** Inclusive calendar days between two YYYY-MM-DD (or Date-parsable) values. */
export function leaveDurationDays(startValue: string, endValue: string): number {
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}
