import { Router, Response } from 'express';
import mongoose from 'mongoose';
import User from '../models/User';
import Task from '../models/Task';
import TimeEntry from '../models/TimeEntry';
import Attendance from '../models/Attendance';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  TRACKING_ADMIN_ROLES,
  canStopUserTracking,
  stopUserTracking,
} from '../utils/userTracking';

const router = Router();
router.use(authMiddleware);

const DAILY_THRESHOLD_MS = 7 * 60 * 60 * 1000; // overtime kicks in after 7h
const ADMIN_ROLES = TRACKING_ADMIN_ROLES;

/* ─── Types ─────────────────────────────────────────────────────────── */

interface TaskLogRow {
  taskId: string;
  taskTitle: string;
  projectId: string | null;
  projectTitle: string;
  start: Date;
  end: Date;
  durationMs: number;
}

interface QuickSessionRow {
  _id: string;
  description: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMs: number;
  taskId: string | null;
  source: 'quick' | 'task';
}

interface DayBucket {
  date: string;
  attendance: any | null;
  taskLogs: TaskLogRow[];
  quickSessions: QuickSessionRow[];
  trackedMs: number;
  attendanceMs: number;
  overtimeMs: number;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parseRange(req: AuthRequest): { from: Date; to: Date } {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const fromStr = (req.query['from'] as string) || '';
  const toStr = (req.query['to'] as string) || '';

  let from = fromStr ? new Date(fromStr) : defaultFrom;
  let to = toStr ? new Date(toStr) : defaultTo;
  if (Number.isNaN(from.getTime())) from = defaultFrom;
  if (Number.isNaN(to.getTime())) to = defaultTo;

  // Normalize: from start-of-day, to end-of-day (so YYYY-MM-DD inputs work)
  from = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0, 0);
  to = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);

  return { from, to };
}

/** Clip a duration to the requested range (handles logs that span the boundary). */
function clipDuration(start: Date, end: Date, from: Date, to: Date): number {
  const s = Math.max(start.getTime(), from.getTime());
  const e = Math.min(end.getTime(), to.getTime());
  return Math.max(0, e - s);
}

async function buildReport(userId: string, from: Date, to: Date) {
  const user = await User.findById(userId, '_id name email role currentPage lastActiveAt sessionStart');
  if (!user) return null;

  const oid = new mongoose.Types.ObjectId(userId);

  // ── 1) Attendance records in range
  const attendance = await Attendance.find({
    userId: oid,
    date: { $gte: ymd(from), $lte: ymd(to) },
  }).sort({ date: 1 });

  // ── 2) Time entries in range (primary source of truth)
  const entries = await TimeEntry.find({
    userId: oid,
    startedAt: { $lte: to },
    $or: [{ endedAt: null }, { endedAt: { $gte: from } }],
  })
    .sort({ startedAt: 1 })
    .populate({
      path: 'taskId',
      select: '_id title projectId',
      populate: { path: 'projectId', select: '_id title' },
    });

  const taskLogRows: TaskLogRow[] = [];
  const quickRows: QuickSessionRow[] = [];
  const entryStartKeys = new Set<string>();

  for (const e of entries as any[]) {
    const start = new Date(e.startedAt);
    const end = e.endedAt ? new Date(e.endedAt) : new Date();
    const dur = clipDuration(start, end, from, to);
    if (dur <= 0 && e.endedAt) continue;

    if (e.source === 'task' && e.taskId) {
      const task = e.taskId;
      entryStartKeys.add(`${String(task._id)}:${start.getTime()}`);
      taskLogRows.push({
        taskId: String(task._id),
        taskTitle: task.title || e.description || 'Task',
        projectId: task.projectId?._id ? String(task.projectId._id) : null,
        projectTitle: task.projectId?.title || 'Unknown project',
        start,
        end: e.endedAt ? end : end,
        durationMs: dur,
      });
      continue;
    }

    quickRows.push({
      _id: String(e._id),
      description: e.description || '',
      startedAt: start,
      endedAt: e.endedAt ? end : null,
      durationMs: dur,
      taskId: e.taskId ? String(e.taskId) : null,
      source: e.source,
    });
  }

  // ── 3) Legacy task.timeLogs without a matching TimeEntry (pre-sync data)
  const tasks = await Task.find(
    {
      'timeLogs.userId': oid,
      'timeLogs.start': { $lte: to },
      'timeLogs.end': { $gte: from },
    },
    '_id title projectId timeLogs'
  ).populate({ path: 'projectId', select: '_id title' });

  for (const t of tasks as any[]) {
    for (const log of t.timeLogs || []) {
      if (String(log.userId) !== userId) continue;
      const start = new Date(log.start);
      const end = new Date(log.end);
      const key = `${String(t._id)}:${start.getTime()}`;
      if (entryStartKeys.has(key)) continue;
      if (end < from || start > to) continue;
      const dur = clipDuration(start, end, from, to);
      if (dur <= 0) continue;
      taskLogRows.push({
        taskId: String(t._id),
        taskTitle: t.title,
        projectId: t.projectId?._id ? String(t.projectId._id) : null,
        projectTitle: t.projectId?.title || 'Unknown project',
        start,
        end,
        durationMs: dur,
      });
    }
  }

  // ── 4) Group everything into daily buckets
  const days: Record<string, DayBucket> = {};
  const ensureBucket = (key: string): DayBucket => {
    if (!days[key]) {
      days[key] = {
        date: key,
        attendance: null,
        taskLogs: [],
        quickSessions: [],
        trackedMs: 0,
        attendanceMs: 0,
        overtimeMs: 0,
      };
    }
    return days[key];
  };

  for (const a of attendance) {
    const b = ensureBucket(a.date);
    b.attendance = a.toObject();
    b.attendanceMs = (a.workedMinutes || 0) * 60_000;
  }
  for (const log of taskLogRows) {
    const b = ensureBucket(ymd(log.start));
    b.taskLogs.push(log);
    b.trackedMs += log.durationMs;
  }
  for (const q of quickRows) {
    const b = ensureBucket(ymd(q.startedAt));
    b.quickSessions.push(q);
    b.trackedMs += q.durationMs;
  }

  // ── 5) Overtime per day (after 7h)
  let totalOvertime = 0;
  let totalTracked = 0;
  let totalAttendance = 0;
  let longestDayMs = 0;
  let daysWorked = 0;
  for (const key of Object.keys(days)) {
    const b = days[key];
    const dayTotal = b.trackedMs || b.attendanceMs; // fall back to attendance if no tracker logs
    b.overtimeMs = Math.max(0, dayTotal - DAILY_THRESHOLD_MS);
    totalOvertime += b.overtimeMs;
    totalTracked += b.trackedMs;
    totalAttendance += b.attendanceMs;
    if (dayTotal > 0) daysWorked++;
    if (dayTotal > longestDayMs) longestDayMs = dayTotal;
  }

  const dailyList = Object.values(days).sort((a, b) => a.date.localeCompare(b.date));

  // ── 6) Summary
  const daysPresent = attendance.filter((a) =>
    ['Present', 'Late', 'Remote', 'Half Day', 'Early Leave'].includes(a.status)
  ).length;
  const daysLate = attendance.filter((a) => a.status === 'Late').length;
  const daysAbsent = attendance.filter((a) => a.status === 'Absent').length;
  const uniqueTaskIds = new Set(taskLogRows.map((l) => l.taskId));

  return {
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      currentPage: user.currentPage || '',
      lastActiveAt: user.lastActiveAt || null,
      sessionStart: user.sessionStart || null,
    },
    period: {
      from: from.toISOString(),
      to: to.toISOString(),
      daysInRange: dailyList.length,
    },
    summary: {
      totalTrackedMs: totalTracked,
      totalAttendanceMs: totalAttendance,
      totalOvertimeMs: totalOvertime,
      dailyThresholdMs: DAILY_THRESHOLD_MS,
      daysPresent,
      daysLate,
      daysAbsent,
      daysWorked,
      averageDailyHours: daysWorked > 0 ? totalTracked / daysWorked / 3600_000 : 0,
      longestDayMs,
      tasksWorked: uniqueTaskIds.size,
      quickSessionsCount: quickRows.length,
    },
    daily: dailyList,
  };
}

/* ─── Routes ────────────────────────────────────────────────────────── */

/** My own activity report */
router.get('/me', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { from, to } = parseRange(req);
    const report = await buildReport(req.userId!, from, to);
    if (!report) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: report });
  } catch (err) {
    console.error('My activity error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/** Any user's activity report — admins/managers/hr only */
router.get('/users/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const isSelf = req.params['id'] === req.userId;
    if (!isSelf && !ADMIN_ROLES.has(req.userRole || '')) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }
    const { from, to } = parseRange(req);
    const report = await buildReport(req.params['id']!, from, to);
    if (!report) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: report });
  } catch (err) {
    console.error('User activity error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/** Live team presence — every user with online status + active tracker.
 *  Admins/managers/HR only. */
router.get('/presence', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!ADMIN_ROLES.has(req.userRole || '')) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const ONLINE_WINDOW_MS = 60 * 1000; // online if heartbeat within last 60s
    const threshold = new Date(Date.now() - ONLINE_WINDOW_MS);

    const users = await User.find(
      {},
      '_id name email role currentPage lastActiveAt sessionStart'
    ).sort({ name: 1 });

    // Active TimeEntries (one per user max — partial unique index)
    const activeEntries = await TimeEntry.find({ endedAt: null }).populate({
      path: 'taskId',
      select: '_id title projectId',
      populate: { path: 'projectId', select: '_id title' },
    });

    const entryByUser = new Map<string, any>();
    for (const e of activeEntries as any[]) {
      entryByUser.set(String(e.userId), {
        _id: e._id,
        description: e.description || '',
        startedAt: e.startedAt,
        source: e.source,
        task: e.taskId ? { _id: e.taskId._id, title: e.taskId.title } : null,
        project: e.taskId?.projectId
          ? { _id: e.taskId.projectId._id, title: e.taskId.projectId.title }
          : null,
      });
    }

    // Active task-based timers (legacy path — task.activeTimerStart)
    const activeTaskTimers = await Task.find(
      { activeTimerStart: { $ne: null } },
      '_id title projectId activeTimerStart activeTimerUserId'
    ).populate({ path: 'projectId', select: '_id title' });

    const taskTimerByUser = new Map<string, any>();
    for (const t of activeTaskTimers as any[]) {
      if (!t.activeTimerUserId) continue;
      taskTimerByUser.set(String(t.activeTimerUserId), {
        taskId: t._id,
        title: t.title,
        startedAt: t.activeTimerStart,
        project: t.projectId ? { _id: t.projectId._id, title: t.projectId.title } : null,
      });
    }

    const enriched = users.map((u) => {
      const id = String(u._id);
      const isOnline = !!u.lastActiveAt && u.lastActiveAt >= threshold;
      const activeEntry = entryByUser.get(id) || null;
      const activeTaskTimer = taskTimerByUser.get(id) || null;
      // Prefer task-based timer label if both somehow exist
      const tracking = activeTaskTimer
        ? {
            type: 'task' as const,
            label: activeTaskTimer.title,
            startedAt: activeTaskTimer.startedAt,
            taskId: activeTaskTimer.taskId,
            project: activeTaskTimer.project,
          }
        : activeEntry
        ? {
            type: activeEntry.source as 'quick' | 'task',
            label: activeEntry.description || activeEntry.task?.title || 'Quick session',
            startedAt: activeEntry.startedAt,
            taskId: activeEntry.task?._id || null,
            project: activeEntry.project,
          }
        : null;

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        online: isOnline,
        currentPage: u.currentPage || '',
        lastActiveAt: u.lastActiveAt,
        sessionStart: u.sessionStart,
        tracking,
      };
    });

    const online = enriched.filter((u) => u.online);
    const offline = enriched.filter((u) => !u.online);

    res.json({
      success: true,
      data: {
        online,
        offline,
        counts: {
          online: online.length,
          offline: offline.length,
          total: enriched.length,
          tracking: enriched.filter((u) => u.tracking).length,
        },
        windowMs: ONLINE_WINDOW_MS,
      },
    });
  } catch (err) {
    console.error('Presence error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/** Force-stop any user's active timer — admins/managers/hr or workspace admins. */
router.post('/users/:id/stop-tracking', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params['id']!;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      res.status(400).json({ success: false, error: 'Invalid user id' });
      return;
    }

    const allowed = await canStopUserTracking(
      req.userId!,
      req.userRole,
      targetUserId
    );
    if (!allowed) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const result = await stopUserTracking(targetUserId);
    if (!result.stopped) {
      res.status(404).json({ success: false, error: 'No active timer for this user' });
      return;
    }

    res.json({
      success: true,
      data: {
        message: 'Timer stopped',
        ...result,
      },
    });
  } catch (err) {
    console.error('Stop user tracking error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
