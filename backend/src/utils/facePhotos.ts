import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { detectImageType } from './avatar';

export const FACE_PHOTOS_DIR = path.join(__dirname, '..', '..', 'uploads', 'faces');
export const FACE_PHOTO_PREFIX = '/api/uploads/faces/';

export function ensureFacePhotosDir(): void {
  if (!fs.existsSync(FACE_PHOTOS_DIR)) {
    fs.mkdirSync(FACE_PHOTOS_DIR, { recursive: true });
  }
}

export function buildFacePhotoUrl(filename: string): string {
  return `${FACE_PHOTO_PREFIX}${path.basename(filename)}`;
}

export function validateFacePhotoFile(filePath: string): boolean {
  return detectImageType(filePath) !== null;
}

export function deleteFacePhotoFile(url: string | undefined | null): void {
  if (!url?.startsWith(FACE_PHOTO_PREFIX)) return;
  const filePath = path.join(FACE_PHOTOS_DIR, path.basename(url));
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

export function safeFaceFilename(): string {
  return `${crypto.randomUUID()}.jpg`;
}
