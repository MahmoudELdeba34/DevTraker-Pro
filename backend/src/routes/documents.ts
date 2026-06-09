import { Router, Response } from 'express';
import Leave from '../models/Leave';
import Permission from '../models/Permission';
import Overtime from '../models/Overtime';
import EmployeeProfile from '../models/EmployeeProfile';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

const HR_ROLES = ['admin', 'hr', 'manager', 'accountant'];

function isHrRole(role?: string): boolean {
  return !!role && HR_ROLES.includes(role);
}

async function canAccessUserDocument(
  req: AuthRequest,
  ownerUserId: string
): Promise<boolean> {
  if (req.userId === ownerUserId) return true;
  return isHrRole(req.userRole);
}

// GET /api/documents/leave/:id
router.get('/leave/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const leave = await Leave.findById(req.params['id'])
      .populate('userId', 'name email role')
      .populate('approvedBy', 'name email role');

    if (!leave) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    const ownerId = leave.userId && typeof leave.userId === 'object' && '_id' in leave.userId
      ? String((leave.userId as { _id: unknown })._id)
      : String(leave.userId);

    if (!(await canAccessUserDocument(req, ownerId))) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const profile = await EmployeeProfile.findOne({ userId: ownerId }).select(
      'department roleTitle hireDate'
    );

    res.json({
      success: true,
      data: {
        type: 'leave',
        documentId: leave._id,
        reference: `LV-${String(leave._id).slice(-8).toUpperCase()}`,
        employee: leave.userId,
        profile,
        leaveType: leave.leaveType,
        startDate: leave.startDate,
        endDate: leave.endDate,
        durationDays: leave.durationDays,
        reason: leave.reason,
        status: leave.status,
        rejectionReason: leave.rejectionReason,
        submittedAt: (leave as any).createdAt,
        approvedBy: leave.approvedBy,
        approvedAt: leave.approvedAt,
      },
    });
  } catch (err) {
    console.error('Leave document error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/documents/permission/:id
router.get('/permission/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const permission = await Permission.findById(req.params['id'])
      .populate('userId', 'name email role')
      .populate('approvedBy', 'name email role');

    if (!permission) {
      res.status(404).json({ success: false, error: 'Permission request not found' });
      return;
    }

    const ownerId = permission.userId && typeof permission.userId === 'object' && '_id' in permission.userId
      ? String((permission.userId as { _id: unknown })._id)
      : String(permission.userId);

    if (!(await canAccessUserDocument(req, ownerId))) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const profile = await EmployeeProfile.findOne({ userId: ownerId }).select(
      'department roleTitle hireDate'
    );

    res.json({
      success: true,
      data: {
        type: 'permission',
        documentId: permission._id,
        reference: `PR-${String(permission._id).slice(-8).toUpperCase()}`,
        employee: permission.userId,
        profile,
        permissionType: permission.type,
        date: permission.date,
        fromTime: permission.fromTime,
        toTime: permission.toTime,
        durationMinutes: permission.durationMinutes,
        reason: permission.reason,
        status: permission.status,
        submittedAt: (permission as any).createdAt,
        approvedBy: permission.approvedBy,
      },
    });
  } catch (err) {
    console.error('Permission document error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/documents/overtime/:id
router.get('/overtime/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const overtime = await Overtime.findById(req.params['id'])
      .populate('userId', 'name email role')
      .populate('approvedBy', 'name email role');

    if (!overtime) {
      res.status(404).json({ success: false, error: 'Overtime request not found' });
      return;
    }

    const ownerId = overtime.userId && typeof overtime.userId === 'object' && '_id' in overtime.userId
      ? String((overtime.userId as { _id: unknown })._id)
      : String(overtime.userId);

    if (!(await canAccessUserDocument(req, ownerId))) {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const profile = await EmployeeProfile.findOne({ userId: ownerId }).select(
      'department roleTitle hireDate basicSalary'
    );

    res.json({
      success: true,
      data: {
        type: 'overtime',
        documentId: overtime._id,
        reference: `OT-${String(overtime._id).slice(-8).toUpperCase()}`,
        employee: overtime.userId,
        profile,
        date: overtime.date,
        startTime: overtime.startTime,
        endTime: overtime.endTime,
        durationHours: overtime.durationHours,
        multiplier: overtime.multiplier,
        reason: overtime.reason,
        status: overtime.status,
        submittedAt: (overtime as any).createdAt,
        approvedBy: overtime.approvedBy,
      },
    });
  } catch (err) {
    console.error('Overtime document error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
