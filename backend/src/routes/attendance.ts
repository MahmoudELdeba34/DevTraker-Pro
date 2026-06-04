import { Router, Response } from 'express';
import Attendance from '../models/Attendance';
import EmployeeProfile from '../models/EmployeeProfile';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Helper: Get date string (YYYY-MM-DD) in local format
function getDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// POST /api/attendance/check-in - Check-in for today
router.post('/check-in', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dateStr = getDateString(now);

    // Check if check-in already logged
    const existing = await Attendance.findOne({ userId: req.userId, date: dateStr });
    if (existing && existing.checkIn) {
      res.status(400).json({ success: false, error: 'Already checked in for today' });
      return;
    }

    // Default policy details: start at 09:00 AM (local time)
    const policyStartHour = 9;
    const policyStartMinute = 0;
    const gracePeriodMinutes = 15;

    // Check if user has specific work hours configured on profile
    const profile = await EmployeeProfile.findOne({ userId: req.userId });
    let startHour = policyStartHour;
    let startMin = policyStartMinute;
    let grace = gracePeriodMinutes;

    // Calculate late minutes
    const startOfWorkToday = new Date(now);
    startOfWorkToday.setHours(startHour, startMin, 0, 0);

    let lateMinutes = 0;
    let status: 'Present' | 'Late' = 'Present';

    const diffMs = now.getTime() - startOfWorkToday.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins > grace) {
      lateMinutes = diffMins;
      status = 'Late';
    }

    let attendance = existing;
    if (attendance) {
      attendance.checkIn = now;
      attendance.status = status;
      attendance.lateMinutes = lateMinutes;
    } else {
      attendance = new Attendance({
        userId: req.userId,
        date: dateStr,
        checkIn: now,
        status,
        lateMinutes
      });
    }

    await attendance.save();
    res.json({ success: true, data: attendance });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/attendance/check-out - Check-out for today
router.post('/check-out', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dateStr = getDateString(now);

    const attendance = await Attendance.findOne({ userId: req.userId, date: dateStr });
    if (!attendance || !attendance.checkIn) {
      res.status(400).json({ success: false, error: 'You must check-in first before checking out' });
      return;
    }

    if (attendance.checkOut) {
      res.status(400).json({ success: false, error: 'Already checked out for today' });
      return;
    }

    attendance.checkOut = now;

    // Default policy: end at 05:00 PM (17:00)
    const policyEndHour = 17;
    const policyEndMinute = 0;

    const endOfWorkToday = new Date(now);
    endOfWorkToday.setHours(policyEndHour, policyEndMinute, 0, 0);

    let earlyOutMinutes = 0;
    if (now.getTime() < endOfWorkToday.getTime()) {
      earlyOutMinutes = Math.floor((endOfWorkToday.getTime() - now.getTime()) / 60000);
    }

    // Calculate break times duration
    let breakMs = 0;
    attendance.breaks.forEach(b => {
      const bEnd = b.end || now; // If break not ended, use current time
      breakMs += (bEnd.getTime() - b.start.getTime());
    });

    const workedMs = now.getTime() - attendance.checkIn.getTime() - breakMs;
    attendance.workedMinutes = Math.max(0, Math.floor(workedMs / 60000));
    attendance.earlyOutMinutes = earlyOutMinutes;

    if (earlyOutMinutes > 0 && attendance.status !== 'Late') {
      attendance.status = 'Early Leave';
    }

    await attendance.save();
    res.json({ success: true, data: attendance });
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/attendance/break-start - Start break
router.post('/break-start', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dateStr = getDateString(now);

    const attendance = await Attendance.findOne({ userId: req.userId, date: dateStr });
    if (!attendance || !attendance.checkIn || attendance.checkOut) {
      res.status(400).json({ success: false, error: 'No active session to start break' });
      return;
    }

    // Check if already on break
    const activeBreak = attendance.breaks.find(b => !b.end);
    if (activeBreak) {
      res.status(400).json({ success: false, error: 'Already on break' });
      return;
    }

    attendance.breaks.push({ start: now });
    await attendance.save();
    res.json({ success: true, data: attendance });
  } catch (err) {
    console.error('Break start error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/attendance/break-end - End break
router.post('/break-end', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dateStr = getDateString(now);

    const attendance = await Attendance.findOne({ userId: req.userId, date: dateStr });
    if (!attendance || !attendance.checkIn || attendance.checkOut) {
      res.status(400).json({ success: false, error: 'No active session' });
      return;
    }

    const activeBreakIndex = attendance.breaks.findIndex(b => !b.end);
    if (activeBreakIndex === -1) {
      res.status(400).json({ success: false, error: 'No active break to end' });
      return;
    }

    attendance.breaks[activeBreakIndex].end = now;
    await attendance.save();
    res.json({ success: true, data: attendance });
  } catch (err) {
    console.error('Break end error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/attendance/today - Get today's log status
router.get('/today', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const dateStr = getDateString(new Date());
    const attendance = await Attendance.findOne({ userId: req.userId, date: dateStr });
    res.json({ success: true, data: attendance || null });
  } catch (err) {
    console.error('Get today attendance error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/attendance/history - Paginated history for requesting user
router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await Attendance.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Get attendance history error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/attendance/admin/today - List check-ins today (Admin/HR/Manager only)
router.get('/admin/today', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const dateStr = getDateString(new Date());
    const records = await Attendance.find({ date: dateStr }).populate('userId', 'name email role');
    res.json({ success: true, data: records });
  } catch (err) {
    console.error('Get today admin attendance error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/attendance/admin/adjust - Manually override attendance record
router.put('/admin/adjust', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { userId, date, checkIn, checkOut, status, reason } = req.body as {
      userId: string;
      date: string;
      checkIn?: string;
      checkOut?: string;
      status: string;
      reason: string;
    };

    if (!userId || !date || !status || !reason) {
      res.status(400).json({ success: false, error: 'userId, date, status, and reason are required' });
      return;
    }

    let record = await Attendance.findOne({ userId, date });
    if (!record) {
      record = new Attendance({ userId, date });
    }

    record.status = status as any;
    record.checkIn = checkIn ? new Date(checkIn) : undefined;
    record.checkOut = checkOut ? new Date(checkOut) : undefined;
    record.adjustedBy = new Object(req.userId) as any;
    record.adjustmentReason = reason;

    if (record.checkIn && record.checkOut) {
      record.workedMinutes = Math.floor((record.checkOut.getTime() - record.checkIn.getTime()) / 60000);
    }

    await record.save();
    res.json({ success: true, data: record });
  } catch (err) {
    console.error('Adjust attendance error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
