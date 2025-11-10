import UserSettings from "../models/Settings.js";

export const buildDefaultSettingsPayload = (userDoc = {}) => {
  const rawEmail = typeof userDoc.email === "string" ? userDoc.email : "";
  const email = rawEmail.trim().toLowerCase();
  const rawUsername = typeof userDoc.username === "string" ? userDoc.username : "";
  const username = rawUsername.trim().toLowerCase();

  const displayNameCandidate =
    (typeof userDoc.name === "string" && userDoc.name.trim()) ||
    (typeof userDoc.displayName === "string" && userDoc.displayName.trim()) ||
    username ||
    (email ? email.split("@")[0] : "");

  const displayName = displayNameCandidate || undefined;

  return {
    user: userDoc._id,
    email,
    username,
    displayName,
    membership: userDoc.membershipStatus ? "Premium" : "None",
  };
};

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
  if (!defaults.email || !defaults.username) {
    throw new Error("User settings require both email and username");
  }

  return UserSettings.create(defaults);
};
