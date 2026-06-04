import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IOvertime extends Document {
  userId: Types.ObjectId;
  date: Date;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  durationHours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  approvedBy?: Types.ObjectId;
  multiplier: number;
}

const OvertimeSchema = new Schema<IOvertime>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    startTime: { type: String, required: true }, // e.g. "17:00"
    endTime: { type: String, required: true }, // e.g. "19:00"
    durationHours: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    multiplier: { type: Number, default: 1.5 }
  },
  { timestamps: true }
);

export default mongoose.model<IOvertime>('Overtime', OvertimeSchema);
