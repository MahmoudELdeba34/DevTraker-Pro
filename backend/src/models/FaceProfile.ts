import mongoose, { Document, Schema, Types } from 'mongoose';
import { FACE_DESCRIPTOR_LENGTH } from '../utils/faceMatch';

/**
 * Per-user face enrollment for attendance verification.
 * One profile per user — stores the reference photo URL and 128-dim face embedding.
 */
export interface IFaceProfile extends Document {
  userId: Types.ObjectId;
  facePhotoUrl: string;
  faceDescriptor: number[];
  enrolledAt: Date;
  updatedAt: Date;
}

const FaceProfileSchema = new Schema<IFaceProfile>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    facePhotoUrl: { type: String, required: true },
    faceDescriptor: {
      type: [Number],
      required: true,
      validate: {
        validator: (v: number[]) => Array.isArray(v) && v.length === FACE_DESCRIPTOR_LENGTH,
        message: `faceDescriptor must be ${FACE_DESCRIPTOR_LENGTH} numbers`,
      },
    },
    enrolledAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: 'enrolledAt', updatedAt: 'updatedAt' } }
);

export default mongoose.model<IFaceProfile>('FaceProfile', FaceProfileSchema);
