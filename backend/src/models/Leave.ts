import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ILeave extends Document {
  userId: Types.ObjectId;
  leaveType: 'annual' | 'sick' | 'unpaid' | 'emergency';
  startDate: Date;
  endDate: Date;
  durationDays: number;
  reason: string;
  attachmentUrl?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  approvedBy?: Types.ObjectId;
  approvedAt?: Date;
  rejectionReason?: string;
}

const LeaveSchema = new Schema<ILeave>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: {
      type: String,
      enum: ['annual', 'sick', 'unpaid', 'emergency'],
      required: true
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    durationDays: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    attachmentUrl: { type: String, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'cancelled'],
      default: 'pending'
    },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true }
  },
  { timestamps: true }
);

export default mongoose.model<ILeave>('Leave', LeaveSchema);
