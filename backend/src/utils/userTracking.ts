import mongoose from 'mongoose';
import Workspace from '../models/Workspace';
import Project from '../models/Project';
import Task from '../models/Task';
import TimeEntry from '../models/TimeEntry';
import { isWorkspaceParticipant } from './workspaceAccess';

export const TRACKING_ADMIN_ROLES = new Set(['admin', 'manager', 'hr']);

export interface ActiveTrackingSnapshot {
  type: 'quick' | 'task';
  label: string;
  startedAt: Date;
  taskId: string | null;
  project: { _id: string; title: string } | null;
}

export interface StopTrackingResult {
  stopped: boolean;
  timeEntry: { _id: string; duration: number } | null;
  taskTimer: { taskId: string; title: string; duration: number } | null;
}

async function resolveProjectContext(projectId: mongoose.Types.ObjectId | string | null | undefined) {
  if (!projectId) return { projectId: null, workspaceId: null };
  const project = await Project.findById(projectId).select('_id workspaceId');
  if (!project) return { projectId: null, workspaceId: null };
  return {
    projectId: project._id,
    workspaceId: project.workspaceId ?? null,
  };
}

function appendTaskTimeLog(
  task: any,
  userId: mongoose.Types.ObjectId | string,
  start: Date,
  end: Date,
  duration: number
): void {
  task.timeLogs.push({
    userId: typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId,
    start,
    end,
    duration,
  });
}

async function endRunningTimeEntry(
  entry: any,
  end: Date,
  duration: number
): Promise<void> {
  entry.endedAt = end;
  entry.duration = duration;
  await entry.save();
}

/** Finalize a running task timer and its linked TimeEntry (if any). */
async function finalizeTaskTimer(
  task: any,
  end: Date,
  duration: number,
  fallbackUserId?: string
): Promise<StopTrackingResult['taskTimer']> {
  if (!task?.activeTimerStart) return null;

  const start = new Date(task.activeTimerStart);
  const timerUserId =
    task.activeTimerUserId?.toString() || fallbackUserId || '';
  const taskId = task._id;

  appendTaskTimeLog(task, task.activeTimerUserId || fallbackUserId || timerUserId, start, end, duration);
  task.activeTimerStart = null;
  task.activeTimerUserId = null;
  await task.save();

  const runningEntry = await TimeEntry.findOne({
    userId: timerUserId,
    endedAt: null,
    taskId,
  });
  if (runningEntry) {
    await endRunningTimeEntry(runningEntry, end, duration);
  }

  return { taskId: task._id.toString(), title: task.title, duration };
}

async function stopRunningTimeEntry(userId: string): Promise<StopTrackingResult['timeEntry']> {
  const running = await TimeEntry.findOne({ userId, endedAt: null });
  if (!running) return null;

  const now = new Date();
  const duration = Math.max(0, now.getTime() - running.startedAt.getTime());
  await endRunningTimeEntry(running, now, duration);

  if (running.taskId && running.source === 'task') {
    const task = await Task.findById(running.taskId);
    if (task?.activeTimerStart) {
      await finalizeTaskTimer(task, now, duration, userId);
    } else if (task) {
      appendTaskTimeLog(task, running.userId, running.startedAt, now, duration);
      await task.save();
    }
  }

  return { _id: running._id.toString(), duration };
}

async function stopTaskTimer(task: any, userId?: string): Promise<StopTrackingResult['taskTimer']> {
  if (!task?.activeTimerStart) return null;

  const end = new Date();
  const duration = Math.max(0, end.getTime() - task.activeTimerStart.getTime());
  return finalizeTaskTimer(task, end, duration, userId);
}

/** Stop all active tracking for a user (quick session + task timers). */
export async function stopActiveTrackingForUser(
  userId: string,
  options?: { excludeTaskId?: string }
): Promise<StopTrackingResult> {
  const outcome: StopTrackingResult = {
    stopped: false,
    timeEntry: null,
    taskTimer: null,
  };

  outcome.timeEntry = await stopRunningTimeEntry(userId);
  if (outcome.timeEntry) outcome.stopped = true;

  const taskQuery: Record<string, unknown> = {
    activeTimerUserId: userId,
    activeTimerStart: { $ne: null },
  };
  if (options?.excludeTaskId && mongoose.Types.ObjectId.isValid(options.excludeTaskId)) {
    taskQuery['_id'] = { $ne: new mongoose.Types.ObjectId(options.excludeTaskId) };
  }

  const activeTasks = await Task.find(taskQuery);
  for (const task of activeTasks) {
    const stopped = await stopTaskTimer(task, userId);
    if (stopped) {
      outcome.taskTimer = stopped;
      outcome.stopped = true;
    }
  }

  return outcome;
}

/**
 * Start task timer tracking — single active session per user.
 * Writes to both Task.activeTimer* and TimeEntry (source=task).
 */
export async function startTaskTimerTracking(task: any, userId: string): Promise<Date> {
  await stopActiveTrackingForUser(userId, { excludeTaskId: task._id.toString() });

  const now = new Date();
  task.activeTimerStart = now;
  task.activeTimerUserId = new mongoose.Types.ObjectId(userId);
  await task.save();

  const ctx = await resolveProjectContext(task.projectId);
  const userObjectId = new mongoose.Types.ObjectId(userId);

  await TimeEntry.create({
    userId: userObjectId,
    taskId: task._id,
    projectId: ctx.projectId,
    workspaceId: ctx.workspaceId,
    description: (task.title || '').trim().slice(0, 280),
    startedAt: now,
    endedAt: null,
    duration: 0,
    source: 'task',
  });

  return now;
}

/** Stop a specific task timer and its linked TimeEntry. */
export async function stopTaskTimerTracking(
  task: any,
  userId: string
): Promise<StopTrackingResult['taskTimer']> {
  if (!task?.activeTimerStart) {
    const runningEntry = await TimeEntry.findOne({
      userId,
      endedAt: null,
      taskId: task._id,
      source: 'task',
    });
    if (!runningEntry) return null;

    const now = new Date();
    const duration = Math.max(0, now.getTime() - runningEntry.startedAt.getTime());
    await endRunningTimeEntry(runningEntry, now, duration);
    appendTaskTimeLog(task, runningEntry.userId, runningEntry.startedAt, now, duration);
    await task.save();
    return { taskId: task._id.toString(), title: task.title, duration };
  }

  const timerOwner = task.activeTimerUserId?.toString();
  if (timerOwner && timerOwner !== userId) return null;

  const end = new Date();
  const duration = Math.max(0, end.getTime() - task.activeTimerStart.getTime());
  return finalizeTaskTimer(task, end, duration, userId);
}

export async function canStopUserTracking(
  actorId: string,
  actorGlobalRole: string | undefined,
  targetUserId: string
): Promise<boolean> {
  if (TRACKING_ADMIN_ROLES.has(actorGlobalRole || '')) return true;
  if (actorId === targetUserId) return false;

  const actorObjectId = new mongoose.Types.ObjectId(actorId);
  const workspaces = await Workspace.find({
    $or: [
      { ownerId: actorId },
      { members: { $elemMatch: { userId: actorObjectId, role: 'admin' } } },
    ],
  });

  for (const ws of workspaces) {
    if (isWorkspaceParticipant(ws, targetUserId)) return true;
  }
  return false;
}

export async function getActiveTrackingByUserIds(
  userIds: string[]
): Promise<Map<string, ActiveTrackingSnapshot>> {
  const result = new Map<string, ActiveTrackingSnapshot>();
  if (!userIds.length) return result;

  const objectIds = userIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (!objectIds.length) return result;

  const activeEntries = await TimeEntry.find({
    userId: { $in: objectIds },
    endedAt: null,
  }).populate({
    path: 'taskId',
    select: '_id title projectId',
    populate: { path: 'projectId', select: '_id title' },
  });

  for (const e of activeEntries as any[]) {
    const uid = String(e.userId);
    const isTask = e.source === 'task' && e.taskId;
    result.set(uid, {
      type: isTask ? 'task' : 'quick',
      label: isTask
        ? e.taskId?.title || e.description || 'Task'
        : e.description || 'Quick session',
      startedAt: e.startedAt,
      taskId: isTask ? e.taskId?._id?.toString?.() || null : e.taskId?.toString?.() || null,
      project: e.taskId?.projectId
        ? {
            _id: e.taskId.projectId._id.toString(),
            title: e.taskId.projectId.title,
          }
        : null,
    });
  }

  // Legacy: task timers without a TimeEntry row (pre-migration data)
  const activeTaskTimers = await Task.find({
    activeTimerStart: { $ne: null },
    activeTimerUserId: { $in: objectIds },
  })
    .select('_id title projectId activeTimerStart activeTimerUserId')
    .populate({ path: 'projectId', select: '_id title' });

  for (const t of activeTaskTimers as any[]) {
    if (!t.activeTimerUserId) continue;
    const uid = String(t.activeTimerUserId);
    if (result.has(uid)) continue;
    result.set(uid, {
      type: 'task',
      label: t.title,
      startedAt: t.activeTimerStart,
      taskId: t._id.toString(),
      project: t.projectId
        ? { _id: t.projectId._id.toString(), title: t.projectId.title }
        : null,
    });
  }

  return result;
}

export async function stopUserTracking(targetUserId: string): Promise<StopTrackingResult> {
  return stopActiveTrackingForUser(targetUserId);
}
