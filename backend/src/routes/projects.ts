import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Project from '../models/Project';
import Task from '../models/Task';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createNotification } from '../utils/notify';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    let query: Record<string, unknown> = {};
    if (req.userRole !== 'admin') {
      query = {
        $or: [
          { userId: req.userId },
          { members: req.userId },
        ],
      };
    }
    
    if (req.query.workspaceId) {
      query.workspaceId = req.query.workspaceId;
    } else if (req.query.workspaceId === 'null') {
      query.workspaceId = null;
    }
    const projects = await Project.find(query).sort({
      createdAt: -1,
    });
    res.json({ success: true, data: projects });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/projects
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, deadline, members, workspaceId } = req.body as {
      title?: string;
      description?: string;
      deadline?: string;
      members?: string[];
      workspaceId?: string;
    };

    if (!title || title.trim().length === 0) {
      res
        .status(400)
        .json({ success: false, error: 'title is required' });
      return;
    }

    const project = await Project.create({
      userId: req.userId,
      workspaceId: workspaceId || null,
      title: title.trim(),
      description: description?.trim(),
      deadline: deadline ? new Date(deadline) : undefined,
      members: members || [],
    });

    res.status(201).json({ success: true, data: project });

    // Notify invited members (fire and forget)
    if (members && members.length > 0) {
      const actorName = (await User.findById(req.userId))?.name || 'Someone';
      for (const memberId of members) {
        createNotification({
          userId: memberId,
          type: 'project_invited',
          title: 'Added to Project',
          message: `${actorName} added you to project "${title}".`,
          link: `/projects/${project._id}`,
        });
      }
    }
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/projects/:id
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params['id']);

    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    // Owner or admin check
    if (project.userId.toString() !== req.userId && req.userRole !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { title, description, deadline, members, workspaceId } = req.body as {
      title?: string;
      description?: string;
      deadline?: string;
      members?: string[];
      workspaceId?: string | null;
    };

    if (title !== undefined) project.title = title.trim();
    if (description !== undefined) project.description = description.trim();
    if (deadline !== undefined)
      project.deadline = deadline ? new Date(deadline) : undefined;
    if (members !== undefined) project.members = members.map(m => new mongoose.Types.ObjectId(m));
    if (workspaceId !== undefined) project.workspaceId = workspaceId ? new mongoose.Types.ObjectId(workspaceId) : undefined;

    await project.save();
    res.json({ success: true, data: project });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// DELETE /api/projects/:id
router.delete(
  '/:id',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const project = await Project.findById(req.params['id']);

      if (!project) {
        res.status(404).json({ success: false, error: 'Project not found' });
        return;
      }

      // Owner or admin check
      if (project.userId.toString() !== req.userId && req.userRole !== 'admin') {
        res.status(403).json({ success: false, error: 'Access denied' });
        return;
      }

      await Task.deleteMany({ projectId: project._id });
      await project.deleteOne();

      res.json({ success: true, data: { message: 'Project deleted' } });
    } catch (err) {
      console.error('Delete project error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

export default router;
