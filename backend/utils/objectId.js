import mongoose from "mongoose";

export const normalizeObjectId = (value) => {
  if (!value) {
    return null;
  }

  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  if (typeof value === "string") {
    return mongoose.Types.ObjectId.isValid(value)
      ? new mongoose.Types.ObjectId(value)
      : null;
  }

  if (typeof value === "object") {
    const candidate = value._id || value.id;
    if (candidate) {
      return normalizeObjectId(candidate);
    }
  }

  return null;
};

export const objectIdToString = (value) => {
  const normalized = normalizeObjectId(value);
  return normalized ? normalized.toString() : null;
};
