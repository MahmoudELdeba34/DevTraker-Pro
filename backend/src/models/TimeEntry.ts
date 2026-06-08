import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A flat, top-level time entry — used for Quick Sessions and (eventually)
 * for unifying all time tracking. A QuickSession has no `taskId`.
 *
 * Per-user invariant: a user can only have ONE running entry at a time
 * (the one with `endedAt: null`). Enforced via a partial unique index.
 */
export interface ITimeEntry extends Document {
  userId:       Types.ObjectId;
  taskId?:      Types.ObjectId | null;
  projectId?:   Types.ObjectId | null;
  workspaceId?: Types.ObjectId | null;
  description:  string;
  startedAt:    Date;
  endedAt?:     Date | null;
  duration:     number;            // ms; 0 while running
  source:       'quick' | 'task';  // origin of the entry
  createdAt:    Date;
}

const TimeEntrySchema = new Schema<ITimeEntry>(
  {
    userId:      { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    taskId:      { type: Schema.Types.ObjectId, ref: 'Task', default: null, index: true },
    projectId:   { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', default: null },
    description: { type: String, default: '', trim: true, maxlength: 280 },
    startedAt:   { type: Date, required: true, index: true },
    endedAt:     { type: Date, default: null },
    duration:    { type: Number, default: 0 },
    source:      { type: String, enum: ['quick', 'task'], default: 'quick' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

// One running entry per user
TimeEntrySchema.index(
  { userId: 1, endedAt: 1 },
  { unique: true, partialFilterExpression: { endedAt: null } }
);

export default mongoose.model<ITimeEntry>('TimeEntry', TimeEntrySchema);
