import { Router, Response } from 'express';
import mongoose from 'mongoose';
import Attendance from '../models/Attendance';
import EmployeeProfile from '../models/EmployeeProfile';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { uploadAttendancePhotoMiddleware } from '../middleware/uploadAttendancePhoto';
import {
  buildAttendancePhotoUrl,
  deleteAttendancePhotoFile,
  validateAttendancePhotoFile,
} from '../utils/attendancePhotos';
import { isValidAttendanceStatus } from '../utils/validation';
import fs from 'fs';

const router = Router();
router.use(authMiddleware);

function getDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseWorkHours(profile: { workingHours?: number } | null): {
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  grace: number;
} {
  const hours = profile?.workingHours ?? 8;
  const startHour = 9;
  const startMin = 0;
  const endHour = startHour + hours;
  const endMin = 0;
  return { startHour, startMin, endHour, endMin, grace: 15 };
}

function attachPhoto(
  file: Express.Multer.File | undefined,
  existingUrl?: string | null
): string | undefined {
  if (!file?.path) return undefined;
  if (!validateAttendancePhotoFile(file.path)) {
    fs.unlinkSync(file.path);
    return undefined;
  }
  if (existingUrl) deleteAttendancePhotoFile(existingUrl);
  return buildAttendancePhotoUrl(file.filename);
}

// POST /api/attendance/check-in — requires face photo
router.post(
  '/check-in',
  uploadAttendancePhotoMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const now = new Date();
      const dateStr = getDateString(now);

      const existing = await Attendance.findOne({ userId: req.userId, date: dateStr });
      if (existing?.checkIn) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        res.status(400).json({ success: false, error: 'Already checked in for today' });
        return;
      }

      const photoUrl = attachPhoto(req.file, existing?.checkInPhotoUrl);
      if (!photoUrl) {
        res.status(400).json({ success: false, error: 'Invalid face photo' });
        return;
      }

      const profile = await EmployeeProfile.findOne({ userId: req.userId });
      if (profile?.status === 'suspended' || profile?.status === 'resigned') {
        deleteAttendancePhotoFile(photoUrl);
        res.status(403).json({ success: false, error: 'Account not eligible for attendance' });
        return;
      }

      const { startHour, startMin, grace } = parseWorkHours(profile);
      const startOfWorkToday = new Date(now);
      startOfWorkToday.setHours(startHour, startMin, 0, 0);

      let lateMinutes = 0;
      let status: 'Present' | 'Late' = 'Present';
      const diffMins = Math.floor((now.getTime() - startOfWorkToday.getTime()) / 60000);
      if (diffMins > grace) {
        lateMinutes = diffMins;
        status = 'Late';
      }

      let attendance = existing;
      if (attendance) {
        attendance.checkIn = now;
        attendance.status = status;
        attendance.lateMinutes = lateMinutes;
        attendance.checkInPhotoUrl = photoUrl;
      } else {
        attendance = new Attendance({
          userId: req.userId,
          date: dateStr,
          checkIn: now,
          status,
          lateMinutes,
          checkInPhotoUrl: photoUrl,
        });
      }

      await attendance.save();

      const user = await User.findById(req.userId);
      if (user && !user.facePhotoUrl) {
        user.facePhotoUrl = photoUrl;
        await user.save();
      }

      res.json({ success: true, data: attendance });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('Check-in error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// POST /api/attendance/check-out — requires face photo
router.post(
  '/check-out',
  uploadAttendancePhotoMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const now = new Date();
      const dateStr = getDateString(now);

      const attendance = await Attendance.findOne({ userId: req.userId, date: dateStr });
      if (!attendance?.checkIn) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        res.status(400).json({ success: false, error: 'You must check-in first before checking out' });
        return;
      }

      if (attendance.checkOut) {
        if (req.file?.path) fs.unlinkSync(req.file.path);
        res.status(400).json({ success: false, error: 'Already checked out for today' });
        return;
      }

      const photoUrl = attachPhoto(req.file, attendance.checkOutPhotoUrl);
      if (!photoUrl) {
        res.status(400).json({ success: false, error: 'Invalid face photo' });
        return;
      }

      attendance.checkOut = now;
      attendance.checkOutPhotoUrl = photoUrl;

      const profile = await EmployeeProfile.findOne({ userId: req.userId });
      const { endHour, endMin } = parseWorkHours(profile);

      const endOfWorkToday = new Date(now);
      endOfWorkToday.setHours(endHour, endMin, 0, 0);

      let earlyOutMinutes = 0;
      if (now.getTime() < endOfWorkToday.getTime()) {
        earlyOutMinutes = Math.floor((endOfWorkToday.getTime() - now.getTime()) / 60000);
      }

      let breakMs = 0;
      attendance.breaks.forEach((b) => {
        const bEnd = b.end || now;
        breakMs += bEnd.getTime() - b.start.getTime();
      });

      const workedMs = now.getTime() - attendance.checkIn!.getTime() - breakMs;
      attendance.workedMinutes = Math.max(0, Math.floor(workedMs / 60000));
      attendance.earlyOutMinutes = earlyOutMinutes;

      if (earlyOutMinutes > 0 && attendance.status !== 'Late') {
        attendance.status = 'Early Leave';
      }

      await attendance.save();
      res.json({ success: true, data: attendance });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('Check-out error:', err);
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
);

// POST /api/attendance/break-start
router.post('/break-start', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dateStr = getDateString(now);

    const attendance = await Attendance.findOne({ userId: req.userId, date: dateStr });
    if (!attendance?.checkIn || attendance.checkOut) {
      res.status(400).json({ success: false, error: 'No active session to start break' });
      return;
    }

    const activeBreak = attendance.breaks.find((b) => !b.end);
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

// POST /api/attendance/break-end
router.post('/break-end', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const dateStr = getDateString(now);

    const attendance = await Attendance.findOne({ userId: req.userId, date: dateStr });
    if (!attendance?.checkIn || attendance.checkOut) {
      res.status(400).json({ success: false, error: 'No active session' });
      return;
    }

    const activeBreakIndex = attendance.breaks.findIndex((b) => !b.end);
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

router.get('/history', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await Attendance.find({ userId: req.userId }).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, data: history });
  } catch (err) {
    console.error('Get attendance history error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

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

    if (!userId || !date || !status || !reason?.trim()) {
      res.status(400).json({ success: false, error: 'userId, date, status, and reason are required' });
      return;
    }

    if (!isValidAttendanceStatus(status)) {
      res.status(400).json({ success: false, error: 'Invalid attendance status' });
      return;
    }

    let record = await Attendance.findOne({ userId, date });
    if (!record) {
      record = new Attendance({ userId, date });
    }

    record.status = status as typeof record.status;
    record.checkIn = checkIn ? new Date(checkIn) : undefined;
    record.checkOut = checkOut ? new Date(checkOut) : undefined;
    record.adjustedBy = new mongoose.Types.ObjectId(req.userId);
    record.adjustmentReason = reason.trim().slice(0, 500);

    if (record.checkIn && record.checkOut && record.checkOut < record.checkIn) {
      res.status(400).json({ success: false, error: 'Check-out cannot be before check-in' });
      return;
    }

    if (record.checkIn && record.checkOut) {
      record.workedMinutes = Math.floor(
        (record.checkOut.getTime() - record.checkIn.getTime()) / 60000
      );
    }

    await record.save();
    res.json({ success: true, data: record });
  } catch (err) {
    console.error('Adjust attendance error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
