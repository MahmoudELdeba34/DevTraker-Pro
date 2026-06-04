import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPermission extends Document {
  userId: Types.ObjectId;
  type: 'late_arrival' | 'early_leave' | 'hourly' | 'remote' | 'correction';
  date: Date;
  fromTime: string; // HH:MM
  toTime: string; // HH:MM
  durationMinutes: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: Types.ObjectId;
  deductible: boolean;
}

const PermissionSchema = new Schema<IPermission>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['late_arrival', 'early_leave', 'hourly', 'remote', 'correction'],
      required: true
    },
    date: { type: Date, required: true },
    fromTime: { type: String, required: true }, // e.g. "14:00"
    toTime: { type: String, required: true }, // e.g. "15:30"
    durationMinutes: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deductible: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model<IPermission>('Permission', PermissionSchema);
