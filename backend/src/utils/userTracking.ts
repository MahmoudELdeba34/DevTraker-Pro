import mongoose from 'mongoose';
import Workspace from '../models/Workspace';
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

async function stopRunningTimeEntry(userId: string): Promise<StopTrackingResult['timeEntry']> {
  const running = await TimeEntry.findOne({ userId, endedAt: null });
  if (!running) return null;

  const now = new Date();
  running.endedAt = now;
  running.duration = Math.max(0, now.getTime() - running.startedAt.getTime());
  await running.save();
  return { _id: running._id.toString(), duration: running.duration };
}

async function stopTaskTimer(task: any): Promise<StopTrackingResult['taskTimer']> {
  if (!task?.activeTimerStart) return null;

  const end = new Date();
  const duration = Math.max(0, end.getTime() - task.activeTimerStart.getTime());
  task.timeLogs.push({
    userId: task.activeTimerUserId,
    start: task.activeTimerStart,
    end,
    duration,
  });
  task.activeTimerStart = null;
  task.activeTimerUserId = null;
  await task.save();
  return { taskId: task._id.toString(), title: task.title, duration };
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
    const stopped = await stopTaskTimer(task);
    if (stopped) {
      outcome.taskTimer = stopped;
      outcome.stopped = true;
    }
  }

  return outcome;
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

  const entryByUser = new Map<string, ActiveTrackingSnapshot>();
  for (const e of activeEntries as any[]) {
    entryByUser.set(String(e.userId), {
      type: e.source === 'task' ? 'task' : 'quick',
      label: e.description || e.taskId?.title || 'Quick session',
      startedAt: e.startedAt,
      taskId: e.taskId?._id?.toString?.() || null,
      project: e.taskId?.projectId
        ? {
            _id: e.taskId.projectId._id.toString(),
            title: e.taskId.projectId.title,
          }
        : null,
    });
  }

  const activeTaskTimers = await Task.find({
    activeTimerStart: { $ne: null },
    activeTimerUserId: { $in: objectIds },
  })
    .select('_id title projectId activeTimerStart activeTimerUserId')
    .populate({ path: 'projectId', select: '_id title' });

  for (const t of activeTaskTimers as any[]) {
    if (!t.activeTimerUserId) continue;
    const uid = String(t.activeTimerUserId);
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

  for (const [userId, entry] of entryByUser) {
    if (!result.has(userId)) result.set(userId, entry);
  }

  return result;
}

export async function stopUserTracking(targetUserId: string): Promise<StopTrackingResult> {
  return stopActiveTrackingForUser(targetUserId);
}
