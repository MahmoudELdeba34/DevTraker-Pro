import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import AccountSetupToken from '../models/AccountSetupToken';
import User from '../models/User';

const SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function getFrontendUrl(): string {
  return (process.env.FRONTEND_URL || 'http://localhost:4200').replace(/\/$/, '');
}

export function buildSetupLink(plainToken: string, email: string): string {
  return `${getFrontendUrl()}/setup-account?token=${encodeURIComponent(plainToken)}&email=${encodeURIComponent(email)}`;
}

export function buildCredentialsShareMessage(opts: {
  name: string;
  email: string;
  tempPassword: string;
  setupLink: string;
}): string {
  return [
    `Welcome to DevTracker Pro, ${opts.name}!`,
    '',
    `Email: ${opts.email}`,
    `Temporary password: ${opts.tempPassword}`,
    '',
    'Set your own password (recommended):',
    opts.setupLink,
    '',
    `Or sign in at ${getFrontendUrl()}/login`,
  ].join('\n');
}

/** Issue a one-time setup link (invalidates previous unused links for this user). */
export async function issueAccountSetup(
  userId: string,
  email: string,
  tempPassword: string
): Promise<{ setupLink: string; shareMessage: string; expiresAt: Date }> {
  const plainToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = await bcrypt.hash(plainToken, 10);
  const expiresAt = new Date(Date.now() + SETUP_TTL_MS);
  const uid = new Types.ObjectId(userId);

  await AccountSetupToken.updateMany(
    { userId: uid, usedAt: null },
    { $set: { usedAt: new Date() } }
  );

  await AccountSetupToken.create({ userId: uid, tokenHash, expiresAt });

  const user = await User.findById(userId).select('name email');
  const setupLink = buildSetupLink(plainToken, email);
  const shareMessage = buildCredentialsShareMessage({
    name: user?.name || email.split('@')[0] || 'there',
    email,
    tempPassword,
    setupLink,
  });

  return { setupLink, shareMessage, expiresAt };
}

export async function verifyAccountSetupToken(
  email: string,
  plainToken: string
): Promise<{ userId: string; name: string; email: string } | null> {
  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user) return null;

  const records = await AccountSetupToken.find({
    userId: user._id,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  for (const rec of records) {
    if (await bcrypt.compare(plainToken, rec.tokenHash)) {
      return { userId: user._id.toString(), name: user.name, email: user.email };
    }
  }
  return null;
}

export async function consumeAccountSetupToken(
  userId: string,
  plainToken: string
): Promise<boolean> {
  const records = await AccountSetupToken.find({
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
