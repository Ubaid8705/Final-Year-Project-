import Notification from "../models/Notification.js";
import { emitNotification, serializeNotification } from "../socket.js";

const SENDER_PROJECTION = "username name avatar";
const POST_PROJECTION = "title slug coverImage";

const noop = () => {};

export const createNotification = async ({
  recipient,
  sender,
  type,
  post,
  message,
  metadata = {},
}) => {
  if (!recipient || !type) {
    throw new Error("Notification recipient and type are required");
  }

  if (sender && recipient.toString() === sender.toString()) {
    return null;
  }

  const notification = await Notification.create({
    recipient,
    sender,
    type,
    post,
    message,
    metadata,
  });

  await notification.populate([
    { path: "sender", select: SENDER_PROJECTION },
    { path: "post", select: POST_PROJECTION },
  ]);

  const payload = serializeNotification(notification);
  emitNotification(payload);

  return payload;
};

export const safeCreateNotification = async (payload) => {
  try {
    return await createNotification(payload);
  } catch (error) {
    console.error("Failed to create notification", error);
    return null;
  }
};

export const markNotificationsRead = async (recipientId, notificationIds = []) => {
  if (!recipientId) {
    return { modifiedCount: 0 };
  }

  const filter = { recipient: recipientId, isRead: false };

  if (Array.isArray(notificationIds) && notificationIds.length > 0) {
    filter._id = { $in: notificationIds };
  }

  const result = await Notification.updateMany(filter, { $set: { isRead: true } });

  return { modifiedCount: result.modifiedCount ?? result.nModified ?? 0 };
};

export const loadNotifications = async ({
  recipient,
  limit = 20,
  cursor,
}) => {
  const numericLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const query = { recipient };
  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query.createdAt = { $lt: cursorDate };
    }
  }

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(numericLimit)
    .populate({ path: "sender", select: SENDER_PROJECTION })
    .populate({ path: "post", select: POST_PROJECTION })
    .lean();

  const unreadCount = await Notification.countDocuments({ recipient, isRead: false });

  const items = notifications.map(serializeNotification);
  const nextCursor = items.length === numericLimit ? items[items.length - 1].createdAt : null;

  return {
    items,
    unreadCount,
    nextCursor,
    hasMore: Boolean(nextCursor),
  };
};

export const deleteNotificationsForPost = async (postId) => {
  if (!postId) {
    return 0;
  }

  const result = await Notification.deleteMany({ post: postId });
  return result.deletedCount || 0;
};
