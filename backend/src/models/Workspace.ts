import mongoose, { Document, Schema, Types } from 'mongoose';

export type WorkspaceRole = 'admin' | 'member' | 'viewer';

export interface IWorkspaceMember {
  userId: Types.ObjectId;
  role: WorkspaceRole;
  addedAt: Date;
  addedBy?: Types.ObjectId | null;
}

export interface IWorkspace extends Document {
  name: string;
  description?: string;
  ownerId: Types.ObjectId;
  members: IWorkspaceMember[];
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMember>(
  {
    userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role:    { type: String, enum: ['admin', 'member', 'viewer'], default: 'member' },
    addedAt: { type: Date, default: Date.now },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { _id: false }
);

const WorkspaceSchema = new Schema<IWorkspace>(
  {
    name:        { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    ownerId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members:     { type: [WorkspaceMemberSchema], default: [] },
  },
  { timestamps: true }
);

// Useful compound index for "what workspaces is this user in?"
WorkspaceSchema.index({ 'members.userId': 1 });

export default mongoose.model<IWorkspace>('Workspace', WorkspaceSchema);
