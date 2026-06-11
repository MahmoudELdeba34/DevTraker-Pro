import Leave from '../models/Leave';
import EmployeeProfile, { IEmployeeProfile } from '../models/EmployeeProfile';
import mongoose from 'mongoose';

export const DEFAULT_ANNUAL_LEAVE_ENTITLEMENT = 21;

export interface AnnualLeaveSummary {
  annualLeaveEntitlement: number;
  remaining: number;
  used: number;
  pendingDays: number;
  available: number;
}

/** Creates a default HR profile when a user has none (e.g. legacy accounts). */
export async function ensureEmployeeProfile(
  userId: string | mongoose.Types.ObjectId
): Promise<IEmployeeProfile> {
  let profile = await EmployeeProfile.findOne({ userId });
  if (!profile) {
    profile = await EmployeeProfile.create({
      userId,
      annualLeaveEntitlement: DEFAULT_ANNUAL_LEAVE_ENTITLEMENT,
      annualLeaveBalance: DEFAULT_ANNUAL_LEAVE_ENTITLEMENT,
    });
  }
  return profile;
}

export async function getPendingAnnualLeaveDays(userId: string | mongoose.Types.ObjectId): Promise<number> {
  const leaves = await Leave.find({
    userId,
    leaveType: 'annual',
    status: 'pending',
  });
  return leaves.reduce((sum, leave) => sum + (leave.durationDays || 0), 0);
}

export async function getAnnualLeaveSummary(
  userId: string | mongoose.Types.ObjectId
): Promise<AnnualLeaveSummary> {
  const profile = await EmployeeProfile.findOne({ userId });
  const entitlement = profile?.annualLeaveEntitlement ?? DEFAULT_ANNUAL_LEAVE_ENTITLEMENT;
  const remaining = profile?.annualLeaveBalance ?? entitlement;
  const pendingDays = await getPendingAnnualLeaveDays(userId);
  const used = Math.max(0, entitlement - remaining);
  const available = Math.max(0, remaining - pendingDays);

  return {
    annualLeaveEntitlement: entitlement,
    remaining,
    used,
    pendingDays,
    available,
  };
}

export async function hasSufficientAnnualLeave(
  userId: string | mongoose.Types.ObjectId,
  requestedDays: number,
  excludeLeaveId?: string
): Promise<{ ok: boolean; summary: AnnualLeaveSummary }> {
  const summary = await getAnnualLeaveSummary(userId);

  let pendingDays = summary.pendingDays;
  if (excludeLeaveId) {
    const excluded = await Leave.findById(excludeLeaveId);
    if (excluded?.leaveType === 'annual' && excluded.status === 'pending') {
      pendingDays = Math.max(0, pendingDays - (excluded.durationDays || 0));
    }
  }

  const available = Math.max(0, summary.remaining - pendingDays);
  return { ok: available >= requestedDays, summary: { ...summary, pendingDays, available } };
}
