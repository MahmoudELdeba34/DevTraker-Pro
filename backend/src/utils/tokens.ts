import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Request } from 'express';
import RefreshToken from '../models/RefreshToken';
import { IUser } from '../models/User';

/**
 * Token Configuration
 * - Access token: short-lived (15 min), JWT
 * - Refresh token: long-lived (30d), opaque random string stored hashed
 */
const ACCESS_TOKEN_TTL  = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface AccessTokenPayload {
  userId: string;
  role: string;
}

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or too short (must be at least 32 chars). Set it in your .env file.'
    );
  }
  return secret;
}

/** Sign a short-lived access token. */
export function signAccessToken(user: Pick<IUser, '_id' | 'role'>): string {
  const payload: AccessTokenPayload = {
    userId: user._id.toString(),
    role: user.role,
  };
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_TTL };
  return jwt.sign(payload, getJwtSecret(), options);
}

/** Generate a cryptographically secure opaque refresh token. */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Issue a new refresh token, persist its hash, return the raw token.
 * `family` groups rotated tokens — if we ever see a revoked token in a family
 * being used again, we can revoke the whole family (theft detection).
 */
export async function issueRefreshToken(
  userId: string,
  req?: Request,
  family?: string
): Promise<string> {
  const raw = generateRefreshToken();
  const tokenHash = hashRefreshToken(raw);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

  await RefreshToken.create({
    userId,
    tokenHash,
    family: family || crypto.randomBytes(12).toString('hex'),
    userAgent: req?.headers['user-agent']?.toString().slice(0, 200) || '',
    ip: (req?.ip || '').slice(0, 64),
    expiresAt,
  });

  return raw;
}

/** Convenience helper: issue both tokens in one call. */
export async function issueTokenPair(
  user: Pick<IUser, '_id' | 'role'>,
  req?: Request
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user._id.toString(), req);
  return { accessToken, refreshToken };
}

/**
 * Rotate a refresh token: validate the incoming one, revoke it, issue a new one.
 * If a revoked-but-not-expired token in the same family is replayed, we revoke
 * the whole family.
 */
export async function rotateRefreshToken(
  rawToken: string,
  req?: Request
): Promise<{
  user: { _id: string; role: string };
  accessToken: string;
  refreshToken: string;
} | null> {
  const tokenHash = hashRefreshToken(rawToken);
  const stored = await RefreshToken.findOne({ tokenHash });
  if (!stored) return null;

  const now = new Date();

  // Already revoked or expired? Possible theft — revoke the whole family.
  if (stored.revokedAt || stored.expiresAt < now) {
    await RefreshToken.updateMany(
      { family: stored.family, revokedAt: null },
      { $set: { revokedAt: now } }
    );
    return null;
  }

  // Load user (need fresh role in case it was changed)
  const User = (await import('../models/User')).default;
  const user = await User.findById(stored.userId);
  if (!user) {
    stored.revokedAt = now;
    await stored.save();
    return null;
  }

  // Rotate: revoke old, issue new in same family
  const newRaw = generateRefreshToken();
  const newHash = hashRefreshToken(newRaw);
  const newDoc = await RefreshToken.create({
    userId: user._id,
    tokenHash: newHash,
    family: stored.family,
    userAgent: req?.headers['user-agent']?.toString().slice(0, 200) || '',
    ip: (req?.ip || '').slice(0, 64),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
  });

  stored.revokedAt = now;
  stored.replacedBy = newDoc._id.toString();
  await stored.save();

  return {
    user: { _id: user._id.toString(), role: user.role },
    accessToken: signAccessToken(user),
    refreshToken: newRaw,
  };
}

/** Revoke a single refresh token (logout from one device). */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(rawToken);
  await RefreshToken.updateOne(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

/** Revoke ALL refresh tokens for a user (logout from all devices). */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}
