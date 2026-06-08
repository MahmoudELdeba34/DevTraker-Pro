import { Types } from 'mongoose';
import Workspace, { IWorkspace, WorkspaceRole } from '../models/Workspace';

/**
 * Centralized workspace authorization helpers.
 *
 * Role hierarchy (highest → lowest):
 *   owner (implicit, via Workspace.ownerId)
 *   admin (can manage members, edit workspace settings)
 *   member (can read + write projects/tasks)
 *   viewer (read-only)
 *
 * `userRole` from the JWT is the GLOBAL role (admin/manager/employee/hr/accountant).
 * A global admin always has full access to any workspace, even if not listed.
 */

const ROLE_RANK: Record<WorkspaceRole, number> = {
  viewer: 1,
  member: 2,
  admin:  3,
};

function idEquals(a: any, b: any): boolean {
  if (!a || !b) return false;
  return a.toString() === b.toString();
}

export function isOwner(workspace: Pick<IWorkspace, 'ownerId'>, userId: string): boolean {
  return idEquals(workspace.ownerId, userId);
}

export function getMemberRole(
  workspace: Pick<IWorkspace, 'members'>,
  userId: string
): WorkspaceRole | null {
  const m = (workspace.members || []).find((mm: any) => idEquals(mm.userId, userId));
  return m ? m.role : null;
}

export function isMember(
  workspace: Pick<IWorkspace, 'ownerId' | 'members'>,
  userId: string,
  globalRole?: string
): boolean {
  if (globalRole === 'admin') return true;
  if (isOwner(workspace, userId)) return true;
  return getMemberRole(workspace, userId) !== null;
}

/** Owner or listed member — used for task assignee validation. */
export function isWorkspaceParticipant(
  workspace: Pick<IWorkspace, 'ownerId' | 'members'>,
  userId: string
): boolean {
  return isOwner(workspace, userId) || getMemberRole(workspace, userId) !== null;
}

export function hasAtLeastRole(
  workspace: Pick<IWorkspace, 'ownerId' | 'members'>,
  userId: string,
  required: WorkspaceRole,
  globalRole?: string
): boolean {
  if (globalRole === 'admin') return true;
  if (isOwner(workspace, userId)) return true;
  const role = getMemberRole(workspace, userId);
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/** Fetch + assert membership in one call. Returns the workspace or null. */
export async function getWorkspaceIfMember(
  workspaceId: string,
  userId: string,
  globalRole?: string
): Promise<IWorkspace | null> {
  if (!Types.ObjectId.isValid(workspaceId)) return null;
  const ws = await Workspace.findById(workspaceId);
  if (!ws) return null;
  if (!isMember(ws, userId, globalRole)) return null;
  return ws;
}

/** Fetch + assert at least `role`. Returns workspace or null. */
export async function getWorkspaceIfAtLeast(
  workspaceId: string,
  userId: string,
  required: WorkspaceRole,
  globalRole?: string
): Promise<IWorkspace | null> {
  if (!Types.ObjectId.isValid(workspaceId)) return null;
  const ws = await Workspace.findById(workspaceId);
  if (!ws) return null;
  if (!hasAtLeastRole(ws, userId, required, globalRole)) return null;
  return ws;
}

/** All workspace IDs a user can access (owner + member). Global admins get all. */
export async function listAccessibleWorkspaceIds(
  userId: string,
  globalRole?: string
): Promise<string[]> {
  if (globalRole === 'admin') {
    const all = await Workspace.find({}, '_id').lean();
    return all.map((w) => w._id.toString());
  }
  const wss = await Workspace.find(
    {
      $or: [
        { ownerId: userId },
        { 'members.userId': userId },
      ],
    },
    '_id'
  ).lean();
  return wss.map((w) => w._id.toString());
}
