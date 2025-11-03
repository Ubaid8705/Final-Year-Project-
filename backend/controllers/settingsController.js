import User from "../models/User.js";
import UserSettings from "../models/Settings.js";

const serializeSettings = (settings) => ({
  id: settings._id,
  email: settings.email,
  username: settings.username,
  displayName: settings.displayName,
  visibility: settings.visibility,
  sendEmails: settings.sendEmails,
  commentSetting: settings.commentSetting,
  signature: settings.signature,
  autoSave: settings.autoSave,
  analyticsId: settings.analyticsId,
  digestFrequency: settings.digestFrequency,
  membership: settings.membership,
  updatedAt: settings.updatedAt,
  createdAt: settings.createdAt,
});

const ensureSettingsDocument = async (user) => {
  let settings = await UserSettings.findOne({ user: user._id });

  if (!settings) {
    settings = await UserSettings.create({
      user: user._id,
      email: user.email,
      username: user.username,
      displayName: user.name,
    });
  }

  return settings;
};

export const getCurrentSettings = async (req, res) => {
  try {
    const settings = await ensureSettingsDocument(req.user);
    res.json(serializeSettings(settings));
  } catch (error) {
    res.status(500).json({ error: "Failed to load settings" });
  }
};

export const updateSettings = async (req, res) => {
  try {
    const allowed = [
      "email",
      "username",
      "displayName",
      "visibility",
      "sendEmails",
      "commentSetting",
      "signature",
      "autoSave",
      "analyticsId",
      "digestFrequency",
      "membership",
    ];

    const updates = Object.entries(req.body || {}).reduce((acc, [key, value]) => {
      if (allowed.includes(key)) {
        acc[key] = value;
      }
      return acc;
    }, {});

    const settings = await ensureSettingsDocument(req.user);

    Object.assign(settings, updates);
    await settings.save();

    const userUpdates = {};

    if (updates.email) {
      userUpdates.email = updates.email.toLowerCase();
    }
    if (updates.username) {
      userUpdates.username = updates.username.toLowerCase();
    }
    if (updates.displayName) {
      userUpdates.name = updates.displayName;
    }

    if (Object.keys(userUpdates).length > 0) {
      const existingUserWithUsername = userUpdates.username
        ? await User.findOne({
            username: userUpdates.username,
            _id: { $ne: req.user._id },
          }).select("_id")
        : null;

      if (existingUserWithUsername) {
        return res.status(400).json({ error: "Username already taken" });
      }

      Object.assign(req.user, userUpdates);
      await req.user.save();
    }

    res.json(serializeSettings(settings));
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
};
