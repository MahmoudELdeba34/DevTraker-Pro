import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IBreak {
  start: Date;
  end?: Date;
}

export interface IAttendance extends Document {
  userId: Types.ObjectId;
  date: string; // YYYY-MM-DD
  checkIn?: Date;
  checkOut?: Date;
  breaks: IBreak[];
  status: 'Present' | 'Absent' | 'Late' | 'Early Leave' | 'Half Day' | 'Weekend' | 'Holiday' | 'On Leave' | 'Permission' | 'Remote' | 'Missing Check-out';
  workedMinutes: number;
  lateMinutes: number;
  earlyOutMinutes: number;
  adjustedBy?: Types.ObjectId;
  adjustmentReason?: string;
}

const BreakSchema = new Schema<IBreak>(
  {
    start: { type: Date, required: true },
    end: { type: Date, default: null }
  },
  { _id: false }
);

const AttendanceSchema = new Schema<IAttendance>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true }, // Format: YYYY-MM-DD
    checkIn: { type: Date, default: null },
    checkOut: { type: Date, default: null },
    breaks: { type: [BreakSchema], default: [] },
    status: {
      type: String,
      enum: ['Present', 'Absent', 'Late', 'Early Leave', 'Half Day', 'Weekend', 'Holiday', 'On Leave', 'Permission', 'Remote', 'Missing Check-out'],
      default: 'Absent'
    },
    workedMinutes: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    earlyOutMinutes: { type: Number, default: 0 },
    adjustedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    adjustmentReason: { type: String, trim: true }
  },
  { timestamps: true }
);

// Compound index to ensure unique attendance record per user per day
AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default mongoose.model<IAttendance>('Attendance', AttendanceSchema);
