import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { detectImageType } from './avatar';

export const ATTENDANCE_PHOTOS_DIR = path.join(__dirname, '..', '..', 'uploads', 'attendance');
export const ATTENDANCE_PHOTO_PREFIX = '/api/uploads/attendance/';

export function ensureAttendancePhotosDir(): void {
  if (!fs.existsSync(ATTENDANCE_PHOTOS_DIR)) {
    fs.mkdirSync(ATTENDANCE_PHOTOS_DIR, { recursive: true });
  }
}

export function buildAttendancePhotoUrl(filename: string): string {
  return `${ATTENDANCE_PHOTO_PREFIX}${path.basename(filename)}`;
}

export function validateAttendancePhotoFile(filePath: string): boolean {
  return detectImageType(filePath) !== null;
}

export function deleteAttendancePhotoFile(url: string | undefined | null): void {
  if (!url?.startsWith(ATTENDANCE_PHOTO_PREFIX)) return;
  const filePath = path.join(ATTENDANCE_PHOTOS_DIR, path.basename(url));
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

export function safePhotoFilename(): string {
  return `${crypto.randomUUID()}.jpg`;
}
