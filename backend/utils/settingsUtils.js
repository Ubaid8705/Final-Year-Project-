import UserSettings from "../models/Settings.js";

const buildDefaultSettingsPayload = (userDoc) => ({
  user: userDoc._id,
  email: userDoc.email,
  username: userDoc.username,
  displayName: userDoc.name,
  membership: userDoc.membershipStatus ? "Premium" : "None",
});

export const ensureUserSettings = async (userDoc) => {
  if (!userDoc?._id) {
    return null;
  }

  const existing = await UserSettings.findOne({ user: userDoc._id });
  if (existing) {
    if (!existing.membership && userDoc.membershipStatus) {
      existing.membership = "Premium";
      await existing.save();
    }
    return existing;
  }

  const defaults = buildDefaultSettingsPayload(userDoc);
  return UserSettings.create(defaults);
};
