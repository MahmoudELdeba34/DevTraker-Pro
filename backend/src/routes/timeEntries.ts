import { Router, Response } from 'express';
import mongoose from 'mongoose';
import TimeEntry from '../models/TimeEntry';
import Task from '../models/Task';
import Project from '../models/Project';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  stopActiveTrackingForUser,
  startTaskTimerTracking,
} from '../utils/userTracking';

const router = Router();
router.use(authMiddleware);

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function serialize(e: any) {
  return {
    _id: e._id,
    userId: e.userId,
    taskId: e.taskId,
    projectId: e.projectId,
    workspaceId: e.workspaceId,
    description: e.description,
    startedAt: e.startedAt,
    endedAt: e.endedAt,
    duration: e.duration,
    source: e.source,
    createdAt: e.createdAt,
  };
}

/* ─── GET /api/time-entries/active — my currently running entry ──────── */
router.get('/active', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const running = await TimeEntry.findOne({ userId: req.userId, endedAt: null });
    res.json({ success: true, data: running ? serialize(running) : null });
  } catch (err) {
    console.error('Get active entry error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/* ─── GET /api/time-entries — my recent entries (default 50) ─────────── */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(String(req.query['limit'] || '50'), 10), 200);
    const since = req.query['since'] ? new Date(String(req.query['since'])) : null;

    const q: Record<string, unknown> = { userId: req.userId };
    if (since && !Number.isNaN(since.getTime())) {
      q['startedAt'] = { $gte: since };
    }

    const entries = await TimeEntry.find(q).sort({ startedAt: -1 }).limit(limit);
    res.json({ success: true, data: entries.map(serialize) });
  } catch (err) {
    console.error('List time entries error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/* ─── POST /api/time-entries/start — start a quick session ────────────
 * Body: { description?, workspaceId?, projectId?, taskId? }
 * Auto-stops any running entry for this user first.
 */
router.post('/start', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { description, workspaceId, projectId, taskId } = req.body as {
      description?: string;
      workspaceId?: string | null;
      projectId?: string | null;
      taskId?: string | null;
    };

    // Task-linked session: sync Task timer + TimeEntry
    if (taskId && mongoose.Types.ObjectId.isValid(taskId)) {
      const task = await Task.findById(taskId);
      if (!task) {
        res.status(404).json({ success: false, error: 'Task not found' });
        return;
      }

      if (
        task.activeTimerStart &&
        task.activeTimerUserId?.toString() === req.userId
      ) {
        const running = await TimeEntry.findOne({ userId: req.userId, endedAt: null });
        res.status(200).json({ success: true, data: running ? serialize(running) : null });
        return;
      }

      await startTaskTimerTracking(task, req.userId!);
      const running = await TimeEntry.findOne({ userId: req.userId, endedAt: null });
      res.status(201).json({ success: true, data: running ? serialize(running) : null });
      return;
    }

    // Quick session (no task)
    await stopActiveTrackingForUser(req.userId!);

    let resolvedProjectId = projectId ? new mongoose.Types.ObjectId(projectId) : null;
    let resolvedWorkspaceId = workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null;
    if (resolvedProjectId && !resolvedWorkspaceId) {
      const project = await Project.findById(resolvedProjectId).select('workspaceId');
      if (project?.workspaceId) resolvedWorkspaceId = project.workspaceId;
    }

    const entry = await TimeEntry.create({
      userId: req.userId,
      taskId: null,
      projectId: resolvedProjectId,
      workspaceId: resolvedWorkspaceId,
      description: (description || '').trim().slice(0, 280),
      startedAt: new Date(),
      endedAt: null,
      duration: 0,
      source: 'quick',
    });

    res.status(201).json({ success: true, data: serialize(entry) });
  } catch (err: any) {
    // E11000 means another entry is already running (race condition / dupe req)
    if (err?.code === 11000) {
      const running = await TimeEntry.findOne({ userId: req.userId, endedAt: null });
      res.status(200).json({ success: true, data: running ? serialize(running) : null });
      return;
    }
    console.error('Start time entry error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/* ─── POST /api/time-entries/stop — stop the running entry ──────────── */
router.post('/stop', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const runningBefore = await TimeEntry.findOne({ userId: req.userId, endedAt: null });
    const runningId = runningBefore?._id;

    const outcome = await stopActiveTrackingForUser(req.userId!);
    if (!outcome.stopped) {
      res.json({ success: true, data: null });
      return;
    }

    if (runningId) {
      const stopped = await TimeEntry.findById(runningId);
      res.json({ success: true, data: stopped ? serialize(stopped) : null });
      return;
    }

    res.json({ success: true, data: null });
  } catch (err) {
    console.error('Stop time entry error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/* ─── PUT /api/time-entries/:id — edit description / link a task ─────
 * Lets a user attach a task to a Quick Session after the fact, ClickUp-style.
 */
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const entry = await TimeEntry.findOne({ _id: req.params['id'], userId: req.userId });
    if (!entry) {
      res.status(404).json({ success: false, error: 'Time entry not found' });
      return;
    }

    const { description, taskId, projectId, workspaceId } = req.body as {
      description?: string;
      taskId?: string | null;
      projectId?: string | null;
      workspaceId?: string | null;
    };

    if (description !== undefined) entry.description = description.trim().slice(0, 280);
    if (taskId !== undefined) {
      entry.taskId = taskId ? new mongoose.Types.ObjectId(taskId) : null;
      entry.source = taskId ? 'task' : 'quick';
    }
    if (projectId !== undefined)
      entry.projectId = projectId ? new mongoose.Types.ObjectId(projectId) : null;
    if (workspaceId !== undefined)
      entry.workspaceId = workspaceId ? new mongoose.Types.ObjectId(workspaceId) : null;

    await entry.save();
    res.json({ success: true, data: serialize(entry) });
  } catch (err) {
    console.error('Update time entry error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/* ─── DELETE /api/time-entries/:id ──────────────────────────────────── */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await TimeEntry.deleteOne({ _id: req.params['id'], userId: req.userId });
    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, error: 'Not found' });
      return;
    }
    res.json({ success: true, data: { message: 'Deleted' } });
  } catch (err) {
    console.error('Delete time entry error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
