import { Router, Response } from 'express';
import Permission from '../models/Permission';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import { createNotification } from '../utils/notify';

const router = Router();
router.use(authMiddleware);

// Helper: Calculate minutes duration between two HH:MM strings
function getDurationMins(fromStr: string, toStr: string): number {
  const [fromH, fromM] = fromStr.split(':').map(Number);
  const [toH, toM] = toStr.split(':').map(Number);
  
  const fromVal = fromH * 60 + fromM;
  const toVal = toH * 60 + toM;
  
  return Math.max(0, toVal - fromVal);
}

// POST /api/permissions/request - Submit a permission request
router.post('/request', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, date, fromTime, toTime, reason } = req.body as {
      type?: 'late_arrival' | 'early_leave' | 'hourly' | 'remote' | 'correction';
      date?: string;
      fromTime?: string;
      toTime?: string;
      reason?: string;
    };

    if (!type || !date || !fromTime || !toTime || !reason) {
      res.status(400).json({ success: false, error: 'type, date, fromTime, toTime, and reason are required' });
      return;
    }

    const durationMinutes = getDurationMins(fromTime, toTime);
    if (durationMinutes === 0) {
      res.status(400).json({ success: false, error: 'Invalid time interval' });
      return;
    }

    const perm = await Permission.create({
      userId: req.userId,
      type,
      date: new Date(date),
      fromTime,
      toTime,
      durationMinutes,
      reason,
      status: 'pending'
    });

    res.status(201).json({ success: true, data: perm });
  } catch (err) {
    console.error('Create permission error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/permissions/my-requests - List self requests
router.get('/my-requests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requests = await Permission.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: requests });
  } catch (err) {
    console.error('Get my permissions error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/permissions/admin/pending - List all pending (Manager/HR/Admin only)
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

// PUT /api/permissions/admin/:id/approve - Approve request (Manager/HR/Admin only)
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
    perm.approvedBy = new mongoose.Types.ObjectId(req.userId) as any;
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

// PUT /api/permissions/admin/:id/reject - Reject request (Manager/HR/Admin only)
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
    perm.approvedBy = new mongoose.Types.ObjectId(req.userId) as any;
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
