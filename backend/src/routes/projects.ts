import { Router, Response } from 'express';
import Project from '../models/Project';
import Task from '../models/Task';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// All routes require auth
router.use(authMiddleware);

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await Project.find({ userId: req.userId }).sort({
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
    const { title, description, deadline } = req.body as {
      title?: string;
      description?: string;
      deadline?: string;
    };

    if (!title || title.trim().length === 0) {
      res
        .status(400)
        .json({ success: false, error: 'title is required' });
      return;
    }

    const project = await Project.create({
      userId: req.userId,
      title: title.trim(),
      description: description?.trim(),
      deadline: deadline ? new Date(deadline) : undefined,
    });

    res.status(201).json({ success: true, data: project });
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

    if (project.userId.toString() !== req.userId) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { title, description, deadline } = req.body as {
      title?: string;
      description?: string;
      deadline?: string;
    };

    if (title !== undefined) project.title = title.trim();
    if (description !== undefined) project.description = description.trim();
    if (deadline !== undefined)
      project.deadline = deadline ? new Date(deadline) : undefined;

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

      if (project.userId.toString() !== req.userId) {
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
