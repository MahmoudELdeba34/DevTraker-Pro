import mongoose from 'mongoose';
import FaceProfile, { IFaceProfile } from '../models/FaceProfile';
import User from '../models/User';
import { deleteFacePhotoFile } from './facePhotos';

export interface FaceProfileSnapshot {
  enrolled: boolean;
  facePhotoUrl: string | null;
  enrolledAt: Date | null;
  descriptor: number[] | null;
}

/** Load face profile; migrates legacy User.face* fields if needed. */
export async function getFaceProfile(userId: string): Promise<IFaceProfile | null> {
  if (!mongoose.Types.ObjectId.isValid(userId)) return null;

  let profile = await FaceProfile.findOne({ userId });
  if (profile) return profile;

  const user = await User.findById(userId).select('facePhotoUrl faceDescriptor faceEnrolledAt');
  if (!user?.faceDescriptor?.length || !user.facePhotoUrl) return null;

  profile = await FaceProfile.create({
    userId: new mongoose.Types.ObjectId(userId),
    facePhotoUrl: user.facePhotoUrl,
    faceDescriptor: user.faceDescriptor,
    enrolledAt: user.faceEnrolledAt ?? new Date(),
  });
  return profile;
}

export async function getFaceProfileSnapshot(userId: string): Promise<FaceProfileSnapshot> {
  const profile = await getFaceProfile(userId);
  if (!profile) {
    return { enrolled: false, facePhotoUrl: null, enrolledAt: null, descriptor: null };
  }
  return {
    enrolled: true,
    facePhotoUrl: profile.facePhotoUrl,
    enrolledAt: profile.enrolledAt,
    descriptor: profile.faceDescriptor,
  };
}

export async function saveFaceProfile(
  userId: string,
  photoUrl: string,
  descriptor: number[]
): Promise<IFaceProfile> {
  const oid = new mongoose.Types.ObjectId(userId);
  const existing = await FaceProfile.findOne({ userId: oid });
  const user = await User.findById(userId).select('facePhotoUrl');

  const previousUrl = existing?.facePhotoUrl || user?.facePhotoUrl;
  if (previousUrl && previousUrl !== photoUrl) {
    deleteFacePhotoFile(previousUrl);
  }

  const now = new Date();
  let profile: IFaceProfile;

  if (existing) {
    existing.facePhotoUrl = photoUrl;
    existing.faceDescriptor = descriptor;
    existing.enrolledAt = now;
    await existing.save();
    profile = existing;
  } else {
    profile = await FaceProfile.create({
      userId: oid,
      facePhotoUrl: photoUrl,
      faceDescriptor: descriptor,
      enrolledAt: now,
    });
  }

  await User.findByIdAndUpdate(userId, {
    facePhotoUrl: photoUrl,
    faceDescriptor: descriptor,
    faceEnrolledAt: now,
  });

  return profile;
}

export async function deleteFaceProfile(userId: string): Promise<void> {
  const profile = await FaceProfile.findOne({ userId });
  if (profile?.facePhotoUrl) {
    deleteFacePhotoFile(profile.facePhotoUrl);
  }
  await FaceProfile.deleteOne({ userId });

  await User.findByIdAndUpdate(userId, {
    $unset: { facePhotoUrl: 1, faceDescriptor: 1, faceEnrolledAt: 1 },
  });
}
