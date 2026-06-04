import { Router, Response } from 'express';
import PayrollRun from '../models/PayrollRun';
import Payslip from '../models/Payslip';
import EmployeeProfile from '../models/EmployeeProfile';
import Attendance from '../models/Attendance';
import Leave from '../models/Leave';
import Overtime from '../models/Overtime';
import SalaryAdjustment from '../models/SalaryAdjustment';
import Permission from '../models/Permission';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

const router = Router();
router.use(authMiddleware);

// POST /api/payroll/run/:month - Run monthly payroll calculations
router.post('/run/:month', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'accountant') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { month } = req.params; // format: "YYYY-MM"
    if (!/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ success: false, error: 'Invalid month format (expected YYYY-MM)' });
      return;
    }

    // Check if payroll run is already locked
    const existingRun = await PayrollRun.findOne({ month });
    if (existingRun && (existingRun.status === 'locked' || existingRun.status === 'paid')) {
      res.status(400).json({ success: false, error: 'Payroll month is locked and cannot be recalculated' });
      return;
    }

    // Clean up existing run & payslips if regenerating
    if (existingRun) {
      await Payslip.deleteMany({ payrollRunId: existingRun._id });
      await existingRun.deleteOne();
    }

    const runId = new mongoose.Types.ObjectId();

    // Find all active employee profiles
    const profiles = await EmployeeProfile.find({ status: 'active' }).populate('userId', 'name email role');
    
    let totalBasicSalary = 0;
    let totalBonuses = 0;
    let totalDeductions = 0;
    let totalNetSalary = 0;
    const payslipsData: any[] = [];

    // Date range boundaries for the target month
    const startOfTargetMonth = new Date(`${month}-01T00:00:00.000Z`);
    const endOfTargetMonth = new Date(startOfTargetMonth);
    endOfTargetMonth.setMonth(endOfTargetMonth.getMonth() + 1);
    endOfTargetMonth.setTime(endOfTargetMonth.getTime() - 1);

    for (const profile of profiles) {
      const uId = profile.userId._id.toString();

      // HR Config parameters
      const basicSalary = profile.basicSalary || 0;
      const workingDays = profile.workingDays || 26;
      const workingHours = profile.workingHours || 8;

      const dailyRate = workingDays > 0 ? (basicSalary / workingDays) : 0;
      const hourlyRate = workingHours > 0 ? (dailyRate / workingHours) : 0;

      // 1. Fetch attendance records in target month
      const attendanceList = await Attendance.find({
        userId: uId,
        date: { $regex: `^${month}` }
      });

      let workedDaysCount = 0;
      let absentDaysCount = 0;
      let paidLeavesCount = 0;
      let unpaidLeavesCount = 0;
      let rawLateMinutes = 0;

      attendanceList.forEach(att => {
        if (['Present', 'Late', 'Early Leave', 'Remote'].includes(att.status)) {
          workedDaysCount++;
        }
        if (att.status === 'Absent') {
          absentDaysCount++;
        }
        if (att.status === 'Late') {
          rawLateMinutes += att.lateMinutes || 0;
        }
        if (att.status === 'Early Leave') {
          // Early leave duration can also be tracked if needed
        }
      });

      // 2. Adjust lateness: Check if approved permissions cover delays
      const approvedPermissions = await Permission.find({
        userId: uId,
        status: 'approved',
        type: 'late_arrival',
        date: { $gte: startOfTargetMonth, $lte: endOfTargetMonth }
      });

      // Subtract waived minutes
      let waivedMinutes = 0;
      approvedPermissions.forEach(p => {
        waivedMinutes += p.durationMinutes;
      });
      const netLateMinutes = Math.max(0, rawLateMinutes - waivedMinutes);

      // 3. Count paid/unpaid leaves in target month
      const leaves = await Leave.find({
        userId: uId,
        status: 'approved',
        startDate: { $lte: endOfTargetMonth },
        endDate: { $gte: startOfTargetMonth }
      });

      leaves.forEach(l => {
        if (l.leaveType === 'unpaid') {
          unpaidLeavesCount += l.durationDays;
        } else {
          paidLeavesCount += l.durationDays;
        }
      });

      // 4. Fetch approved overtime hours
      const approvedOvertime = await Overtime.find({
        userId: uId,
        status: 'approved',
        date: { $gte: startOfTargetMonth, $lte: endOfTargetMonth }
      });

      let totalOvertimeHours = 0;
      let overtimeAmount = 0;
      approvedOvertime.forEach(ot => {
        const weightedHours = ot.durationHours * (ot.multiplier || 1.5);
        totalOvertimeHours += ot.durationHours;
        overtimeAmount += weightedHours * hourlyRate;
      });

      // 5. Fetch manual deductions & bonuses
      const adjustments = await SalaryAdjustment.find({
        userId: uId,
        payrollMonth: month,
        status: 'approved'
      });

      let manualBonuses = 0;
      let manualDeductions = 0;
      adjustments.forEach(adj => {
        if (adj.type === 'bonus') {
          manualBonuses += adj.amount;
        } else if (adj.type === 'deduction') {
          manualDeductions += adj.amount;
        }
      });

      // 6. Dynamic calculations
      const latenessDeduction = Number(((netLateMinutes / 60) * hourlyRate).toFixed(2));
      const absenceDeduction = Number(((absentDaysCount + unpaidLeavesCount) * dailyRate).toFixed(2));

      const totalBonusesItem = Number((overtimeAmount + manualBonuses).toFixed(2));
      const totalDeductionsItem = Number((latenessDeduction + absenceDeduction + manualDeductions).toFixed(2));

      const netSalary = Number((basicSalary + totalBonusesItem - totalDeductionsItem).toFixed(2));

      // Accumulate totals
      totalBasicSalary += basicSalary;
      totalBonuses += totalBonusesItem;
      totalDeductions += totalDeductionsItem;
      totalNetSalary += netSalary;

      const payslip = new Payslip({
        payrollRunId: runId,
        userId: uId,
        basicSalary,
        workedDays: workedDaysCount,
        absentDays: absentDaysCount,
        paidLeaves: paidLeavesCount,
        unpaidLeaves: unpaidLeavesCount,
        lateMinutes: netLateMinutes,
        overtimeHours: totalOvertimeHours,
        overtimeAmount: Number(overtimeAmount.toFixed(2)),
        bonuses: totalBonusesItem,
        deductions: totalDeductionsItem,
        netSalary,
        status: 'draft'
      });

      await payslip.save();
      payslipsData.push(payslip);
    }

    const run = await PayrollRun.create({
      _id: runId,
      month,
      status: 'calculated',
      summary: {
        totalBasicSalary: Number(totalBasicSalary.toFixed(2)),
        totalBonuses: Number(totalBonuses.toFixed(2)),
        totalDeductions: Number(totalDeductions.toFixed(2)),
        totalNetSalary: Number(totalNetSalary.toFixed(2)),
        employeesCount: profiles.length
      }
    });

    res.status(201).json({ success: true, data: { run, payslips: payslipsData } });
  } catch (err) {
    console.error('Run payroll error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/payroll/runs - List payroll run history (HR/Admin/Accountant only)
router.get('/runs', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'accountant') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const runs = await PayrollRun.find().sort({ month: -1 });
    res.json({ success: true, data: runs });
  } catch (err) {
    console.error('List payroll runs error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/payroll/runs/:id/payslips - Get payslips inside a run (HR/Admin/Accountant only)
router.get('/runs/:id/payslips', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'accountant') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const payslips = await Payslip.find({ payrollRunId: req.params['id'] })
      .populate('userId', 'name email role')
      .sort({ netSalary: -1 });
      
    res.json({ success: true, data: payslips });
  } catch (err) {
    console.error('Get payslips error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/payroll/runs/:id/status - Change run status
router.put('/runs/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'accountant') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { status } = req.body as { status: string };
    if (!['draft', 'calculated', 'under_review', 'approved', 'paid', 'locked'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status transition value' });
      return;
    }

    const run = await PayrollRun.findById(req.params['id']);
    if (!run) {
      res.status(404).json({ success: false, error: 'Payroll run not found' });
      return;
    }

    run.status = status as any;
    if (status === 'approved') {
      run.approvedAt = new Date();
      run.approvedBy = new mongoose.Types.ObjectId(req.userId) as any;
      
      // Update individual payslips statuses to approved
      await Payslip.updateMany({ payrollRunId: run._id }, { status: 'approved' });
    }
    if (status === 'paid') {
      await Payslip.updateMany({ payrollRunId: run._id }, { status: 'paid' });
    }

    await run.save();
    res.json({ success: true, data: run });
  } catch (err) {
    console.error('Update payroll run status error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/payroll/my-payslips - Get employee's own payslips
router.get('/my-payslips', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const payslips = await Payslip.find({ userId: req.userId })
      .populate({
        path: 'payrollRunId',
        select: 'month status'
      })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: payslips });
  } catch (err) {
    console.error('Get my payslips error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/payroll/adjustments - Add a manual deduction/bonus
router.post('/adjustments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'accountant') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { userId, type, subType, amount, payrollMonth, reason } = req.body as {
      userId?: string;
      type?: 'deduction' | 'bonus';
      subType?: 'bonus' | 'allowance' | 'commission' | 'penalty' | 'manual';
      amount?: number;
      payrollMonth?: string;
      reason?: string;
    };

    if (!userId || !type || !subType || !amount || !payrollMonth || !reason) {
      res.status(400).json({ success: false, error: 'userId, type, subType, amount, payrollMonth, and reason are required' });
      return;
    }

    if (!/^\d{4}-\d{2}$/.test(payrollMonth)) {
      res.status(400).json({ success: false, error: 'Invalid payrollMonth format (expected YYYY-MM)' });
      return;
    }

    const adj = await SalaryAdjustment.create({
      userId,
      type,
      subType,
      amount,
      payrollMonth,
      reason,
      date: new Date(),
      createdBy: req.userId,
      status: 'approved'
    });

    res.status(201).json({ success: true, data: adj });
  } catch (err) {
    console.error('Add adjustment error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/payroll/adjustments - Fetch list of adjustments for a specific month
router.get('/adjustments', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { month } = req.query as { month?: string };
    if (!month) {
      res.status(400).json({ success: false, error: 'month query parameter is required (YYYY-MM)' });
      return;
    }

    const list = await SalaryAdjustment.find({ payrollMonth: month })
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: list });
  } catch (err) {
    console.error('List adjustments error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
