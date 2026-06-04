import Notification from '../models/Notification';
import { Types } from 'mongoose';

/**
 * Creates a notification for a specific user.
 * This is a fire-and-forget helper — errors are logged but never thrown.
 */
export async function createNotification(params: {
  userId: string | Types.ObjectId;
  type: string;
  title: string;
  message: string;
  link?: string;
}): Promise<void> {
  try {
    await Notification.create({
      userId: typeof params.userId === 'string' ? new Types.ObjectId(params.userId) : params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      link: params.link || '',
    });
  } catch (err) {
    console.error('[Notification] Failed to create notification:', err);
  }
}
