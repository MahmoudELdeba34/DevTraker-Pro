import mongoose, { Document, Schema } from 'mongoose';

export interface IPolicy extends Document {
  type: 'attendance' | 'leave' | 'overtime';
  name: string;
  rules: Record<string, any>;
  isDefault: boolean;
}

const PolicySchema = new Schema<IPolicy>(
  {
    type: { type: String, enum: ['attendance', 'leave', 'overtime'], required: true },
    name: { type: String, required: true, trim: true },
    rules: { type: Schema.Types.Mixed, default: {} },
    isDefault: { type: Boolean, default: false }
  },
  { timestamps: true }
);

export default mongoose.model<IPolicy>('Policy', PolicySchema);
