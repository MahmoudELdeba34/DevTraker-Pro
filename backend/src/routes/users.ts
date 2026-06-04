import { Router, Response } from 'express';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/users - List all users (Manager/Admin only)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.userRole !== 'admin' && req.userRole !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const users = await User.find({}, '_id name email role lastActiveAt currentPage sessionStart').sort({ name: 1 });
    res.json({ success: true, data: users });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/users/:id/role - Change user role (Admin only)
router.put('/:id/role', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const { role } = req.body as { role?: string };
    if (!role || !['employee', 'manager', 'admin', 'hr', 'accountant'].includes(role)) {
      res.status(400).json({ success: false, error: 'Invalid or missing role' });
      return;
    }

    const user = await User.findById(req.params['id']);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    user.role = role as 'employee' | 'manager' | 'admin' | 'hr' | 'accountant';
    await user.save();

    res.json({ success: true, data: { _id: user._id, role: user.role } });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/users/heartbeat - Heartbeat check (All users)
router.post('/heartbeat', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPage } = req.body as { currentPage?: string };
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const now = new Date();
    
    // If inactive for > 15 minutes, restart the session
    const FIFTEEN_MINS = 15 * 60 * 1000;
    if (!user.lastActiveAt || now.getTime() - user.lastActiveAt.getTime() > FIFTEEN_MINS) {
      user.sessionStart = now;
    }
    
    user.lastActiveAt = now;
    if (currentPage !== undefined) {
      user.currentPage = currentPage;
    }

    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Heartbeat error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/users/active-sessions - Get active online sessions (Admin only)
router.get('/active-sessions', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const threshold = new Date(Date.now() - 45 * 1000); // Online if active in last 45 seconds
    const activeUsers = await User.find(
      { lastActiveAt: { $gte: threshold } },
      '_id name email role lastActiveAt currentPage sessionStart'
    ).sort({ name: 1 });

    res.json({ success: true, data: activeUsers });
  } catch (err) {
    console.error('Active sessions error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
