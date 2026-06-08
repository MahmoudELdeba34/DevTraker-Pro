import { Router, Response } from 'express';
import Workspace, { WorkspaceRole } from '../models/Workspace';
import User from '../models/User';
import Project from '../models/Project';
import Task from '../models/Task';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import {
  getWorkspaceIfMember,
  getWorkspaceIfAtLeast,
  isOwner,
  getMemberRole,
  hasAtLeastRole,
} from '../utils/workspaceAccess';
import { getActiveTrackingByUserIds } from '../utils/userTracking';
import { createNotification } from '../utils/notify';
import {
  onboardEmployeeToWorkspace,
  sendMemberCredentials,
  respondOnboarding,
} from '../services/workspaceOnboarding';

const router = Router();
router.use(authMiddleware);

const VALID_ROLES: WorkspaceRole[] = ['admin', 'member', 'viewer'];

/* ─── Serialization helpers ─────────────────────────────────────────────── */

function memberView(m: any, ownerId: string) {
  const u = m.userId; // populated user
  return {
    _id: u?._id?.toString?.() || u?.toString?.(),
    name: u?.name || '',
    email: u?.email || '',
    role: u?.role || '',                  // global role (employee/admin/etc.)
    workspaceRole: m.role as WorkspaceRole, // membership role
    isOwner: (u?._id?.toString?.() || u?.toString?.()) === ownerId.toString(),
    addedAt: m.addedAt,
  };
}

function workspaceView(ws: any) {
  return {
    _id: ws._id,
    name: ws.name,
    description: ws.description,
    ownerId: ws.ownerId,
    members: ws.members,
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
  };
}

/* ─── List workspaces (only the ones I can access) ──────────────────────── */
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId!;
    const filter =
      req.userRole === 'admin'
        ? {}
        : {
            $or: [
              { ownerId: userId },
              { 'members.userId': userId },
            ],
          };

    const workspaces = await Workspace.find(filter)
      .populate('ownerId', 'name email role')
      .populate('members.userId', 'name email role')
      .sort({ updatedAt: -1 });

    res.json({ success: true, data: workspaces.map(workspaceView) });
  } catch (err: any) {
    console.error('List workspaces error:', err);
    res.status(500).json({ success: false, error: 'Failed to load workspaces' });
  }
});

/* ─── Create workspace ──────────────────────────────────────────────────── */
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, description, memberIds } = req.body as {
      name?: string;
      description?: string;
      memberIds?: string[];                       // optional seed members
    };

    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'name is required' });
      return;
    }

    const initialMembers = (memberIds || []).map((uid) => ({
      userId: uid as any,
      role: 'member' as WorkspaceRole,
      addedAt: new Date(),
      addedBy: req.userId as any,
    }));

    const ws = await Workspace.create({
      name: name.trim(),
      description: description?.trim(),
      ownerId: req.userId,
      members: initialMembers,
    });

    // Notify seeded members
    const actor = await User.findById(req.userId).select('name');
    for (const m of initialMembers) {
      createNotification({
        userId: m.userId.toString(),
        type: 'workspace_invited',
        title: 'Added to a Workspace',
        message: `${actor?.name || 'Someone'} added you to workspace "${ws.name}".`,
        link: `/dashboard`,
      }).catch(() => {});
    }

    res.status(201).json({ success: true, data: workspaceView(ws) });
  } catch (err: any) {
    console.error('Create workspace error:', err);
    res.status(500).json({ success: false, error: 'Failed to create workspace' });
  }
});

/* ─── Update workspace (owner or admin) ─────────────────────────────────── */
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ws = await getWorkspaceIfAtLeast(req.params['id']!, req.userId!, 'admin', req.userRole);
    if (!ws) {
      res.status(403).json({ success: false, error: 'Not allowed to edit this workspace' });
      return;
    }

    const { name, description } = req.body as { name?: string; description?: string };
    if (name !== undefined) ws.name = name.trim();
    if (description !== undefined) ws.description = description?.trim();

    await ws.save();
    res.json({ success: true, data: workspaceView(ws) });
  } catch (err: any) {
    console.error('Update workspace error:', err);
    res.status(500).json({ success: false, error: 'Failed to update workspace' });
  }
});

/* ─── Delete workspace (owner only) ─────────────────────────────────────── */
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ws = await Workspace.findById(req.params['id']);
    if (!ws) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }
    if (!isOwner(ws, req.userId!) && req.userRole !== 'admin') {
      res.status(403).json({ success: false, error: 'Only the owner can delete this workspace' });
      return;
    }

    // Cascade: delete projects and their tasks inside this workspace
    const projects = await Project.find({ workspaceId: ws._id }, '_id');
    const projectIds = projects.map((p) => p._id);
    if (projectIds.length) {
      await Task.deleteMany({ projectId: { $in: projectIds } });
      await Project.deleteMany({ _id: { $in: projectIds } });
    }
    await ws.deleteOne();

    res.json({ success: true, data: { message: 'Workspace deleted' } });
  } catch (err: any) {
    console.error('Delete workspace error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete workspace' });
  }
});

/* ─── Members: list (any member can see) ────────────────────────────────── */
router.get('/:id/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ws = await getWorkspaceIfMember(req.params['id']!, req.userId!, req.userRole);
    if (!ws) {
      res.status(403).json({ success: false, error: 'Not allowed' });
      return;
    }

    await ws.populate({ path: 'members.userId', select: 'name email role' });
    await ws.populate({ path: 'ownerId', select: 'name email role' });

    const ownerId = (ws.ownerId as any)._id;
    const list = ws.members.map((m) => memberView(m, ownerId));

    // Always include the owner — even if not in members array
    const owner = ws.ownerId as any;
    if (!list.find((m) => m._id === owner._id.toString())) {
      list.unshift({
        _id: owner._id.toString(),
        name: owner.name,
        email: owner.email,
        role: owner.role,
        workspaceRole: 'admin' as WorkspaceRole,
        isOwner: true,
        addedAt: ws.createdAt,
      });
    }

    if (hasAtLeastRole(ws, req.userId!, 'admin', req.userRole)) {
      const trackingMap = await getActiveTrackingByUserIds(list.map((m) => m._id));
      for (const member of list) {
        const tracking = trackingMap.get(member._id);
        (member as any).tracking = tracking
          ? {
              type: tracking.type,
              label: tracking.label,
              startedAt: tracking.startedAt.toISOString(),
              taskId: tracking.taskId,
              project: tracking.project,
            }
          : null;
      }
    }

    res.json({ success: true, data: list });
  } catch (err: any) {
    console.error('List members error:', err);
    res.status(500).json({ success: false, error: 'Failed to load members' });
  }
});

/* ─── Search users who can be added to this workspace ───────────────────── */
router.get('/:id/available-members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const canSearch = req.userRole === 'admin' || req.userRole === 'hr';
    let ws = await getWorkspaceIfAtLeast(req.params['id']!, req.userId!, 'admin', req.userRole);
    if (!ws && canSearch) {
      ws = await Workspace.findById(req.params['id']);
    }
    if (!ws) {
      res.status(403).json({ success: false, error: 'Only workspace admins can search members' });
      return;
    }

    const q = (req.query['q'] as string | undefined)?.trim() || '';
    const excludeIds = new Set<string>([
      ws.ownerId.toString(),
      ...ws.members.map((m: any) => m.userId.toString()),
    ]);

    const filter: Record<string, unknown> = {
      _id: { $nin: Array.from(excludeIds) },
    };
    if (q) {
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter['$or'] = [{ name: regex }, { email: regex }];
    }

    const users = await User.find(filter, '_id name email role')
      .sort({ name: 1 })
      .limit(20);

    res.json({ success: true, data: users });
  } catch (err: unknown) {
    console.error('Available members search error:', err);
    res.status(500).json({ success: false, error: 'Failed to search users' });
  }
});

/* ─── Add member by userId (workspace admin only) ───────────────────────── */
router.post('/:id/members', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ws = await getWorkspaceIfAtLeast(req.params['id']!, req.userId!, 'admin', req.userRole);
    if (!ws) {
      res.status(403).json({ success: false, error: 'Only workspace admins can add members' });
      return;
    }

    const { userId, role } = req.body as { userId?: string; role?: WorkspaceRole };
    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const member = await User.findById(userId);
    if (!member) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (isOwner(ws, userId)) {
      res.status(409).json({ success: false, error: 'Owner is already in the workspace' });
      return;
    }

    if (getMemberRole(ws, userId) !== null) {
      res.status(409).json({ success: false, error: 'User is already a member' });
      return;
    }

    const finalRole: WorkspaceRole = role && VALID_ROLES.includes(role) ? role : 'member';
    ws.members.push({
      userId: member._id as any,
      role: finalRole,
      addedAt: new Date(),
      addedBy: req.userId as any,
    });
    await ws.save();

    // Notify
    const actor = await User.findById(req.userId).select('name');
    createNotification({
      userId,
      type: 'workspace_invited',
      title: 'Added to a Workspace',
      message: `${actor?.name || 'Someone'} added you to workspace "${ws.name}" as ${finalRole}.`,
      link: `/dashboard`,
    }).catch(() => {});

    await ws.populate({ path: 'members.userId', select: 'name email role' });
    res.status(201).json({ success: true, data: workspaceView(ws) });
  } catch (err: any) {
    console.error('Add member error:', err);
    res.status(500).json({ success: false, error: 'Failed to add member' });
  }
});

/* ─── Onboard employee (create account + deliver credentials) ─────────── */
router.post('/:id/onboard-employee', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await onboardEmployeeToWorkspace(req.params['id']!, req, req.body);
    respondOnboarding(res, result);
  } catch (err: unknown) {
    console.error('Onboard employee error:', err);
    res.status(500).json({ success: false, error: 'Failed to onboard employee' });
  }
});

/** @deprecated Use POST /:id/onboard-employee — kept for backward compatibility. */
router.post('/:id/invite-by-email', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await onboardEmployeeToWorkspace(req.params['id']!, req, req.body);
    respondOnboarding(res, result);
  } catch (err: unknown) {
    console.error('Invite by email error:', err);
    res.status(500).json({ success: false, error: 'Failed to invite user' });
  }
});

/* ─── Resend login credentials (admin / HR) ───────────────────────────── */
router.post(
  '/:id/members/:userId/send-credentials',
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await sendMemberCredentials(
        req.params['id']!,
        req.params['userId']!,
        req
      );
      respondOnboarding(res, result);
    } catch (err: unknown) {
      console.error('Send credentials error:', err);
      res.status(500).json({ success: false, error: 'Failed to send credentials' });
    }
  }
);

/* ─── Change a member's role (workspace admin only) ─────────────────────── */
router.put('/:id/members/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ws = await getWorkspaceIfAtLeast(req.params['id']!, req.userId!, 'admin', req.userRole);
    if (!ws) {
      res.status(403).json({ success: false, error: 'Only workspace admins can change roles' });
      return;
    }

    const targetUserId = req.params['userId']!;
    const { role } = req.body as { role?: WorkspaceRole };
    if (!role || !VALID_ROLES.includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid role' });
      return;
    }
    if (isOwner(ws, targetUserId)) {
      res.status(403).json({ success: false, error: "Can't change the owner's role" });
      return;
    }

    const member = ws.members.find((m: any) => m.userId.toString() === targetUserId);
    if (!member) {
      res.status(404).json({ success: false, error: 'Member not found' });
      return;
    }
    member.role = role;
    await ws.save();

    res.json({ success: true, data: workspaceView(ws) });
  } catch (err: any) {
    console.error('Change role error:', err);
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

/* ─── Remove a member (admin removes others, member removes self) ───────── */
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const ws = await Workspace.findById(req.params['id']);
    if (!ws) {
      res.status(404).json({ success: false, error: 'Workspace not found' });
      return;
    }

    const targetUserId = req.params['userId']!;
    const isSelfRemoval = targetUserId === req.userId;
    const callerRole = getMemberRole(ws, req.userId!);
    const isCallerAdmin =
      req.userRole === 'admin' || isOwner(ws, req.userId!) || callerRole === 'admin';

    if (!isSelfRemoval && !isCallerAdmin) {
      res.status(403).json({ success: false, error: 'Not allowed' });
      return;
    }
    if (isOwner(ws, targetUserId)) {
      res.status(403).json({ success: false, error: "Can't remove the owner" });
      return;
    }

    ws.members = ws.members.filter(
      (m: any) => m.userId.toString() !== targetUserId
    ) as any;
    await ws.save();

    res.json({ success: true, data: { message: 'Member removed' } });
  } catch (err: any) {
    console.error('Remove member error:', err);
    res.status(500).json({ success: false, error: 'Failed to remove member' });
  }
});

export default router;
