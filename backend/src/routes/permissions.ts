import { Router, Response } from 'express';
import Permission from '../models/Permission';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import { createNotification } from '../utils/notify';
import {
  isPermissionWindowClosed,
  permissionDurationMins,
  resolvePermissionTimes,
} from '../utils/permissionWindow';
import { isValidPermissionType, sanitizeReason } from '../utils/validation';

const router = Router();
router.use(authMiddleware);

// GET /api/permissions/window — whether permission requests are open right now
router.get('/window', async (_req: AuthRequest, res: Response): Promise<void> => {
  const now = new Date();
  const closed = isPermissionWindowClosed(now);
  const times = closed ? null : resolvePermissionTimes('hourly', now);
  res.json({
    success: true,
    data: {
      open: !closed,
      currentTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      closesAt: '17:00',
      ...(times ? { sampleWindow: times } : {}),
    },
  });
});

// POST /api/permissions/request — times are set automatically from server clock
router.post('/request', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();

    if (isPermissionWindowClosed(now)) {
      res.status(400).json({
        success: false,
        error: 'Permission requests are closed after 5:00 PM',
      });
      return;
    }

    const { type, date, reason } = req.body as {
      type?: string;
      date?: string;
      reason?: string;
    };

    if (!type || !date || !reason) {
      res.status(400).json({ success: false, error: 'type, date, and reason are required' });
      return;
    }

    if (!isValidPermissionType(type)) {
      res.status(400).json({ success: false, error: 'Invalid permission type' });
      return;
    }

    const trimmedReason = sanitizeReason(reason);
    if (trimmedReason.length < 5) {
      res.status(400).json({ success: false, error: 'Reason must be at least 5 characters' });
      return;
    }

    const permDate = new Date(date);
    if (Number.isNaN(permDate.getTime())) {
      res.status(400).json({ success: false, error: 'Invalid date' });
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(permDate);
    selected.setHours(0, 0, 0, 0);
    if (selected < today) {
      res.status(400).json({ success: false, error: 'Permission date cannot be in the past' });
      return;
    }

    const { fromTime, toTime } = resolvePermissionTimes(
      type as 'late_arrival' | 'early_leave' | 'hourly' | 'remote' | 'correction',
      now
    );

    const durationMinutes = permissionDurationMins(fromTime, toTime);
    if (durationMinutes === 0) {
      res.status(400).json({
        success: false,
        error: 'Not enough working time left to submit this permission',
      });
      return;
    }

    const perm = await Permission.create({
      userId: req.userId,
      type,
      date: permDate,
      fromTime,
      toTime,
      durationMinutes,
      reason: trimmedReason,
      status: 'pending',
    });

    res.status(201).json({ success: true, data: perm });
  } catch (err) {
    console.error('Create permission error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

router.get('/my-requests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await Permission.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('Get my permissions error:', err);
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

    const pending = await Permission.find({ status: 'pending' })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: pending });
  } catch (err) {
    console.error('Get pending permissions error:', err);
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

    const perm = await Permission.findById(req.params['id']);
    if (!perm) {
      res.status(404).json({ success: false, error: 'Permission request not found' });
      return;
    }

    if (perm.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Request already processed' });
      return;
    }

    perm.status = 'approved';
    perm.approvedBy = new mongoose.Types.ObjectId(req.userId);
    await perm.save();

    res.json({ success: true, data: perm });

    createNotification({
      userId: perm.userId.toString(),
      type: 'permission_approved',
      title: 'Permission Approved ✅',
      message: `Your ${perm.type.replace('_', ' ')} permission for ${perm.fromTime} - ${perm.toTime} has been approved.`,
      link: '/request-center',
    });
  } catch (err) {
    console.error('Approve permission error:', err);
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

    const perm = await Permission.findById(req.params['id']);
    if (!perm) {
      res.status(404).json({ success: false, error: 'Permission request not found' });
      return;
    }

    if (perm.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Request already processed' });
      return;
    }

    perm.status = 'rejected';
    perm.approvedBy = new mongoose.Types.ObjectId(req.userId);
    await perm.save();

    res.json({ success: true, data: perm });

    createNotification({
      userId: perm.userId.toString(),
      type: 'permission_rejected',
      title: 'Permission Rejected ❌',
      message: `Your ${perm.type.replace('_', ' ')} permission for ${perm.fromTime} - ${perm.toTime} has been rejected.`,
      link: '/request-center',
    });
  } catch (err) {
    console.error('Reject permission error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
