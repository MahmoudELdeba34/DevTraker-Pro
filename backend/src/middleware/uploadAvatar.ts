import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import {
  AVATARS_DIR,
  ensureAvatarsDir,
  sanitizeAvatarExtension,
} from '../utils/avatar';

ensureAvatarsDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureAvatarsDir();
    cb(null, AVATARS_DIR);
  },
  filename: (req: Request, file, cb) => {
    const userId = (req as AuthRequest).userId || 'unknown';
    const ext = sanitizeAvatarExtension(file.originalname);
    cb(null, `${userId}-${Date.now()}${ext}`);
  },
});

const avatarUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are allowed'));
  },
}).single('avatar');

export function uploadAvatarMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  avatarUpload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image must be 2 MB or smaller'
          : err.message;
      res.status(400).json({ success: false, error: message });
      return;
    }
    if (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      res.status(400).json({ success: false, error: message });
      return;
    }
    next();
  });
}
