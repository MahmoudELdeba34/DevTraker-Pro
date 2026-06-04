// backend/src/models/Timelog.ts
import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ITimelog extends Document {
  taskId: Types.ObjectId;
  userId: Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in seconds, calculated when stopped
}

const TimelogSchema = new Schema<ITimelog>(
  {
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startTime: { type: Date, default: Date.now, required: true },
    endTime: { type: Date },
    duration: { type: Number },
  },
  { timestamps: true }
);

// Pre-save hook to compute duration if endTime is set
TimelogSchema.pre('save', function (next) {
  if (this.endTime && !this.duration) {
    this.duration = Math.floor((this.endTime.getTime() - this.startTime.getTime()) / 1000);
  }
  next();
});

export default mongoose.model<ITimelog>('Timelog', TimelogSchema);
