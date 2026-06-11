export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'admin' | 'hr' | 'accountant';
  avatarUrl?: string;
  faceEnrolled?: boolean;
  facePhotoUrl?: string;
  currentPage?: string;
  lastActiveAt?: string;
  sessionStart?: string;
  createdAt?: string;
}

export interface EmployeeProfile {
  _id: string;
  userId: string;
  phone?: string;
  roleTitle?: string;
  department?: string;
  managerId?: string | User | null;
  hireDate?: string;
  contractType?: 'full-time' | 'part-time' | 'remote' | 'hybrid';
  status?: 'active' | 'suspended' | 'resigned';
  basicSalary?: number;
  salaryType?: 'monthly' | 'daily' | 'hourly';
  workingDays?: number;
  workingHours?: number;
  annualLeaveEntitlement?: number;
  annualLeaveBalance?: number;
  attendancePolicyId?: string;
  overtimePolicyId?: string;
}

export interface EmployeeWithProfile {
  _id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'admin' | 'hr' | 'accountant';
  profile: EmployeeProfile | null;
}

export type WorkspaceRole = 'admin' | 'member' | 'viewer';

export interface WorkspaceMemberEntry {
  userId: string | User;
  role: WorkspaceRole;
  addedAt?: string;
  addedBy?: string | null;
}

export interface Workspace {
  _id: string;
  name: string;
  description?: string;
  ownerId: string | User;
  // Backend now sends members as [{userId, role, addedAt}].
  // Kept the legacy union types for back-compat with any old code paths.
  members: WorkspaceMemberEntry[] | string[] | User[];
  createdAt: string;
  updatedAt: string;
}

// Fully-shaped member as returned by GET /workspaces/:id/members
export interface WorkspaceMember {
  _id: string;
  name: string;
  email: string;
  role: string;                  // global role
  avatarUrl?: string;
  workspaceRole: WorkspaceRole;  // role within the workspace
  isOwner: boolean;
  addedAt?: string;
  tracking?: PresenceTracking | null;
}

export interface Project {
  _id: string;
  userId: string;
  workspaceId?: string | null;
  title: string;
  description?: string;
  deadline?: string;
  members?: string[];
  createdAt: string;
}

export interface TimeLog {
  userId: string;
  start: string;
  end: string;
  duration: number; // ms
}

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed';
export type ReminderThreshold = '24h' | '12h' | '1h';

export interface TaskReminder {
  threshold: ReminderThreshold;
  sent: boolean;
}

export interface Subtask {
  _id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: User | string | null;
  deadline?: string;
  createdAt: string;
}

export interface Task {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string;
  startDate?: string;
  timeLogs: TimeLog[];
  subtasks: Subtask[];
  activeTimerStart?: string | null;
  activeTimerUserId?: string | null;
  assignedTo?: User | null;
  reminders: TaskReminder[];
  createdAt: string;
}

export interface Break {
  start: string;
  end?: string;
}

export interface Attendance {
  _id: string;
  userId: string | User;
  date: string;
  checkIn?: string;
  checkOut?: string;
  breaks: Break[];
  status: 'Present' | 'Absent' | 'Late' | 'Early Leave' | 'Half Day' | 'Weekend' | 'Holiday' | 'On Leave' | 'Permission' | 'Remote' | 'Missing Check-out';
  workedMinutes: number;
  lateMinutes: number;
  earlyOutMinutes: number;
  checkInPhotoUrl?: string;
  checkOutPhotoUrl?: string;
  checkInFaceVerified?: boolean;
  checkInFaceDistance?: number;
  checkOutFaceVerified?: boolean;
  checkOutFaceDistance?: number;
  adjustedBy?: string;
  adjustmentReason?: string;
}

export interface Leave {
  _id: string;
  userId: string | User;
  leaveType: 'annual' | 'sick' | 'unpaid' | 'emergency';
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  attachmentUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: string | User;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface AnnualLeaveSummary {
  annualLeaveEntitlement: number;
  remaining: number;
  used: number;
  pendingDays: number;
  available: number;
  /** @deprecated Use `remaining` — kept for backward compatibility */
  annualLeaveBalance?: number;
}

export interface Permission {
  _id: string;
  userId: string | User;
  type: 'late_arrival' | 'early_leave' | 'hourly' | 'remote' | 'correction';
  date: string;
  fromTime: string;
  toTime: string;
  durationMinutes: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  deductible: boolean;
}

export interface Overtime {
  _id: string;
  userId: string | User;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: string;
  multiplier: number;
}

export interface SalaryAdjustment {
  _id: string;
  userId: string | User;
  type: 'deduction' | 'bonus';
  subType: 'late' | 'absent' | 'bonus' | 'allowance' | 'commission' | 'penalty' | 'manual';
  amount: number;
  date: string;
  payrollMonth: string;
  reason: string;
  createdBy: string | User;
  status: 'draft' | 'approved' | 'applied' | 'cancelled';
}

export interface PayrollRun {
  _id: string;
  month: string;
  status: 'draft' | 'calculated' | 'under_review' | 'approved' | 'paid' | 'locked';
  calculatedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  summary: {
    totalBasicSalary: number;
    totalBonuses: number;
    totalDeductions: number;
    totalNetSalary: number;
    employeesCount: number;
  };
  createdAt?: string;
}

export interface Payslip {
  _id: string;
  payrollRunId: string | PayrollRun;
  userId: string | User;
  basicSalary: number;
  workedDays: number;
  absentDays: number;
  paidLeaves: number;
  unpaidLeaves: number;
  lateMinutes: number;
  overtimeHours: number;
  overtimeAmount: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  status: 'draft' | 'approved' | 'paid';
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

/* ─── Activity / Presence reports ────────────────────────────────────── */

export interface ActivityTaskLog {
  taskId: string;
  taskTitle: string;
  projectId: string | null;
  projectTitle: string;
  start: string;
  end: string;
  durationMs: number;
}

export interface ActivityQuickSession {
  _id: string;
  description: string;
  startedAt: string;
  endedAt: string | null;
  durationMs: number;
  taskId: string | null;
  source: 'quick' | 'task';
}

export interface ActivityDay {
  date: string;
  attendance: any | null;
  taskLogs: ActivityTaskLog[];
  quickSessions: ActivityQuickSession[];
  trackedMs: number;
  attendanceMs: number;
  overtimeMs: number;
}

export interface ActivitySummary {
  totalTrackedMs: number;
  totalAttendanceMs: number;
  totalOvertimeMs: number;
  dailyThresholdMs: number;
  daysPresent: number;
  daysLate: number;
  daysAbsent: number;
  daysWorked: number;
  averageDailyHours: number;
  longestDayMs: number;
  tasksWorked: number;
  quickSessionsCount: number;
}

export interface ActivityReport {
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
    currentPage: string;
    lastActiveAt: string | null;
    sessionStart: string | null;
  };
  period: { from: string; to: string; daysInRange: number };
  summary: ActivitySummary;
  daily: ActivityDay[];
}

export interface PresenceTracking {
  type: 'quick' | 'task';
  label: string;
  startedAt: string;
  taskId: string | null;
  project: { _id: string; title: string } | null;
}

export interface PresenceUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  online: boolean;
  currentPage: string;
  lastActiveAt: string | null;
  sessionStart: string | null;
  tracking: PresenceTracking | null;
}

export interface PresenceReport {
  online: PresenceUser[];
  offline: PresenceUser[];
  counts: { online: number; offline: number; total: number; tracking: number };
  windowMs: number;
}

export type TimeEntrySource = 'quick' | 'task';

export interface TimeEntry {
  _id: string;
  userId: string;
  taskId?: string | null;
  projectId?: string | null;
  workspaceId?: string | null;
  description: string;
  startedAt: string;
  endedAt?: string | null;
  duration: number;
  source: TimeEntrySource;
  createdAt: string;
}

export interface AuthResponse {
  // Old field — kept as alias for back-compat
  token: string;
  // New explicit names
  accessToken: string;
  refreshToken: string;
  user: User;
}
