import { Router, Response } from 'express';
import Overtime from '../models/Overtime';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';
import { createNotification } from '../utils/notify';

const router = Router();
router.use(authMiddleware);

// Helper: Calculate decimal hours between two HH:MM strings
function getDurationHours(fromStr: string, toStr: string): number {
  const [fromH, fromM] = fromStr.split(':').map(Number);
  const [toH, toM] = toStr.split(':').map(Number);
  
  const fromVal = fromH * 60 + fromM;
  const toVal = toH * 60 + toM;
  
  const diffMins = Math.max(0, toVal - fromVal);
  return Number((diffMins / 60).toFixed(2));
}

// POST /api/overtime/request - Submit overtime request
router.post('/request', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { date, startTime, endTime, reason, multiplier } = req.body as {
      date?: string;
      startTime?: string;
      endTime?: string;
      reason?: string;
      multiplier?: number;
    };

    if (!date || !startTime || !endTime || !reason) {
      res.status(400).json({ success: false, error: 'date, startTime, endTime, and reason are required' });
      return;
    }

    const durationHours = getDurationHours(startTime, endTime);
    if (durationHours === 0) {
      res.status(400).json({ success: false, error: 'Invalid time interval' });
      return;
    }

    const ot = await Overtime.create({
      userId: req.userId,
      date: new Date(date),
      startTime,
      endTime,
      durationHours,
      reason,
      multiplier: multiplier || 1.5,
      status: 'pending'
    });

    res.status(201).json({ success: true, data: ot });
  } catch (err) {
    console.error('Create overtime error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/overtime/my-requests - Get self overtime history
router.get('/my-requests', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await Overtime.find({ userId: req.userId }).sort({ date: -1 });
    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Get my overtime error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/overtime/admin/pending - Get pending requests (Manager/HR/Admin only)
router.get('/admin/pending', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const pending = await Overtime.find({ status: 'pending' })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: pending });
  } catch (err) {
    console.error('Get pending overtime error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/overtime/admin/:id/approve - Approve request (Manager/HR/Admin only)
router.put('/admin/:id/approve', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const ot = await Overtime.findById(req.params['id']);
    if (!ot) {
      res.status(404).json({ success: false, error: 'Overtime record not found' });
      return;
    }

    if (ot.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Request already processed' });
      return;
    }

    ot.status = 'approved';
    ot.approvedBy = new mongoose.Types.ObjectId(req.userId) as any;
    await ot.save();

    res.json({ success: true, data: ot });

    createNotification({
      userId: ot.userId.toString(),
      type: 'overtime_approved',
      title: 'Overtime Approved ✅',
      message: `Your overtime request for ${ot.durationHours} hours has been approved.`,
      link: '/request-center',
    });
  } catch (err) {
    console.error('Approve overtime error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/overtime/admin/:id/reject - Reject request (Manager/HR/Admin only)
router.put('/admin/:id/reject', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const ot = await Overtime.findById(req.params['id']);
    if (!ot) {
      res.status(404).json({ success: false, error: 'Overtime record not found' });
      return;
    }

    if (ot.status !== 'pending') {
      res.status(400).json({ success: false, error: 'Request already processed' });
      return;
    }

    ot.status = 'rejected';
    ot.approvedBy = new mongoose.Types.ObjectId(req.userId) as any;
    await ot.save();

    res.json({ success: true, data: ot });

    createNotification({
      userId: ot.userId.toString(),
      type: 'overtime_rejected',
      title: 'Overtime Rejected ❌',
      message: `Your overtime request for ${ot.durationHours} hours has been rejected.`,
      link: '/request-center',
    });
  } catch (err) {
    console.error('Reject overtime error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
