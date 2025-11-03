import mongoose from "mongoose";

const userSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    displayName: {
      type: String,
      trim: true,
    },
    visibility: {
      type: String,
      enum: ["Public", "Unlisted", "Private"],
      default: "Public",
    },
    sendEmails: {
      type: Boolean,
      default: true,
    },
    commentSetting: {
      type: String,
      enum: ["Everyone", "Followers only", "Disabled"],
      default: "Everyone",
    },
    signature: {
      type: String,
      default: "Thank you for reading!",
      trim: true,
    },
    autoSave: {
      type: Boolean,
      default: true,
    },
    analyticsId: {
      type: String,
      default: "",
      trim: true,
    },
    digestFrequency: {
      type: String,
      enum: ["Daily", "Weekly", "Monthly"],
      default: "Weekly",
    },
    membership: {
      type: String,
      default: "None",
      trim: true,
    },
  },
  { timestamps: true }
);

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);
export default UserSettings;
