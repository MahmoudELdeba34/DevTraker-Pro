import { Router, Response } from 'express';
import Task from '../models/Task';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/reports/summary - Aggregate daily timesheet with overtime > 7 hours
router.get('/summary', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = (req.query['userId'] as string) || req.userId!;
    
    // Authorization check
    if (targetUserId !== req.userId && req.userRole !== 'admin' && req.userRole !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied. You cannot view another user\'s reports.' });
      return;
    }

    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    // Parse dates if provided
    const startLimit = startDate ? new Date(startDate) : null;
    const endLimit = endDate ? new Date(endDate) : null;
    if (endLimit) {
      endLimit.setHours(23, 59, 59, 999); // Include full end day
    }

    // Retrieve user details
    const user = await User.findById(targetUserId, 'name email role');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    // Query tasks containing logs for the target user
    const tasks = await Task.find({
      'timeLogs.userId': targetUserId
    }).populate('projectId', 'title');

    // Group logs by YYYY-MM-DD
    const dailyLogs: Record<string, {
      totalDurationMs: number;
      tasks: Record<string, { taskId: string; title: string; projectTitle: string; durationMs: number }>;
    }> = {};

    tasks.forEach(task => {
      task.timeLogs.forEach(log => {
        // Only process logs belonging to target user
        if (log.userId.toString() !== targetUserId) return;
        
        const logStart = new Date(log.start);
        
        // Filter by date range if specified
        if (startLimit && logStart < startLimit) return;
        if (endLimit && logStart > endLimit) return;
        
        // Use local date string format: YYYY-MM-DD
        const yyyy = logStart.getFullYear();
        const mm = String(logStart.getMonth() + 1).padStart(2, '0');
        const dd = String(logStart.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        
        if (!dailyLogs[dateStr]) {
          dailyLogs[dateStr] = {
            totalDurationMs: 0,
            tasks: {}
          };
        }
        
        dailyLogs[dateStr].totalDurationMs += log.duration;
        
        const taskIdStr = task._id.toString();
        const projectTitle = (task.projectId as any)?.title || 'Unknown Project';
        
        if (!dailyLogs[dateStr].tasks[taskIdStr]) {
          dailyLogs[dateStr].tasks[taskIdStr] = {
            taskId: taskIdStr,
            title: task.title,
            projectTitle,
            durationMs: 0
          };
        }
        dailyLogs[dateStr].tasks[taskIdStr].durationMs += log.duration;
      });
    });

    // Generate timesheet entries with overtime calculations
    const OVERTIME_THRESHOLD_HOURS = 7;
    const MS_PER_HOUR = 3600 * 1000;
    const thresholdMs = OVERTIME_THRESHOLD_HOURS * MS_PER_HOUR;

    let totalDurationMs = 0;
    let totalRegularMs = 0;
    let totalOvertimeMs = 0;

    const days = Object.keys(dailyLogs).sort().map(date => {
      const dayData = dailyLogs[date];
      const dayTotalMs = dayData.totalDurationMs;
      
      let regularMs = dayTotalMs;
      let overtimeMs = 0;
      
      if (dayTotalMs > thresholdMs) {
        regularMs = thresholdMs;
        overtimeMs = dayTotalMs - thresholdMs;
      }

      totalDurationMs += dayTotalMs;
      totalRegularMs += regularMs;
      totalOvertimeMs += overtimeMs;

      return {
        date,
        totalHours: Number((dayTotalMs / MS_PER_HOUR).toFixed(2)),
        regularHours: Number((regularMs / MS_PER_HOUR).toFixed(2)),
        overtimeHours: Number((overtimeMs / MS_PER_HOUR).toFixed(2)),
        tasks: Object.values(dayData.tasks).map(t => ({
          ...t,
          hours: Number((t.durationMs / MS_PER_HOUR).toFixed(2))
        }))
      };
    });

    res.json({
      success: true,
      data: {
        user,
        summary: {
          totalHours: Number((totalDurationMs / MS_PER_HOUR).toFixed(2)),
          totalRegularHours: Number((totalRegularMs / MS_PER_HOUR).toFixed(2)),
          totalOvertimeHours: Number((totalOvertimeMs / MS_PER_HOUR).toFixed(2)),
          daysWorkedCount: days.length
        },
        days
      }
    });
  } catch (err) {
    console.error('Reports error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
