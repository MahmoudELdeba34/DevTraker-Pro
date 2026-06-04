import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User';

const router = Router();
const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body as {
      name?: string;
      email?: string;
      password?: string;
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
    const user = await User.create({ name, email, passwordHash });

    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ userId: user._id.toString() }, secret, {
      expiresIn: TOKEN_EXPIRY,
    });

    res.status(201).json({
      success: true,
      data: {
        token,
        user: { _id: user._id, name: user.name, email: user.email },
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

    const secret = process.env.JWT_SECRET!;
    const token = jwt.sign({ userId: user._id.toString() }, secret, {
      expiresIn: TOKEN_EXPIRY,
    });

    res.json({
      success: true,
      data: {
        token,
        user: { _id: user._id, name: user.name, email: user.email },
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
