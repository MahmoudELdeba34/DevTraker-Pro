import { Router, Response } from 'express';
import Task, { TaskPriority, TaskStatus } from '../models/Task';
import Project from '../models/Project';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Helper: verify project ownership
async function verifyProjectOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  const project = await Project.findById(projectId);
  if (!project) return false;
  return project.userId.toString() === userId;
}

// GET /api/tasks/project/:projectId
router.get(
  '/project/:projectId',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const isOwner = await verifyProjectOwnership(
        req.params['projectId'],
        req.userId!
      );
      if (!isOwner) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const query: Record<string, unknown> = { projectId: req.params['projectId'] };

      const { status, priority, deadline } = req.query as {
        status?: string;
        priority?: string;
        deadline?: string;
      };

      if (status) query['status'] = status;
      if (priority) query['priority'] = priority;

      if (deadline) {
        const now = new Date();
        if (deadline === 'today') {
          const end = new Date(now);
          end.setHours(23, 59, 59, 999);
          query['deadline'] = { $lte: end };
        } else if (deadline === 'week') {
          const end = new Date(now);
          end.setDate(end.getDate() + 7);
          query['deadline'] = { $lte: end };
        } else if (deadline === 'overdue') {
          query['deadline'] = { $lt: now };
          query['status'] = { $ne: 'completed' };
        }
      }

      const tasks = await Task.find(query).sort({ createdAt: -1 });
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('Get tasks error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// POST /api/tasks/project/:projectId
router.post(
  '/project/:projectId',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const isOwner = await verifyProjectOwnership(
        req.params['projectId'],
        req.userId!
      );
      if (!isOwner) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const { title, priority, status, deadline } = req.body as {
        title?: string;
        priority?: TaskPriority;
        status?: TaskStatus;
        deadline?: string;
      };

      if (!title || title.trim().length === 0) {
        res.status(400).json({ success: false, error: 'title is required' });
        return;
      }

      const task = await Task.create({
        projectId: req.params['projectId'],
        title: title.trim(),
        priority: priority ?? 'medium',
        status: status ?? 'not_started',
        deadline: deadline ? new Date(deadline) : undefined,
      });

      res.status(201).json({ success: true, data: task });
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// PUT /api/tasks/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params['id']);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const isOwner = await verifyProjectOwnership(
      task.projectId.toString(),
      req.userId!
    );
    if (!isOwner) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { title, priority, status, deadline } = req.body as {
      title?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      deadline?: string;
    };

    if (title !== undefined) task.title = title.trim();
    if (priority !== undefined) task.priority = priority;
    if (status !== undefined) task.status = status;
    if (deadline !== undefined)
      task.deadline = deadline ? new Date(deadline) : undefined;

    await task.save();
    res.json({ success: true, data: task });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const task = await Task.findById(req.params['id']);
      if (!task) {
        res.status(404).json({ success: false, error: 'Task not found' });
        return;
      }

      const isOwner = await verifyProjectOwnership(
        task.projectId.toString(),
        req.userId!
      );
      if (!isOwner) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      await task.deleteOne();
      res.json({ success: true, data: { message: 'Task deleted' } });
    } catch (err) {
      console.error('Delete task error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// POST /api/tasks/:id/timer/start
router.post(
  '/:id/timer/start',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const task = await Task.findById(req.params['id']);
      if (!task) {
        res.status(404).json({ success: false, error: 'Task not found' });
        return;
      }

      const isOwner = await verifyProjectOwnership(
        task.projectId.toString(),
        req.userId!
      );
      if (!isOwner) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (task.activeTimerStart) {
        res
          .status(400)
          .json({ success: false, error: 'Timer already running' });
        return;
      }

      task.activeTimerStart = new Date();
      await task.save();
      res.json({ success: true, data: task });
    } catch (err) {
      console.error('Start timer error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// POST /api/tasks/:id/timer/stop
router.post(
  '/:id/timer/stop',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const task = await Task.findById(req.params['id']);
      if (!task) {
        res.status(404).json({ success: false, error: 'Task not found' });
        return;
      }

      const isOwner = await verifyProjectOwnership(
        task.projectId.toString(),
        req.userId!
      );
      if (!isOwner) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      if (!task.activeTimerStart) {
        res
          .status(400)
          .json({ success: false, error: 'No timer running' });
        return;
      }

      const end = new Date();
      const duration = end.getTime() - task.activeTimerStart.getTime();

      task.timeLogs.push({
        start: task.activeTimerStart,
        end,
        duration,
      });
      task.activeTimerStart = null;
      await task.save();

      res.json({ success: true, data: task });
    } catch (err) {
      console.error('Stop timer error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// GET /api/tasks/:id/timer/total
router.get(
  '/:id/timer/total',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const task = await Task.findById(req.params['id']);
      if (!task) {
        res.status(404).json({ success: false, error: 'Task not found' });
        return;
      }

      const isOwner = await verifyProjectOwnership(
        task.projectId.toString(),
        req.userId!
      );
      if (!isOwner) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const totalMs = task.timeLogs.reduce(
        (acc, log) => acc + log.duration,
        0
      );

      res.json({ success: true, data: { totalMs } });
    } catch (err) {
      console.error('Get total time error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

export default router;
