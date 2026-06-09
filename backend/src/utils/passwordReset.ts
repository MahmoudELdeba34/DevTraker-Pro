import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import PasswordResetToken from '../models/PasswordResetToken';
import User from '../models/User';
import { getFrontendUrl } from './accountSetup';

const RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes

export function buildResetLink(plainToken: string, email: string): string {
  return `${getFrontendUrl()}/reset-password?token=${encodeURIComponent(plainToken)}&email=${encodeURIComponent(email)}`;
}

/** Issue a one-time password reset link (invalidates previous unused links). */
export async function issuePasswordReset(email: string): Promise<{
  resetLink: string;
  expiresAt: Date;
} | null> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return null;

  const plainToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = await bcrypt.hash(plainToken, 10);
  const expiresAt = new Date(Date.now() + RESET_TTL_MS);
  const uid = user._id as Types.ObjectId;

  await PasswordResetToken.updateMany(
    { userId: uid, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  await PasswordResetToken.create({ userId: uid, tokenHash, expiresAt });

  return {
    resetLink: buildResetLink(plainToken, user.email),
    expiresAt,
  };
}

export async function verifyPasswordResetToken(
  email: string,
  plainToken: string
): Promise<{ userId: string; email: string } | null> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return null;

  const records = await PasswordResetToken.find({
    userId: user._id,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  for (const rec of records) {
    if (await bcrypt.compare(plainToken, rec.tokenHash)) {
      return { userId: user._id.toString(), email: user.email };
    }
  }
  return null;
}

export async function consumePasswordResetToken(
  userId: string,
  plainToken: string
): Promise<boolean> {
  const records = await PasswordResetToken.find({
    userId,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });

  for (const rec of records) {
    if (await bcrypt.compare(plainToken, rec.tokenHash)) {
      rec.usedAt = new Date();
      await rec.save();
      return true;
    }
  }
  return false;
}
