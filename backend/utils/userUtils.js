import User from "../models/User.js";

const sanitizeSegment = (value) => {
  if (!value || typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
};

export const normalizeEmail = (value) => {
  if (!value || typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
};

const buildBaseUsername = (email, fallback) => {
  const emailPrefix = email ? email.split("@")[0] : "";
  const sanitizedEmailPrefix = sanitizeSegment(emailPrefix);
  if (sanitizedEmailPrefix) {
    return sanitizedEmailPrefix;
  }

  const sanitizedFallback = sanitizeSegment(fallback);
  if (sanitizedFallback) {
    return sanitizedFallback;
  }

  return "reader";
};

export const generateUniqueUsername = async (email, fallback) => {
  const base = buildBaseUsername(email, fallback);
  let candidate = base;
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    candidate = `${base}${suffix}`;
    suffix += 1;

    if (suffix > 9999) {
      candidate = `${base}${Date.now()}`;
      break;
    }
  }

  return candidate;
};

export const buildDisplayName = (email, fallback) => {
  if (fallback && typeof fallback === "string" && fallback.trim().length > 0) {
    return fallback.trim();
  }

  if (email) {
    const segment = email.split("@")[0];
    if (segment) {
      return segment;
    }
  }

  return "Reader";
};
