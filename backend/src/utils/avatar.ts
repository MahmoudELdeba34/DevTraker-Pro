import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads');
export const AVATARS_DIR = path.join(UPLOADS_DIR, 'avatars');
export const AVATAR_URL_PREFIX = '/api/uploads/avatars/';

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

export function ensureAvatarsDir(): void {
  if (!fs.existsSync(AVATARS_DIR)) {
    fs.mkdirSync(AVATARS_DIR, { recursive: true });
  }
}

export function isValidExternalAvatarUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isLocalAvatarUrl(url: string): boolean {
  return url.startsWith(AVATAR_URL_PREFIX);
}

export function deleteLocalAvatarFile(avatarUrl: string | undefined | null): void {
  if (!avatarUrl || !isLocalAvatarUrl(avatarUrl)) return;
  const filename = path.basename(avatarUrl);
  const filePath = path.join(AVATARS_DIR, filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}

export function buildLocalAvatarUrl(filename: string): string {
  return `${AVATAR_URL_PREFIX}${filename}`;
}

export function sanitizeAvatarExtension(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
}

const MAGIC: Array<{ mime: string; ext: string; bytes: number[] }> = [
  { mime: 'image/jpeg', ext: '.jpg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', ext: '.png', bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: 'image/gif', ext: '.gif', bytes: [0x47, 0x49, 0x46] },
  { mime: 'image/webp', ext: '.webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

/** Verify file content matches a real image type (not just extension/MIME header). */
export function detectImageType(filePath: string): { mime: string; ext: string } | null {
  let buf: Buffer;
  try {
    buf = fs.readFileSync(filePath);
  } catch {
    return null;
  }
  if (buf.length < 12) return null;

  for (const sig of MAGIC) {
    if (sig.bytes.every((b, i) => buf[i] === b)) {
      if (sig.mime === 'image/webp') {
        const webp = buf.subarray(8, 12).toString('ascii');
        if (webp !== 'WEBP') return null;
      }
      return { mime: sig.mime, ext: sig.ext };
    }
  }
  return null;
}

export function safeAvatarFilename(ext: string): string {
  const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
  return `${crypto.randomUUID()}${safeExt}`;
}
