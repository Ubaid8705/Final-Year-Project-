import User from "../models/User.js";
import UserSettings from "../models/Settings.js";

const isPremiumMembership = (membershipValue, userDoc) => {
  const normalized = (membershipValue || "").toString().trim().toLowerCase();
  if (normalized === "premium") {
    return true;
  }
  if (userDoc && typeof userDoc.membershipStatus === "boolean") {
    return userDoc.membershipStatus;
  }
  return false;
};

const serializeSettings = (settings, userDoc) => ({
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
  isPremium: isPremiumMembership(settings.membership, userDoc),
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
      membership: user.membershipStatus ? "Premium" : "None",
    });
  } else if (!settings.membership && user.membershipStatus) {
    settings.membership = "Premium";
    await settings.save();
  }

  return settings;
};

export const getCurrentSettings = async (req, res) => {
  try {
    const settings = await ensureSettingsDocument(req.user);
    res.json(serializeSettings(settings, req.user));
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
    let membershipStatusChanged = false;

    if (updates.email) {
      userUpdates.email = updates.email.toLowerCase();
    }
    if (updates.username) {
      userUpdates.username = updates.username.toLowerCase();
    }
    if (updates.displayName) {
      userUpdates.name = updates.displayName;
    }

    if (typeof updates.membership === "string") {
      const normalizedMembership = updates.membership.trim().toLowerCase();
      const nextStatus = normalizedMembership === "premium";
      if (req.user.membershipStatus !== nextStatus) {
        req.user.membershipStatus = nextStatus;
        membershipStatusChanged = true;
      }
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
    } else if (membershipStatusChanged) {
      await req.user.save();
    }

    res.json(serializeSettings(settings, req.user));
  } catch (error) {
    res.status(500).json({ error: "Failed to update settings" });
  }
};
