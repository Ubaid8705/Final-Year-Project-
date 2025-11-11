import Notification from "../models/Notification.js";
import { emitNotification, serializeNotification } from "../socket.js";
import { normalizeObjectId } from "../utils/objectId.js";

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
  const recipientId = normalizeObjectId(recipient);
  const senderId = normalizeObjectId(sender);
  const postId = normalizeObjectId(post);

  if (!recipientId || !type) {
    throw new Error("Notification recipient and type are required");
  }

  if (senderId && recipientId.toString() === senderId.toString()) {
    return null;
  }

  const notification = await Notification.create({
    recipient: recipientId,
    sender: senderId || undefined,
    type,
    post: postId || undefined,
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
  const normalizedRecipient = normalizeObjectId(recipientId);

  if (!normalizedRecipient) {
    return { modifiedCount: 0 };
  }

  const filter = { recipient: normalizedRecipient, isRead: false };

  if (Array.isArray(notificationIds) && notificationIds.length > 0) {
    const normalizedIds = notificationIds
      .map((value) => normalizeObjectId(value))
      .filter(Boolean);

    if (normalizedIds.length === 0) {
      return { modifiedCount: 0 };
    }

    filter._id = { $in: normalizedIds };
  }

  const result = await Notification.updateMany(filter, { $set: { isRead: true } });

  return { modifiedCount: result.modifiedCount ?? result.nModified ?? 0 };
};

export const loadNotifications = async ({
  recipient,
  limit = 20,
  cursor,
}) => {
  const recipientId = normalizeObjectId(recipient);

  if (!recipientId) {
    return {
      items: [],
      unreadCount: 0,
      nextCursor: null,
      hasMore: false,
    };
  }

  const numericLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);

  const query = { recipient: recipientId };
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

  const unreadCount = await Notification.countDocuments({ recipient: recipientId, isRead: false });

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
  const targetId = normalizeObjectId(postId);

  if (!targetId) {
    return 0;
  }

  const result = await Notification.deleteMany({ post: targetId });
  return result.deletedCount || 0;
};
