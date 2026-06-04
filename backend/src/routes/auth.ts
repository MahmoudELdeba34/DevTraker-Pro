import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendEmail, generatePassword } from '../utils/email';
import { createNotification } from '../utils/notify';

const router = Router();
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        error: 'name, email, and password are required',
      });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters',
      });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    
    // First user registered becomes admin, otherwise use provided role or default to employee
    const isFirstUser = (await User.countDocuments({})) === 0;
    const validRoles = ['employee', 'manager', 'admin', 'hr', 'accountant'];
    const assignedRole = isFirstUser ? 'admin' : (role && validRoles.includes(role) ? role : 'employee');
    
    const user = await User.create({ name, email, passwordHash, role: assignedRole });

    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ userId: user._id.toString(), role: user.role }, secret, {
      expiresIn: TOKEN_EXPIRY,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      res.status(400).json({
        success: false,
        error: 'email and password are required',
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res
        .status(401)
        .json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res
        .status(401)
        .json({ success: false, error: 'Invalid email or password' });
      return;
    }

    // Set initial session start and last active on login
    user.lastActiveAt = new Date();
    user.sessionStart = new Date();
    await user.save();

    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ userId: user._id.toString(), role: user.role }, secret, {
      expiresIn: TOKEN_EXPIRY,
    });

    res.json({
      success: true,
      data: {
        token,
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Admin-only routes ─────────────────────────────────────────────────────────

// POST /api/auth/admin/create-user — Admin creates a user and sends password via email
router.post('/admin/create-user', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    const { name, email, role } = req.body as {
      name?: string;
      email?: string;
      role?: string;
    };

    if (!name || !email) {
      res.status(400).json({ success: false, error: 'name and email are required' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already in use' });
      return;
    }

    const validRoles = ['employee', 'manager', 'admin', 'hr', 'accountant'];
    const assignedRole = role && validRoles.includes(role) ? role : 'employee';

    const tempPassword = generatePassword(12);
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: assignedRole,
    });

    // Send welcome email with temporary password
    await sendEmail(
      email,
      'Welcome to DevTracker Pro — Your Account is Ready',
      `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
        <h1 style="color:#a78bfa;margin-bottom:8px;">Welcome to DevTracker Pro!</h1>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your account has been created by the system administrator. Here are your login credentials:</p>
        <div style="background:#1e293b;padding:20px;border-radius:12px;margin:20px 0;border:1px solid #334155;">
          <p style="margin:4px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin:4px 0;"><strong>Temporary Password:</strong> <code style="background:#334155;padding:4px 8px;border-radius:4px;color:#f472b6;">${tempPassword}</code></p>
          <p style="margin:4px 0;"><strong>Role:</strong> ${assignedRole}</p>
        </div>
        <p style="color:#94a3b8;font-size:13px;">Please change your password after your first login.</p>
      </div>
      `
    );

    // Notify the new user
    await createNotification({
      userId: user._id.toString(),
      type: 'account_created',
      title: 'Welcome to DevTracker Pro!',
      message: `Your account has been created with the role "${assignedRole}". Please check your email for login credentials.`,
      link: '/employee-home',
    });

    res.status(201).json({
      success: true,
      data: {
        user: { _id: user._id, name: user.name, email: user.email, role: user.role },
        message: 'User created and email sent successfully.',
      },
    });
  } catch (err) {
    console.error('Admin create-user error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/admin/reset-password — Admin resets a user's password
router.post('/admin/reset-password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.userRole !== 'admin') {
      res.status(403).json({ success: false, error: 'Admin access required' });
      return;
    }

    const { userId } = req.body as { userId?: string };

    if (!userId) {
      res.status(400).json({ success: false, error: 'userId is required' });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const newPassword = generatePassword(12);
    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();

    // Send password reset email
    await sendEmail(
      user.email,
      'DevTracker Pro — Your Password Has Been Reset',
      `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
        <h1 style="color:#f472b6;margin-bottom:8px;">Password Reset</h1>
        <p>Hello <strong>${user.name}</strong>,</p>
        <p>Your password has been reset by the system administrator. Here is your new temporary password:</p>
        <div style="background:#1e293b;padding:20px;border-radius:12px;margin:20px 0;border:1px solid #334155;">
          <p style="margin:4px 0;"><strong>New Password:</strong> <code style="background:#334155;padding:4px 8px;border-radius:4px;color:#f472b6;">${newPassword}</code></p>
        </div>
        <p style="color:#94a3b8;font-size:13px;">Please change your password after your next login.</p>
      </div>
      `
    );

    // Notify the user
    await createNotification({
      userId: user._id.toString(),
      type: 'password_reset',
      title: 'Password Reset',
      message: 'Your password has been reset by an administrator. Check your email for the new password.',
    });

    res.json({
      success: true,
      data: { message: `Password reset email sent to ${user.email}` },
    });
  } catch (err) {
    console.error('Admin reset-password error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
