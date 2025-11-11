import mongoose from "mongoose";

const { Schema } = mongoose;

const NotificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    type: {
      type: String,
      enum: ["like", "comment", "reply", "follow", "mention", "system"],
      required: true,
    },
    post: {
      type: Schema.Types.ObjectId,
      ref: "Post",
    },
    message: {
      type: String,
      trim: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

NotificationSchema.index({ recipient: 1, createdAt: -1 });

const NotificationModel =
  mongoose.models.Notification || mongoose.model("Notification", NotificationSchema);

export default NotificationModel;
