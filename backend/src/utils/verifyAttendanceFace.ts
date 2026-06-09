import User from '../models/User';
import {
  faceDistance,
  isFaceMatch,
  parseFaceDescriptor,
} from './faceMatch';
import { deleteAttendancePhotoFile } from './attendancePhotos';

export interface FaceVerifyResult {
  ok: boolean;
  distance?: number;
  error?: string;
}

export async function verifyUserFace(
  userId: string,
  descriptorRaw: unknown,
  photoUrlToCleanupOnFail?: string
): Promise<FaceVerifyResult> {
  const probe = parseFaceDescriptor(descriptorRaw);
  if (!probe) {
    if (photoUrlToCleanupOnFail) deleteAttendancePhotoFile(photoUrlToCleanupOnFail);
    return { ok: false, error: 'Invalid face data. Please capture your face again.' };
  }

  const user = await User.findById(userId).select('faceDescriptor faceEnrolledAt');
  if (!user?.faceDescriptor?.length) {
    if (photoUrlToCleanupOnFail) deleteAttendancePhotoFile(photoUrlToCleanupOnFail);
    return {
      ok: false,
      error: 'Face not enrolled. Register your face before checking in.',
    };
  }

  const distance = faceDistance(user.faceDescriptor, probe);
  if (!isFaceMatch(user.faceDescriptor, probe)) {
    if (photoUrlToCleanupOnFail) deleteAttendancePhotoFile(photoUrlToCleanupOnFail);
    return {
      ok: false,
      distance,
      error: 'Face does not match your registered profile. Access denied.',
    };
  }

  return { ok: true, distance };
}
