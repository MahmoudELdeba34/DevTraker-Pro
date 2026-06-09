const LEAVE_TYPES = new Set(['annual', 'sick', 'unpaid', 'emergency']);
const PERMISSION_TYPES = new Set([
  'late_arrival',
  'early_leave',
  'hourly',
  'remote',
  'correction',
]);
const ATTENDANCE_STATUSES = new Set([
  'Present',
  'Absent',
  'Late',
  'Early Leave',
  'Half Day',
  'Weekend',
  'Holiday',
  'On Leave',
  'Permission',
  'Remote',
  'Missing Check-out',
]);

export const MIN_LEAVE_ADVANCE_MS = 24 * 60 * 60 * 1000;
export const MAX_REASON_LENGTH = 500;

export function parseDate(value: string): Date | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isValidLeaveType(type: string): boolean {
  return LEAVE_TYPES.has(type);
}

export function isValidPermissionType(type: string): boolean {
  return PERMISSION_TYPES.has(type);
}

export function isValidAttendanceStatus(status: string): boolean {
  return ATTENDANCE_STATUSES.has(status);
}

export function sanitizeReason(reason: string): string {
  return reason.trim().slice(0, MAX_REASON_LENGTH);
}

export function leaveDurationDays(start: Date, end: Date): number {
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
}

/** Leave must be requested at least 24 hours before the start date (start of day). */
export function meetsLeaveAdvanceNotice(start: Date, now = new Date()): boolean {
  const startOfLeave = new Date(start);
  startOfLeave.setHours(0, 0, 0, 0);
  return startOfLeave.getTime() - now.getTime() >= MIN_LEAVE_ADVANCE_MS;
}
