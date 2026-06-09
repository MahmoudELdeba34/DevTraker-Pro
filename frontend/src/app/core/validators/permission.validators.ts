const WORK_END_MINS = 17 * 60;

export function isPermissionWindowOpen(now = new Date()): boolean {
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins < WORK_END_MINS;
}

export function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatClockTime(now = new Date()): string {
  return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}
