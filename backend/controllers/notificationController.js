import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import {
  loadNotifications,
  markNotificationsRead,
} from "../services/notificationService.js";
import { serializeNotification } from "../socket.js";

const toObjectId = (value) => {
  if (!value) {
    return null;
  }
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

export const listNotifications = async (req, res) => {
  try {
    const { cursor, limit } = req.query;
    const payload = await loadNotifications({
      recipient: req.user._id,
      limit,
      cursor,
    });

    res.json(payload);
  } catch (error) {
    res.status(500).json({ error: "Failed to load notifications" });
  }
};

export const markNotificationAsRead = async (req, res) => {
  try {
    const notificationId = toObjectId(req.params.id);
    if (!notificationId) {
      return res.status(400).json({ error: "Invalid notification id" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: req.user._id },
      { $set: { isRead: true } },
      { new: true }
    )
      .populate("sender", "username name avatar")
      .populate("post", "title slug coverImage");

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json({ item: serializeNotification(notification) });
  } catch (error) {
    res.status(500).json({ error: "Failed to update notification" });
  }
};

export const markAllNotificationsAsRead = async (req, res) => {
  try {
    const result = await markNotificationsRead(req.user._id);
    res.json({ modifiedCount: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark notifications as read" });
  }
};
