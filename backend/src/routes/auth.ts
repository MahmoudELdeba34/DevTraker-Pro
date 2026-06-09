import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import User from '../models/User';
import EmployeeProfile from '../models/EmployeeProfile';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { uploadAvatarMiddleware } from '../middleware/uploadAvatar';
import fs from 'fs';
import path from 'path';
import {
  AVATARS_DIR,
  buildLocalAvatarUrl,
  deleteLocalAvatarFile,
  detectImageType,
  isValidExternalAvatarUrl,
  safeAvatarFilename,
} from '../utils/avatar';
import { uploadFacePhotoMiddleware } from '../middleware/uploadFacePhoto';
import {
  buildFacePhotoUrl,
  deleteFacePhotoFile,
  validateFacePhotoFile,
} from '../utils/facePhotos';
import { parseFaceDescriptor } from '../utils/faceMatch';
import {
  issuePasswordReset,
  verifyPasswordResetToken,
  consumePasswordResetToken,
} from '../utils/passwordReset';
import { sendEmail, generatePassword, isSmtpConfigured } from '../utils/email';
import {
  issueAccountSetup,
  verifyAccountSetupToken,
  consumeAccountSetupToken,
} from '../utils/accountSetup';
import { createNotification } from '../utils/notify';
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from '../utils/tokens';

const router = Router();
const SALT_ROUNDS = 10;

/* ─── Rate limiters ──────────────────────────────────────────────────────────
 * - login/register/refresh: brute-force protection
 * - admin-create-user: lighter
 */
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,                           // 5 attempts per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts. Try again later.' },
});
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many reset requests. Try again later.' },
});
const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many reset attempts. Try again later.' },
});
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 6,                           // 6 registrations per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many sign-up attempts. Try again later.' },
});
const refreshLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,                          // 60 refreshes per 5min per IP (covers many tabs)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many refresh requests.' },
});
const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many setup attempts. Try again later.' },
});

// Helper: serialize a user for the client (never expose passwordHash)
function safeUser(u: any) {
  return {
    _id: u._id,
    name: u.name,
    email: u.email,
    role: u.role,
    avatarUrl: u.avatarUrl || undefined,
    faceEnrolled: Array.isArray(u.faceDescriptor) && u.faceDescriptor.length > 0,
    facePhotoUrl: u.facePhotoUrl || undefined,
  };
}

async function replaceUserAvatar(
  user: InstanceType<typeof User>,
  nextAvatarUrl: string | undefined
): Promise<void> {
  const previous = user.avatarUrl;
  if (previous && previous !== nextAvatarUrl) {
    deleteLocalAvatarFile(previous);
  }
  user.avatarUrl = nextAvatarUrl;
  await user.save();
}

// POST /api/auth/register
router.post('/register', registerLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
    };

    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: 'name, email, and password are required' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already in use' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const isFirstUser = (await User.countDocuments({})) === 0;
    const assignedRole = isFirstUser ? 'admin' : 'employee';
    void role;

    const user = await User.create({ name, email, passwordHash, role: assignedRole });

    const { accessToken, refreshToken } = await issueTokenPair(user, req);

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        // Back-compat alias for older clients still reading `token`
        token: accessToken,
        user: safeUser(user),
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ success: false, error: 'email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ success: false, error: 'Invalid email or password' });
      return;
    }

    const profile = await EmployeeProfile.findOne({ userId: user._id }, 'status');
    if (profile?.status === 'suspended') {
      res.status(403).json({ success: false, error: 'Your account has been suspended. Contact HR.' });
      return;
    }
    if (profile?.status === 'resigned') {
      res.status(403).json({ success: false, error: 'This account is no longer active.' });
      return;
    }

    user.lastActiveAt = new Date();
    user.sessionStart = new Date();
    await user.save();

    const { accessToken, refreshToken } = await issueTokenPair(user, req);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        token: accessToken,                // back-compat alias
        user: safeUser(user),
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/refresh — exchange a valid refresh token for a new pair
router.post('/refresh', refreshLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ success: false, error: 'refreshToken is required' });
      return;
    }

    const rotated = await rotateRefreshToken(refreshToken, req);
    if (!rotated) {
      res.status(401).json({ success: false, error: 'Invalid or expired refresh token' });
      return;
    }

    const userDoc = await User.findById(rotated.user._id);

    res.json({
      success: true,
      data: {
        accessToken: rotated.accessToken,
        refreshToken: rotated.refreshToken,
        token: rotated.accessToken,           // back-compat
        user: userDoc ? safeUser(userDoc) : rotated.user,
      },
    });
  } catch (err) {
    console.error('Refresh error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/logout — revoke the refresh token (single device)
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) await revokeRefreshToken(refreshToken);
    res.json({ success: true, data: { message: 'Logged out' } });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/logout-all — revoke ALL refresh tokens for current user
router.post('/logout-all', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }
    await revokeAllUserTokens(req.userId);
    res.json({ success: true, data: { message: 'Logged out from all devices' } });
  } catch (err) {
    console.error('Logout-all error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/auth/me — return the currently authenticated user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, data: { user: safeUser(user) } });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/auth/me — update profile (name)
router.put('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name } = req.body as { name?: string };
    if (!name || !name.trim()) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    user.name = name.trim();
    await user.save();

    res.json({ success: true, data: { user: safeUser(user) } });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

// POST /api/auth/me/avatar — upload a profile image
router.post(
  '/me/avatar',
  authMiddleware,
  uploadAvatarMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'No image file provided' });
        return;
      }

      const detected = detectImageType(req.file.path);
      if (!detected) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ success: false, error: 'Invalid image file' });
        return;
      }

      let filename = req.file.filename;
      if (!filename.endsWith(detected.ext)) {
        const nextName = safeAvatarFilename(detected.ext);
        fs.renameSync(req.file.path, path.join(AVATARS_DIR, nextName));
        filename = nextName;
      }

      const user = await User.findById(req.userId);
      if (!user) {
        fs.unlinkSync(path.join(AVATARS_DIR, filename));
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const avatarUrl = buildLocalAvatarUrl(filename);
      await replaceUserAvatar(user, avatarUrl);

      res.json({ success: true, data: { user: safeUser(user) } });
    } catch (err) {
      console.error('Upload avatar error:', err);
      res.status(500).json({ success: false, error: 'Failed to upload avatar' });
    }
  }
);

// PUT /api/auth/me/avatar — set profile image from an external URL
router.put('/me/avatar', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { avatarUrl } = req.body as { avatarUrl?: string };
    const trimmed = avatarUrl?.trim();

    if (!trimmed || !isValidExternalAvatarUrl(trimmed)) {
      res.status(400).json({ success: false, error: 'A valid http(s) image URL is required' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    await replaceUserAvatar(user, trimmed);

    res.json({ success: true, data: { user: safeUser(user) } });
  } catch (err) {
    console.error('Set avatar URL error:', err);
    res.status(500).json({ success: false, error: 'Failed to update avatar' });
  }
});

// DELETE /api/auth/me/avatar — remove profile image
router.delete('/me/avatar', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.avatarUrl) {
      deleteLocalAvatarFile(user.avatarUrl);
      user.avatarUrl = undefined;
      await user.save();
    }

    res.json({ success: true, data: { user: safeUser(user) } });
  } catch (err) {
    console.error('Remove avatar error:', err);
    res.status(500).json({ success: false, error: 'Failed to remove avatar' });
  }
});

// GET /api/auth/me/face — face enrollment status
router.get('/me/face', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select('facePhotoUrl faceDescriptor faceEnrolledAt');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    const enrolled = Array.isArray(user.faceDescriptor) && user.faceDescriptor.length > 0;
    res.json({
      success: true,
      data: {
        enrolled,
        facePhotoUrl: user.facePhotoUrl || null,
        enrolledAt: user.faceEnrolledAt || null,
      },
    });
  } catch (err) {
    console.error('Face status error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/me/face — enroll / update reference face
router.post(
  '/me/face',
  authMiddleware,
  uploadFacePhotoMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      if (!req.file?.path) {
        res.status(400).json({ success: false, error: 'Face photo is required' });
        return;
      }

      if (!validateFacePhotoFile(req.file.path)) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ success: false, error: 'Invalid image file' });
        return;
      }

      const descriptor = parseFaceDescriptor(req.body?.faceDescriptor);
      if (!descriptor) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({
          success: false,
          error: 'Face could not be processed. Ensure your face is clearly visible.',
        });
        return;
      }

      const user = await User.findById(req.userId);
      if (!user) {
        fs.unlinkSync(req.file.path);
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const photoUrl = buildFacePhotoUrl(req.file.filename);
      if (user.facePhotoUrl) {
        deleteFacePhotoFile(user.facePhotoUrl);
      }

      user.facePhotoUrl = photoUrl;
      user.faceDescriptor = descriptor;
      user.faceEnrolledAt = new Date();
      await user.save();

      res.json({
        success: true,
        data: {
          enrolled: true,
          facePhotoUrl: user.facePhotoUrl,
          enrolledAt: user.faceEnrolledAt,
        },
      });
    } catch (err) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      console.error('Face enroll error:', err);
      res.status(500).json({ success: false, error: 'Failed to enroll face' });
    }
  }
);

// DELETE /api/auth/me/face — remove enrolled face (self or admin/hr later)
router.delete('/me/face', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    if (user.facePhotoUrl) {
      deleteFacePhotoFile(user.facePhotoUrl);
    }
    user.facePhotoUrl = undefined;
    user.faceDescriptor = undefined;
    user.faceEnrolledAt = undefined;
    await user.save();

    res.json({ success: true, data: { enrolled: false } });
  } catch (err) {
    console.error('Face remove error:', err);
    res.status(500).json({ success: false, error: 'Failed to remove face profile' });
  }
});

// POST /api/auth/forgot-password — request a password reset link
router.post('/forgot-password', forgotPasswordLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };
    if (!email?.trim()) {
      res.status(400).json({ success: false, error: 'email is required' });
      return;
    }

    const issued = await issuePasswordReset(email);
    if (issued && isSmtpConfigured()) {
      try {
        await sendEmail(
          email.toLowerCase().trim(),
          'DevTracker Pro — Reset your password',
          `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#0d0d0f;color:#f0f0f5;border-radius:16px;">
            <h1 style="color:#818cf8;margin-bottom:8px;">Password reset</h1>
            <p>Click the button below to set a new password. This link expires in 15 minutes and works once.</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${issued.resetLink}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;">Reset password</a>
            </div>
            <p style="color:#8b8b9e;font-size:13px;">If you did not request this, ignore this email.</p>
          </div>
          `
        );
      } catch (e: unknown) {
        console.error('Password reset email failed:', e instanceof Error ? e.message : e);
      }
    }

    // Always respond success — do not reveal whether the email exists
    res.json({
      success: true,
      data: {
        message: 'If an account exists for this email, a reset link has been sent.',
        ...(issued && !isSmtpConfigured() ? { resetLink: issued.resetLink } : {}),
      },
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/auth/reset-password/validate?token=&email=
router.get('/reset-password/validate', resetPasswordLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.query['token'] || '');
    const email = String(req.query['email'] || '');
    if (!token || !email) {
      res.status(400).json({ success: false, error: 'token and email are required' });
      return;
    }
    const verified = await verifyPasswordResetToken(email, token);
    if (!verified) {
      res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
      return;
    }
    res.json({ success: true, data: { email: verified.email } });
  } catch (err) {
    console.error('Reset validate error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/reset-password — set new password via one-time link
router.post('/reset-password', resetPasswordLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, email, password } = req.body as {
      token?: string;
      email?: string;
      password?: string;
    };

    if (!token || !email || !password) {
      res.status(400).json({ success: false, error: 'token, email, and password are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      return;
    }

    const verified = await verifyPasswordResetToken(email, token);
    if (!verified) {
      res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
      return;
    }

    const consumed = await consumePasswordResetToken(verified.userId, token);
    if (!consumed) {
      res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
      return;
    }

    const user = await User.findById(verified.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await user.save();
    await revokeAllUserTokens(verified.userId);

    res.json({
      success: true,
      data: { message: 'Password updated. Please sign in with your new password.' },
    });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/auth/change-password
router.put('/change-password', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Current and new password are required' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
      return;
    }

    const user = await User.findById(req.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      res.status(401).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save();
    await revokeAllUserTokens(req.userId!);

    res.json({ success: true, data: { message: 'Password updated. Please sign in again.' } });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ success: false, error: 'Failed to change password' });
  }
});

// ─── Account setup (no SMTP required) ───────────────────────────────────────

// GET /api/auth/setup-account/validate?token=&email=
router.get('/setup-account/validate', setupLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const token = String(req.query['token'] || '');
    const email = String(req.query['email'] || '');
    if (!token || !email) {
      res.status(400).json({ success: false, error: 'token and email are required' });
      return;
    }
    const verified = await verifyAccountSetupToken(email, token);
    if (!verified) {
      res.status(400).json({ success: false, error: 'This setup link is invalid or has expired.' });
      return;
    }
    res.json({ success: true, data: { email: verified.email, name: verified.name } });
  } catch (err) {
    console.error('Setup validate error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// POST /api/auth/setup-account — set password via one-time link
router.post('/setup-account', setupLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, email, password } = req.body as {
      token?: string;
      email?: string;
      password?: string;
    };

    if (!token || !email || !password) {
      res.status(400).json({ success: false, error: 'token, email, and password are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
      return;
    }

    const verified = await verifyAccountSetupToken(email, token);
    if (!verified) {
      res.status(400).json({ success: false, error: 'This setup link is invalid or has expired.' });
      return;
    }

    const consumed = await consumeAccountSetupToken(verified.userId, token);
    if (!consumed) {
      res.status(400).json({ success: false, error: 'This setup link is invalid or has expired.' });
      return;
    }

    const user = await User.findById(verified.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    user.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    await user.save();

    const { accessToken, refreshToken } = await issueTokenPair(user, req);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        token: accessToken,
        user: safeUser(user),
        message: 'Account ready. Welcome!',
      },
    });
  } catch (err) {
    console.error('Setup account error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ─── Admin-only routes ─────────────────────────────────────────────────────────

// POST /api/auth/admin/create-user — Admin creates a user and sends password via email
router.post('/admin/create-user', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (req.userRole !== 'admin' && req.userRole !== 'hr') {
      res.status(403).json({ success: false, error: 'Admin or HR access required' });
      return;
    }

    const { name, email, role } = req.body as { name?: string; email?: string; role?: string };

    if (!email || !email.includes('@')) {
      res.status(400).json({ success: false, error: 'A valid email is required' });
      return;
    }

    const lower = email.toLowerCase().trim();
    const existing = await User.findOne({ email: lower });
    if (existing) {
      res.status(400).json({ success: false, error: 'Email already in use' });
      return;
    }

    const employeeRoles = ['employee', 'manager'];
    const adminRoles = ['admin', 'hr', 'accountant'];
    const validRoles = [...employeeRoles, ...adminRoles];
    let assignedRole = role && validRoles.includes(role) ? role : 'employee';
    if (req.userRole === 'hr' && adminRoles.includes(assignedRole)) {
      res.status(403).json({ success: false, error: 'HR cannot create admin, HR, or accountant accounts' });
      return;
    }
    const displayName = (name || lower.split('@')[0] || 'User').trim();

    const tempPassword = generatePassword(12);
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    const user = await User.create({
      name: displayName,
      email: lower,
      passwordHash,
      role: assignedRole,
    });

    const setup = await issueAccountSetup(user._id.toString(), lower, tempPassword);

    let emailSent = false;
    if (isSmtpConfigured()) {
      try {
        await sendEmail(
          lower,
          'Welcome to DevTracker Pro — Your Account is Ready',
          `
          <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:30px;background:#0f172a;color:#e2e8f0;border-radius:16px;">
            <h1 style="color:#a78bfa;margin-bottom:8px;">Welcome to DevTracker Pro!</h1>
            <p>Hello <strong>${displayName}</strong>,</p>
            <p>Your account has been created. Set your password using the button below:</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${setup.setupLink}" style="display:inline-block;background:#6366f1;color:white;padding:12px 24px;border-radius:10px;text-decoration:none;font-weight:bold;">Set your password</a>
            </div>
            <p style="color:#94a3b8;font-size:13px;">Temporary password: <code>${tempPassword}</code></p>
          </div>
          `
        );
        emailSent = true;
      } catch (e: any) {
        console.error('Welcome email failed:', e?.message);
      }
    }

    createNotification({
      userId: user._id.toString(),
      type: 'account_created',
      title: 'Welcome to DevTracker Pro!',
      message: `Your account has been created with the role "${assignedRole}".`,
      link: '/employee-home',
    }).catch(() => {});

    res.status(201).json({
      success: true,
      data: {
        user: safeUser(user),
        emailSent,
        setupLink: setup.setupLink,
        shareMessage: setup.shareMessage,
        message: emailSent
          ? 'User created and setup link emailed.'
          : 'User created. Copy the setup link below and send it to the employee.',
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

    // When admin resets a password, kick the user out of all sessions
    await revokeAllUserTokens(userId);

    sendEmail(
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
    ).catch((e) => console.error('Reset email failed:', e?.message));

    createNotification({
      userId: user._id.toString(),
      type: 'password_reset',
      title: 'Password Reset',
      message: 'Your password has been reset by an administrator. Check your email for the new password.',
    }).catch(() => {});

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
