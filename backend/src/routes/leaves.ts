import { Router, Response } from 'express';
import Leave from '../models/Leave';
import EmployeeProfile from '../models/EmployeeProfile';
import Attendance from '../models/Attendance';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import { createNotification } from '../utils/notify';

const router = Router();
router.use(authMiddleware);

// Helper: Get list of YYYY-MM-DD strings in date range
function getDateRangeStrings(start: Date, end: Date): string[] {
  const dates: string[] = [];
  let curr = new Date(start);
  while (curr <= end) {
    const yyyy = curr.getFullYear();
    const mm = String(curr.getMonth() + 1).padStart(2, '0');
    const dd = String(curr.getDate()).padStart(2, '0');
    dates.push(`${yyyy}-${mm}-${dd}`);
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

// POST /api/leaves/request - Submit a leave request
router.post('/request', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { leaveType, startDate, endDate, reason } = req.body as {
      leaveType?: 'annual' | 'sick' | 'unpaid' | 'emergency';
      startDate?: string;
      endDate?: string;
      reason?: string;
    };

    if (!leaveType || !startDate || !endDate || !reason) {
      res.status(400).json({ success: false, error: 'leaveType, startDate, endDate, and reason are required' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (end < start) {
      res.status(400).json({ success: false, error: 'End date cannot be before start date' });
      return;
    }

    // Calculate duration in days
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Check leave balance if annual leave
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
      reason,
      status: 'pending'
    });

    res.status(201).json({ success: true, data: leave });
  } catch (err) {
    console.error('Create leave error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/leaves/my-requests - List self requests
router.get('/my-requests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await Leave.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('Get my leaves error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/leaves/balances - Get remaining balances
router.get('/balances', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const profile = await EmployeeProfile.findOne({ userId: req.userId }, 'annualLeaveBalance');
    res.json({ success: true, data: { annualLeaveBalance: profile?.annualLeaveBalance ?? 0 } });
  } catch (err) {
    console.error('Get balances error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/leaves/admin/pending - List all pending requests (Manager/HR/Admin only)
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

// PUT /api/leaves/admin/:id/approve - Approve a leave request (Manager/HR/Admin only)
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

    // If annual leave, deduct from employee balance
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
    leave.approvedBy = new mongoose.Types.ObjectId(req.userId) as any;
    leave.approvedAt = new Date();
    await leave.save();

    // Mark leave days in Attendance records automatically
    const dateRange = getDateRangeStrings(leave.startDate, leave.endDate);
    for (const dStr of dateRange) {
      await Attendance.findOneAndUpdate(
        { userId: leave.userId, date: dStr },
        { status: 'On Leave' },
        { upsert: true, new: true }
      );
    }

    res.json({ success: true, data: leave });

    // Notify the employee
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

// PUT /api/leaves/admin/:id/reject - Reject a leave request (Manager/HR/Admin only)
router.put('/admin/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { rejectionReason } = req.body as { rejectionReason?: string };
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      res.status(400).json({ success: false, error: 'rejectionReason is required' });
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
    leave.approvedBy = new mongoose.Types.ObjectId(req.userId) as any;
    leave.approvedAt = new Date();
    leave.rejectionReason = rejectionReason.trim();
    await leave.save();

    res.json({ success: true, data: leave });

    // Notify the employee
    createNotification({
      userId: leave.userId.toString(),
      type: 'leave_rejected',
      title: 'Leave Rejected ❌',
      message: `Your ${leave.leaveType} leave request was rejected. Reason: ${rejectionReason}`,
      link: '/request-center',
    });
  } catch (err) {
    console.error('Reject leave error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
