import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  family: string;            // groups rotated tokens (for theft detection)
  userAgent?: string;
  ip?: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  replacedBy?: string | null;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash:  { type: String, required: true, index: true },
    family:     { type: String, required: true, index: true },
    userAgent:  { type: String, default: '' },
    ip:         { type: String, default: '' },
    expiresAt:  { type: Date, required: true, index: true },
    revokedAt:  { type: Date, default: null },
    replacedBy: { type: String, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// TTL — Mongo will auto-delete expired tokens
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
