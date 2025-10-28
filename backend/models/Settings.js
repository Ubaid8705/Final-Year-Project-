const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // Reference to your main User model
      required: true,
      unique: true, // One settings document per user
    },

    // ACCOUNT SETTINGS
    email: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
    },

    // PUBLISHING SETTINGS
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
    },
    autoSave: {
      type: Boolean,
      default: true,
    },
    analyticsId: {
      type: String,
      default: "",
    },

    // ADDITIONAL SETTINGS
    digestFrequency: {
      type: String,
      enum: ["Daily", "Weekly", "Monthly"],
      default: "Weekly",
    },
    membership: {
      type: String,
      default: "None",
    },
  },
  { timestamps: true }
);

const UserSettings = mongoose.model("UserSettings", userSettingsSchema);
export default UserSettings;
