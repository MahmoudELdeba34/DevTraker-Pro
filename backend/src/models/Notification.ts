import mongoose, { Document, Schema, Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: 'task_assigned' | 'subtask_assigned' | 'project_invited' | 'workspace_invited' | 'leave_approved' | 'leave_rejected' | 'permission_approved' | 'permission_rejected' | 'overtime_approved' | 'overtime_rejected' | 'account_created' | 'password_reset' | 'general';
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'task_assigned', 'subtask_assigned', 'project_invited',
        'workspace_invited', 'leave_approved', 'leave_rejected',
        'permission_approved', 'permission_rejected',
        'overtime_approved', 'overtime_rejected',
        'account_created', 'password_reset', 'general'
      ],
      default: 'general',
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export default mongoose.model<INotification>('Notification', NotificationSchema);
