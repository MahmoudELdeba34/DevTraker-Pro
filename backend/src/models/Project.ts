import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IProject extends Document {
  userId: Types.ObjectId;
  title: string;
  description?: string;
  deadline?: Date;
  createdAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    deadline: { type: Date },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: false } }
);

export default mongoose.model<IProject>('Project', ProjectSchema);
