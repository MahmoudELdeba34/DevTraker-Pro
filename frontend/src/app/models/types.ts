export interface User {
  _id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export interface Project {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  deadline?: string;
  createdAt: string;
}

export interface TimeLog {
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

export interface Task {
  _id: string;
  projectId: string;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: string;
  timeLogs: TimeLog[];
  activeTimerStart?: string | null;
  reminders: TaskReminder[];
  createdAt: string;
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
