export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'admin' | 'hr' | 'accountant';
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

export interface Workspace {
  _id: string;
  name: string;
  description?: string;
  ownerId: string | User;
  members: string[] | User[];
  createdAt: string;
  updatedAt: string;
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
export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
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
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string;
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

export interface AuthResponse {
  token: string;
  user: User;
}

export interface WhiteboardElement {
  id: string;
  type: 'sticky' | 'task' | 'text' | 'path';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  taskId?: string | null;
  points?: { x: number; y: number }[];
}

export interface WhiteboardConnection {
  fromId: string;
  toId: string;
  color?: string;
}

export interface Whiteboard {
  _id: string;
  workspaceId: string;
  title: string;
  elements: WhiteboardElement[];
  connections: WhiteboardConnection[];
  createdAt: string;
  updatedAt: string;
}
