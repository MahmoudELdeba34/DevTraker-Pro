import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  passwordHash: string;
  role: 'employee' | 'manager' | 'admin' | 'hr' | 'accountant';
  avatarUrl?: string;
  currentPage?: string;
  lastActiveAt?: Date;
  sessionStart?: Date;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['employee', 'manager', 'admin', 'hr', 'accountant'],
      default: 'employee',
    },
    avatarUrl: { type: String, default: null },
    currentPage: { type: String, default: '' },
    lastActiveAt: { type: Date, default: null },
    sessionStart: { type: Date, default: null },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export default mongoose.model<IUser>('User', UserSchema);
