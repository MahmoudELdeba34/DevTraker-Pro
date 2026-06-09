import crypto from 'crypto';
import multer from 'multer';
import { Request, Response, NextFunction } from 'express';
import { FACE_PHOTOS_DIR, ensureFacePhotosDir } from '../utils/facePhotos';

ensureFacePhotosDir();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureFacePhotosDir();
    cb(null, FACE_PHOTOS_DIR);
  },
  filename: (_req, _file, cb) => {
    cb(null, `${crypto.randomUUID()}.jpg`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Photo must be JPEG, PNG, or WebP'));
  },
}).single('photo');

export function uploadFacePhotoMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  upload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE' ? 'Photo must be 3 MB or smaller' : err.message;
      res.status(400).json({ success: false, error: message });
      return;
    }
    if (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      res.status(400).json({ success: false, error: message });
      return;
    }
    if (!req.file) {
      res.status(400).json({ success: false, error: 'Face photo is required' });
      return;
    }
    next();
  });
}
