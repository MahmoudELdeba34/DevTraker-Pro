import { Router, Response } from 'express';
import Leave from '../models/Leave';
import EmployeeProfile from '../models/EmployeeProfile';
import Attendance from '../models/Attendance';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import { createNotification } from '../utils/notify';
import {
  isValidLeaveType,
  leaveDurationDays,
  meetsLeaveAdvanceNotice,
  parseDate,
  sanitizeReason,
} from '../utils/validation';

const router = Router();
router.use(authMiddleware);

function getDateRangeStrings(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const curr = new Date(start);
  const endCopy = new Date(end);
  while (curr <= endCopy) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

router.post('/request', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body as {
      leaveType?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    };

    if (!leaveType || !startDate || !endDate || !reason) {
      res.status(400).json({
        success: false,
        error: 'leaveType, startDate, endDate, and reason are required',
      });
      return;
    }

    if (!isValidLeaveType(leaveType)) {
      res.status(400).json({ success: false, error: 'Invalid leave type' });
      return;
    }

    const trimmedReason = sanitizeReason(reason);
    if (trimmedReason.length < 5) {
      res.status(400).json({ success: false, error: 'Reason must be at least 5 characters' });
      return;
    }

    const start = parseDate(startDate);
    const end = parseDate(endDate);
    if (!start || !end) {
      res.status(400).json({ success: false, error: 'Invalid date format' });
      return;
    }

    if (end < start) {
      res.status(400).json({ success: false, error: 'End date cannot be before start date' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (start < today) {
      res.status(400).json({ success: false, error: 'Leave cannot start in the past' });
      return;
    }

    if (!meetsLeaveAdvanceNotice(start)) {
      res.status(400).json({
        success: false,
        error: 'Leave requests must be submitted at least 24 hours before the start date',
      });
      return;
    }

    const durationDays = leaveDurationDays(start, end);

    const overlapping = await Leave.findOne({
      userId: req.userId,
      status: { $in: ['pending', 'approved'] },
      startDate: { $lte: end },
      endDate: { $gte: start },
    });
    if (overlapping) {
      res.status(400).json({ success: false, error: 'You already have a leave request for these dates' });
      return;
    }

    if (leaveType === 'annual') {
      const profile = await EmployeeProfile.findOne({ userId: req.userId });
      if (!profile || (profile.annualLeaveBalance || 0) < durationDays) {
        res.status(400).json({ success: false, error: 'Insufficient annual leave balance' });
        return;
      }
    }

    const leave = await Leave.create({
      userId: req.userId,
      leaveType,
      startDate: start,
      endDate: end,
      durationDays,
      reason: trimmedReason,
      status: 'pending',
    });

    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    console.error('Create leave error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/my-requests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await Leave.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('Get my leaves error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/balances', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await EmployeeProfile.findOne({ userId: req.userId }, 'annualLeaveBalance');
    res.json({ success: true, data: { annualLeaveBalance: profile?.annualLeaveBalance ?? 0 } });
  } catch (err) {
    console.error('Get balances error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/admin/pending', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const pending = await Leave.find({ status: 'pending' })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: pending });
  } catch (err) {
    console.error('Get pending leaves error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/admin/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const leave = await Leave.findById(req.params['id']);
    if (!leave) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    if (leave.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Request already processed' });
      return;
    }

    if (leave.leaveType === 'annual') {
      const profile = await EmployeeProfile.findOne({ userId: leave.userId });
      if (!profile || (profile.annualLeaveBalance || 0) < leave.durationDays) {
        res.status(400).json({ success: false, error: 'Insufficient annual leave balance for employee' });
        return;
      }
      profile.annualLeaveBalance = (profile.annualLeaveBalance || 0) - leave.durationDays;
      await profile.save();
    }

    leave.status = 'approved';
    leave.approvedBy = new mongoose.Types.ObjectId(req.userId);
    leave.approvedAt = new Date();
    await leave.save();

    const dateRange = getDateRangeStrings(leave.startDate, leave.endDate);
    for (const dStr of dateRange) {
      await Attendance.findOneAndUpdate(
        { userId: leave.userId, date: dStr },
        { status: 'On Leave' },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, data: leave });

    createNotification({
      userId: leave.userId.toString(),
      type: 'leave_approved',
      title: 'Leave Approved ✅',
      message: `Your ${leave.leaveType} leave request (${leave.durationDays} days) has been approved.`,
      link: '/request-center',
    });
  } catch (err) {
    console.error('Approve leave error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.put('/admin/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { rejectionReason } = req.body as { rejectionReason?: string };
    const trimmed = rejectionReason?.trim() ?? '';
    if (trimmed.length < 3) {
      res.status(400).json({ success: false, error: 'rejectionReason is required (min 3 characters)' });
      return;
    }

    const leave = await Leave.findById(req.params['id']);
    if (!leave) {
      res.status(404).json({ success: false, error: 'Leave request not found' });
      return;
    }

    if (leave.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Request already processed' });
      return;
    }

    leave.status = 'rejected';
    leave.approvedBy = new mongoose.Types.ObjectId(req.userId);
    leave.approvedAt = new Date();
    leave.rejectionReason = trimmed.slice(0, 500);
    await leave.save();

    res.json({ success: true, data: leave });

    createNotification({
      userId: leave.userId.toString(),
      type: 'leave_rejected',
      title: 'Leave Rejected ❌',
      message: `Your ${leave.leaveType} leave request was rejected. Reason: ${trimmed}`,
      link: '/request-center',
    });
  } catch (err) {
    console.error('Reject leave error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
