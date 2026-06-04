import mongoose, { Document, Schema, Types } from 'mongoose';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'not_started' | 'in_progress' | 'completed';
export type ReminderThreshold = '24h' | '12h' | '1h';

export interface ITimeLog {
  start: Date;
  end: Date;
  duration: number; // ms
}

export interface IReminder {
  threshold: ReminderThreshold;
  sent: boolean;
}

export interface ITask extends Document {
  projectId: Types.ObjectId;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: Date;
  timeLogs: ITimeLog[];
  activeTimerStart?: Date | null;
  reminders: IReminder[];
  createdAt: Date;
}

const TimeLogSchema = new Schema<ITimeLog>(
  {
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    duration: { type: Number, required: true },
  },
  { _id: false }
);

const ReminderSchema = new Schema<IReminder>(
  {
    threshold: {
      type: String,
      enum: ['24h', '12h', '1h'],
      required: true,
    },
    sent: { type: Boolean, default: false },
  },
  { _id: false }
);

const TaskSchema = new Schema<ITask>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    title: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'completed'],
      default: 'not_started',
    },
    deadline: { type: Date },
    timeLogs: { type: [TimeLogSchema], default: [] },
    activeTimerStart: { type: Date, default: null },
    reminders: {
      type: [ReminderSchema],
      default: [
        { threshold: '24h', sent: false },
        { threshold: '12h', sent: false },
        { threshold: '1h', sent: false },
      ],
    },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export default mongoose.model<ITask>('Task', TaskSchema);
