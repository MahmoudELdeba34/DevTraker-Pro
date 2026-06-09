import bcrypt from 'bcrypt';
import { Response } from 'express';
import User from '../models/User';
import Workspace from '../models/Workspace';
import { AuthRequest } from '../middleware/auth';
import {
  getWorkspaceIfAtLeast,
  isOwner,
  getMemberRole,
} from '../utils/workspaceAccess';
import { createNotification } from '../utils/notify';
import { generatePassword } from '../utils/email';
import {
  deliverAccountCredentials,
  rotatePasswordAndDeliver,
  credentialsResponsePayload,
} from './onboardingCredentials';
import { WorkspaceRole } from '../models/Workspace';

const VALID_ROLES: WorkspaceRole[] = ['admin', 'member', 'viewer'];
const VALID_GLOBAL_ROLES = ['employee', 'manager', 'admin', 'hr', 'accountant'] as const;

export interface OnboardEmployeeBody {
  email?: string;
  role?: WorkspaceRole;
  globalRole?: string;
  name?: string;
}

function workspaceView(ws: any) {
  const ownerId = ws.ownerId?.toString?.() || ws.ownerId;
  return {
    _id: ws._id,
    name: ws.name,
    description: ws.description,
    ownerId,
    members: (ws.members || []).map((m: any) => {
      const u = m.userId;
      return {
        _id: u?._id?.toString?.() || u?.toString?.(),
        name: u?.name || '',
        email: u?.email || '',
        role: u?.role || '',
        workspaceRole: m.role,
        isOwner: (u?._id?.toString?.() || u?.toString?.()) === ownerId,
        addedAt: m.addedAt,
      };
    }),
    createdAt: ws.createdAt,
  };
}

export async function onboardEmployeeToWorkspace(
  workspaceId: string,
  req: AuthRequest,
  body: OnboardEmployeeBody
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const canOnboard = req.userRole === 'admin' || req.userRole === 'hr';
  let ws = await getWorkspaceIfAtLeast(workspaceId, req.userId!, 'admin', req.userRole);
  if (!ws && canOnboard) {
    ws = await Workspace.findById(workspaceId);
  }
  if (!ws) {
    return { status: 403, payload: { success: false, error: 'Only workspace admins can onboard employees' } };
  }

  const { email, role, globalRole, name } = body;
  if (!email || !email.includes('@')) {
    return { status: 400, payload: { success: false, error: 'A valid email is required' } };
  }

  const lower = email.toLowerCase().trim();
  const finalRole: WorkspaceRole = role && VALID_ROLES.includes(role) ? role : 'member';
  const assignedGlobalRole =
    globalRole && VALID_GLOBAL_ROLES.includes(globalRole as (typeof VALID_GLOBAL_ROLES)[number])
      ? globalRole
      : 'employee';

  let user = await User.findOne({ email: lower });
  let tempPassword: string | null = null;
  let newAccount = false;

  if (!user) {
    if (!canOnboard) {
      return {
        status: 404,
        payload: {
          success: false,
          error: 'No user with that email. Ask an administrator to create the account first.',
        },
      };
    }
    tempPassword = generatePassword(12);
    const passwordHash = await bcrypt.hash(tempPassword, 10);
    const displayName = (name || lower.split('@')[0] || 'User').trim();
    user = await User.create({
      name: displayName,
      email: lower,
      passwordHash,
      role: assignedGlobalRole,
    });
    newAccount = true;
  }

  if (isOwner(ws, user._id.toString())) {
    return { status: 409, payload: { success: false, error: 'This user is the workspace owner' } };
  }
  if (getMemberRole(ws, user._id.toString()) !== null) {
    return { status: 409, payload: { success: false, error: 'User is already a member' } };
  }

  ws.members.push({
    userId: user._id as any,
    role: finalRole,
    addedAt: new Date(),
    addedBy: req.userId as any,
  });
  await ws.save();

  const actor = await User.findById(req.userId).select('name');
  createNotification({
    userId: user._id.toString(),
    type: 'workspace_invited',
    title: 'Workspace Invitation',
    message: `${actor?.name || 'An admin'} invited you to workspace "${ws.name}".`,
    link: '/dashboard',
  }).catch(() => {});

  let delivery = null;
  if (tempPassword) {
    delivery = await deliverAccountCredentials({
      userId: user._id.toString(),
      email: lower,
      name: user.name,
      tempPassword,
      emailSubject: 'WorkTrack — Your account credentials',
      emailIntro: `${actor?.name || 'An administrator'} added you to <strong style="color:#e2e8f0;">${ws.name}</strong>.`,
      emailExtrasHtml: `
        <p style="margin:8px 0;"><strong>System role:</strong> ${assignedGlobalRole}</p>
        <p style="margin:8px 0;"><strong>Workspace access:</strong> ${finalRole}</p>
      `,
    });
  }

  await ws.populate({ path: 'members.userId', select: 'name email role' });

  const data: Record<string, unknown> = {
    workspace: workspaceView(ws),
    newAccount,
    emailSent: delivery?.emailSent ?? false,
    deliveryMethod: delivery?.deliveryMethod ?? 'manual',
  };

  if (delivery) {
    Object.assign(
      data,
      credentialsResponsePayload(delivery, {
        _id: user._id,
        email: user.email,
        name: user.name,
      })
    );
  } else {
    data.invitedUser = { _id: user._id, email: user.email, name: user.name };
  }

  return { status: 201, payload: { success: true, data } };
}

export async function sendMemberCredentials(
  workspaceId: string,
  targetUserId: string,
  req: AuthRequest
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const canSend = req.userRole === 'admin' || req.userRole === 'hr';
  if (!canSend) {
    return { status: 403, payload: { success: false, error: 'Admin or HR access required' } };
  }

  let ws = await getWorkspaceIfAtLeast(workspaceId, req.userId!, 'admin', req.userRole);
  if (!ws && canSend) {
    ws = await Workspace.findById(workspaceId);
  }
  if (!ws) {
    return { status: 403, payload: { success: false, error: 'Workspace not found or access denied' } };
  }

  if (getMemberRole(ws, targetUserId) === null && !isOwner(ws, targetUserId)) {
    return { status: 404, payload: { success: false, error: 'User is not a member of this workspace' } };
  }

  if (isOwner(ws, targetUserId)) {
    return { status: 403, payload: { success: false, error: 'Cannot reset credentials for the workspace owner' } };
  }

  const actor = await User.findById(req.userId).select('name');

  try {
    const result = await rotatePasswordAndDeliver({
      userId: targetUserId,
      emailIntro: `${actor?.name || 'An administrator'} sent you updated WorkTrack login credentials.`,
    });

    createNotification({
      userId: targetUserId,
      type: 'password_reset',
      title: 'Login credentials updated',
      message: result.emailSent
        ? 'Check your email for a new temporary password and setup link.'
        : 'Your administrator shared new login credentials with you.',
      link: '/login',
    }).catch(() => {});

    return {
      status: 200,
      payload: {
        success: true,
        data: credentialsResponsePayload(result, result.user, { newAccount: false }),
      },
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.message === 'USER_NOT_FOUND') {
      return { status: 404, payload: { success: false, error: 'User not found' } };
    }
    throw err;
  }
}

export function respondOnboarding(res: Response, result: { status: number; payload: Record<string, unknown> }) {
  res.status(result.status).json(result.payload);
}
