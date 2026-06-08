import mongoose, { Document, Schema, Types } from 'mongoose';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed';
export type ReminderThreshold = '24h' | '12h' | '1h';

export interface ITimeLog {
  userId: Types.ObjectId;
  start: Date;
  end: Date;
  duration: number; // ms
}

export interface IReminder {
  threshold: ReminderThreshold;
  sent: boolean;
}

export interface ISubtask {
  _id: Types.ObjectId;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedTo?: Types.ObjectId | null;
  deadline?: Date;
  createdAt: Date;
}

export interface ITask extends Document {
  projectId: Types.ObjectId;
  title: string;
  priority: TaskPriority;
  status: TaskStatus;
  deadline?: Date;
  startDate?: Date;
  timeLogs: ITimeLog[];
  subtasks: ISubtask[];
  activeTimerStart?: Date | null;
  activeTimerUserId?: Types.ObjectId | null;
  assignedTo?: Types.ObjectId | null;
  reminders: IReminder[];
  createdAt: Date;
}

const TimeLogSchema = new Schema<ITimeLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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

const SubtaskSchema = new Schema<ISubtask>(
  {
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['not_started', 'in_progress', 'in_review', 'completed'],
      default: 'not_started',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    deadline: { type: Date },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
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
      enum: ['not_started', 'in_progress', 'in_review', 'completed'],
      default: 'not_started',
    },
    deadline: { type: Date },
    startDate: { type: Date },
    timeLogs: { type: [TimeLogSchema], default: [] },
    subtasks: { type: [SubtaskSchema], default: [] },
    activeTimerStart: { type: Date, default: null },
    activeTimerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
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
