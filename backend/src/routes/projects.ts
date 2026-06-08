import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Project from '../models/Project';
import Task from '../models/Task';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createNotification } from '../utils/notify';
import {
  listAccessibleWorkspaceIds,
  getWorkspaceIfMember,
} from '../utils/workspaceAccess';

const router = Router();
router.use(authMiddleware);

/**
 * GET /api/projects
 * Returns projects the caller can see:
 *   - Projects they own (userId === me)
 *   - Projects they are a direct member of
 *   - Projects living inside a workspace they belong to
 * Global admins see everything.
 *
 * Query:
 *   ?workspaceId=<id>   only projects in that workspace (requires membership)
 *   ?workspaceId=null   only personal/standalone projects
 */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const wsParam = req.query['workspaceId'];

    // Caller asked for a specific workspace
    if (wsParam && wsParam !== 'null') {
      const ws = await getWorkspaceIfMember(wsParam.toString(), userId, req.userRole);
      if (!ws) {
        res.status(403).json({ success: false, error: 'No access to this workspace' });
        return;
      }
      const projects = await Project.find({ workspaceId: ws._id }).sort({ createdAt: -1 });
      res.json({ success: true, data: projects });
      return;
    }

    // Caller asked for personal (no workspace)
    if (wsParam === 'null') {
      const filter: Record<string, unknown> = { workspaceId: null };
      if (req.userRole !== 'admin') {
        filter['$or'] = [{ userId }, { members: userId }];
      }
      const projects = await Project.find(filter).sort({ createdAt: -1 });
      res.json({ success: true, data: projects });
      return;
    }

    // No workspace filter — return everything the caller can see
    if (req.userRole === 'admin') {
      const projects = await Project.find({}).sort({ createdAt: -1 });
      res.json({ success: true, data: projects });
      return;
    }

    const wsIds = await listAccessibleWorkspaceIds(userId, req.userRole);
    const projects = await Project.find({
      $or: [
        { userId },
        { members: userId },
        { workspaceId: { $in: wsIds } },
      ],
    }).sort({ createdAt: -1 });

    res.json({ success: true, data: projects });
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /api/projects
 * If `workspaceId` is provided, caller must be a member of that workspace.
 */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { title, description, deadline, members, workspaceId } = req.body as {
      title?: string;
      description?: string;
      deadline?: string;
      members?: string[];
      workspaceId?: string | null;
    };

    if (!title || !title.trim()) {
      res.status(400).json({ success: false, error: 'title is required' });
      return;
    }

    if (workspaceId) {
      const ws = await getWorkspaceIfMember(workspaceId, req.userId!, req.userRole);
      if (!ws) {
        res.status(403).json({ success: false, error: 'No access to that workspace' });
        return;
      }
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

    // Notify invited members
    if (members && members.length > 0) {
      const actorName = (await User.findById(req.userId))?.name || 'Someone';
      for (const memberId of members) {
        createNotification({
          userId: memberId,
          type: 'project_invited',
          title: 'Added to Project',
          message: `${actorName} added you to project "${title}".`,
          link: `/projects/${project._id}`,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/* PUT /api/projects/:id — owner of project OR workspace admin OR global admin */
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params['id']);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const isProjectOwner = project.userId.toString() === req.userId;
    const isGlobalAdmin = req.userRole === 'admin';

    let canEdit = isProjectOwner || isGlobalAdmin;
    if (!canEdit && project.workspaceId) {
      // Workspace admins can also edit projects in their workspace
      const ws = await getWorkspaceIfMember(
        project.workspaceId.toString(),
        req.userId!,
        req.userRole
      );
      // Re-check role explicitly
      if (ws) {
        const member = ws.members.find(
          (m: any) => m.userId.toString() === req.userId
        );
        const isWsOwner = ws.ownerId.toString() === req.userId;
        canEdit = isWsOwner || member?.role === 'admin';
      }
    }
    if (!canEdit) {
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

    if (workspaceId !== undefined && workspaceId !== null) {
      const ws = await getWorkspaceIfMember(workspaceId, req.userId!, req.userRole);
      if (!ws) {
        res.status(403).json({ success: false, error: 'No access to target workspace' });
        return;
      }
    }

    if (title !== undefined) project.title = title.trim();
    if (description !== undefined) project.description = description?.trim();
    if (deadline !== undefined)
      project.deadline = deadline ? new Date(deadline) : undefined;
    if (members !== undefined)
      project.members = members.map((m) => new mongoose.Types.ObjectId(m));
    if (workspaceId !== undefined)
      project.workspaceId = workspaceId
        ? new mongoose.Types.ObjectId(workspaceId)
        : null;

    await project.save();
    res.json({ success: true, data: project });
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/* DELETE /api/projects/:id — owner of project OR workspace admin OR global admin */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const project = await Project.findById(req.params['id']);
    if (!project) {
      res.status(404).json({ success: false, error: 'Project not found' });
      return;
    }

    const isProjectOwner = project.userId.toString() === req.userId;
    const isGlobalAdmin = req.userRole === 'admin';
    let canDelete = isProjectOwner || isGlobalAdmin;

    if (!canDelete && project.workspaceId) {
      const ws = await getWorkspaceIfMember(
        project.workspaceId.toString(),
        req.userId!,
        req.userRole
      );
      if (ws) {
        const member = ws.members.find(
          (m: any) => m.userId.toString() === req.userId
        );
        const isWsOwner = ws.ownerId.toString() === req.userId;
        canDelete = isWsOwner || member?.role === 'admin';
      }
    }
    if (!canDelete) {
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
});

export default router;
