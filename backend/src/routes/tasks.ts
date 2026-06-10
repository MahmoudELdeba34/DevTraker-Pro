import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Task, { TaskPriority, TaskStatus } from '../models/Task';
import Project from '../models/Project';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createNotification } from '../utils/notify';
import { getWorkspaceIfMember, isWorkspaceParticipant } from '../utils/workspaceAccess';
import { startTaskTimerTracking, stopTaskTimerTracking } from '../utils/userTracking';
import Workspace from '../models/Workspace';

const router = Router();
router.use(authMiddleware);

/**
 * Verify access to a project, chaining through workspace membership.
 * A caller can act on a project's tasks if any of these is true:
 *   - global admin
 *   - the project owner (userId)
 *   - listed in project.members
 *   - a member of the project's parent workspace
 */
async function verifyProjectAccess(
  projectId: string,
  userId: string,
  userRole?: string
): Promise<boolean> {
  if (userRole === 'admin') return true;
  const project = await Project.findById(projectId);
  if (!project) return false;
  if (project.userId.toString() === userId) return true;
  if (project.members && project.members.some((m) => m.toString() === userId)) return true;
  if (project.workspaceId) {
    const ws = await getWorkspaceIfMember(project.workspaceId.toString(), userId, userRole);
    if (ws) return true;
  }
  return false;
}

/** When a project belongs to a workspace, assignees must be workspace participants. */
async function validateTaskAssignee(
  projectId: string,
  assigneeId: string | null | undefined
): Promise<string | null> {
  if (!assigneeId) return null;

  const project = await Project.findById(projectId).select('workspaceId');
  if (!project?.workspaceId) return null;

  const ws = await Workspace.findById(project.workspaceId);
  if (!ws) return 'Workspace not found';

  if (!isWorkspaceParticipant(ws, assigneeId)) {
    return 'Assignee must be a member of this workspace';
  }
  return null;
}

// GET /api/tasks/project/:projectId
router.get(
  '/project/:projectId',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const hasAccess = await verifyProjectAccess(
        req.params['projectId'],
        req.userId!,
        req.userRole
      );
      if (!hasAccess) {
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

      const tasks = await Task.find(query).populate('assignedTo', 'name email role').sort({ createdAt: -1 });
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
      const hasAccess = await verifyProjectAccess(
        req.params['projectId'],
        req.userId!,
        req.userRole
      );
      if (!hasAccess) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const { title, priority, status, deadline, startDate, assignedTo } = req.body as {
        title?: string;
        priority?: TaskPriority;
        status?: TaskStatus;
        deadline?: string;
        startDate?: string;
        assignedTo?: string;
      };

      if (!title || title.trim().length === 0) {
        res.status(400).json({ success: false, error: 'title is required' });
        return;
      }

      const assigneeError = await validateTaskAssignee(req.params['projectId'], assignedTo);
      if (assigneeError) {
        res.status(400).json({ success: false, error: assigneeError });
        return;
      }

      const task = await Task.create({
        projectId: req.params['projectId'],
        title: title.trim(),
        priority: priority ?? 'medium',
        status: status ?? 'not_started',
        deadline: deadline ? new Date(deadline) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null,
      });

      const populatedTask = await task.populate('assignedTo', 'name email role');

      // Notify the assigned user
      if (assignedTo) {
        const project = await Project.findById(req.params['projectId']);
        const actorName = (await User.findById(req.userId))?.name || 'Someone';
        await createNotification({
          userId: assignedTo,
          type: 'task_assigned',
          title: 'New Task Assigned',
          message: `${actorName} assigned you to task "${title}" in project "${project?.title || 'Unknown'}".`,
          link: `/projects/${req.params['projectId']}`,
        });
      }

      res.status(201).json({ success: true, data: populatedTask });
    } catch (err) {
      console.error('Create task error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// GET /api/tasks/my/timesheet
router.get(
  '/my/timesheet',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = new mongoose.Types.ObjectId(req.userId);
      const query = {
        $or: [
          { 'timeLogs.userId': userId },
          { activeTimerUserId: userId }
        ]
      };

      const tasks = await Task.find(query).populate('projectId', 'title').sort({ createdAt: -1 });
      res.json({ success: true, data: tasks });
    } catch (err) {
      console.error('Get timesheet error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// GET /api/tasks/my/active-timer — rehydrate the current user's running task timer
router.get(
  '/my/active-timer',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const userId = new mongoose.Types.ObjectId(req.userId);
      const task = await Task.findOne({
        activeTimerUserId: userId,
        activeTimerStart: { $ne: null },
      })
        .populate('projectId', 'title')
        .populate('assignedTo', 'name email role');

      res.json({ success: true, data: task });
    } catch (err) {
      console.error('Get active timer error:', err);
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

    const hasAccess = await verifyProjectAccess(
      task.projectId.toString(),
      req.userId!,
      req.userRole
    );
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { title, priority, status, deadline, startDate, assignedTo } = req.body as {
      title?: string;
      priority?: TaskPriority;
      status?: TaskStatus;
      deadline?: string | null;
      startDate?: string | null;
      assignedTo?: string | null;
    };

    if (title !== undefined) task.title = title.trim();
    if (priority !== undefined) task.priority = priority;
    if (status !== undefined) task.status = status;
    if (deadline !== undefined)
      task.deadline = deadline ? new Date(deadline) : undefined;
    if (startDate !== undefined)
      task.startDate = startDate ? new Date(startDate) : undefined;
    const previousAssignee = task.assignedTo?.toString();
    if (assignedTo !== undefined) {
      const assigneeError = await validateTaskAssignee(task.projectId.toString(), assignedTo);
      if (assigneeError) {
        res.status(400).json({ success: false, error: assigneeError });
        return;
      }
      task.assignedTo = assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null;
    }

    await task.save();
    const populatedTask = await task.populate('assignedTo', 'name email role');

    // Notify the newly assigned user if assignee changed
    if (assignedTo && assignedTo !== previousAssignee) {
      const project = await Project.findById(task.projectId);
      const actorName = (await User.findById(req.userId))?.name || 'Someone';
      await createNotification({
        userId: assignedTo,
        type: 'task_assigned',
        title: 'Task Reassigned to You',
        message: `${actorName} assigned you to task "${task.title}" in project "${project?.title || 'Unknown'}".`,
        link: `/projects/${task.projectId}`,
      });
    }

    res.json({ success: true, data: populatedTask });
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

      const hasAccess = await verifyProjectAccess(
        task.projectId.toString(),
        req.userId!,
        req.userRole
      );
      if (!hasAccess) {
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

      const hasAccess = await verifyProjectAccess(
        task.projectId.toString(),
        req.userId!,
        req.userRole
      );
      if (!hasAccess) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const userId = req.userId!;

      if (
        task.activeTimerStart &&
        task.activeTimerUserId?.toString() === userId
      ) {
        const populatedTask = await task.populate('assignedTo', 'name email role');
        res.json({ success: true, data: populatedTask });
        return;
      }

      if (
        task.activeTimerStart &&
        task.activeTimerUserId?.toString() !== userId
      ) {
        res.status(409).json({
          success: false,
          error: 'Another teammate is already tracking this task',
        });
        return;
      }

      await startTaskTimerTracking(task, userId);
      const populatedTask = await task.populate('assignedTo', 'name email role');
      res.json({ success: true, data: populatedTask });
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

      const hasAccess = await verifyProjectAccess(
        task.projectId.toString(),
        req.userId!,
        req.userRole
      );
      if (!hasAccess) {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      const stopped = await stopTaskTimerTracking(task, req.userId!);
      if (!stopped) {
        res.status(400).json({ success: false, error: 'No timer running' });
        return;
      }

      const populatedTask = await task.populate('assignedTo', 'name email role');
      res.json({ success: true, data: populatedTask });
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

      const hasAccess = await verifyProjectAccess(
        task.projectId.toString(),
        req.userId!,
        req.userRole
      );
      if (!hasAccess) {
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

// POST /api/tasks/:id/subtasks
router.post('/:id/subtasks', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params['id']);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const hasAccess = await verifyProjectAccess(
      task.projectId.toString(),
      req.userId!,
      req.userRole
    );
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { title, priority, status, assignedTo, deadline } = req.body;
    if (!title) {
      res.status(400).json({ success: false, error: 'Title is required' });
      return;
    }

    const assigneeError = await validateTaskAssignee(task.projectId.toString(), assignedTo);
    if (assigneeError) {
      res.status(400).json({ success: false, error: assigneeError });
      return;
    }

    const subtask = {
      _id: new mongoose.Types.ObjectId(),
      title,
      priority: priority || 'medium',
      status: status || 'not_started',
      assignedTo: assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null,
      deadline: deadline ? new Date(deadline) : undefined,
      createdAt: new Date()
    };

    task.subtasks.push(subtask as any);
    await task.save();
    
    const populatedTask = await task.populate('assignedTo', 'name email role');

    // Notify subtask assignee
    if (assignedTo) {
      const actorName = (await User.findById(req.userId))?.name || 'Someone';
      await createNotification({
        userId: assignedTo,
        type: 'subtask_assigned',
        title: 'Subtask Assigned',
        message: `${actorName} assigned you to subtask "${title}" under task "${task.title}".`,
        link: `/projects/${task.projectId}`,
      });
    }

    res.status(201).json({ success: true, data: populatedTask });
  } catch (err) {
    console.error('Create subtask error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/tasks/:id/subtasks/:subtaskId
router.put('/:id/subtasks/:subtaskId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params['id']);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const hasAccess = await verifyProjectAccess(
      task.projectId.toString(),
      req.userId!,
      req.userRole
    );
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const subtask = task.subtasks.find(st => st._id.toString() === req.params['subtaskId']);
    if (!subtask) {
      res.status(404).json({ success: false, error: 'Subtask not found' });
      return;
    }

    const { title, priority, status, assignedTo, deadline } = req.body;
    
    if (title !== undefined) subtask.title = title;
    if (priority !== undefined) subtask.priority = priority;
    if (status !== undefined) subtask.status = status;
    if (assignedTo !== undefined) {
      const assigneeError = await validateTaskAssignee(task.projectId.toString(), assignedTo);
      if (assigneeError) {
        res.status(400).json({ success: false, error: assigneeError });
        return;
      }
      subtask.assignedTo = assignedTo ? new mongoose.Types.ObjectId(assignedTo) : null;
    }
    if (deadline !== undefined) subtask.deadline = deadline ? new Date(deadline) : undefined;

    await task.save();
    const populatedTask = await task.populate('assignedTo', 'name email role');
    res.json({ success: true, data: populatedTask });
  } catch (err) {
    console.error('Update subtask error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/tasks/:id/subtasks/:subtaskId
router.delete('/:id/subtasks/:subtaskId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const task = await Task.findById(req.params['id']);
    if (!task) {
      res.status(404).json({ success: false, error: 'Task not found' });
      return;
    }

    const hasAccess = await verifyProjectAccess(
      task.projectId.toString(),
      req.userId!,
      req.userRole
    );
    if (!hasAccess) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    task.subtasks = task.subtasks.filter(st => st._id.toString() !== req.params['subtaskId']);
    await task.save();

    res.json({ success: true, data: { message: 'Subtask deleted' } });
  } catch (err) {
    console.error('Delete subtask error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
