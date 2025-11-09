import mongoose from "mongoose";
import Relationship from "../models/Relationship.js";

export const RELATIONSHIP_STATUS = {
  FOLLOWING: "following",
  BLOCKED: "blocked",
};

export const toObjectId = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

export const countFollowers = (userId) =>
  Relationship.countDocuments({ following: userId, status: RELATIONSHIP_STATUS.FOLLOWING });

export const countFollowing = (userId) =>
  Relationship.countDocuments({ follower: userId, status: RELATIONSHIP_STATUS.FOLLOWING });

export const getFollowStatsForUser = async (userId) => {
  const objectId = toObjectId(userId);
  if (!objectId) {
    return { followers: 0, following: 0 };
  }

  const [followers, following] = await Promise.all([
    countFollowers(objectId),
    countFollowing(objectId),
  ]);

  return { followers, following };
};

export const getRelationshipBetween = (followerId, followingId) =>
  Relationship.findOne({ follower: followerId, following: followingId });

export const removeFollowingRelationship = (followerId, followingId) =>
  Relationship.deleteOne({ follower: followerId, following: followingId, status: RELATIONSHIP_STATUS.FOLLOWING });

export const removeMutualFollowRelationships = (firstUserId, secondUserId) =>
  Relationship.deleteMany({
    $or: [
      {
        follower: firstUserId,
        following: secondUserId,
        status: RELATIONSHIP_STATUS.FOLLOWING,
      },
      {
        follower: secondUserId,
        following: firstUserId,
        status: RELATIONSHIP_STATUS.FOLLOWING,
      },
    ],
  });

export const removeAllRelationshipsForUser = async (userId) => {
  const id = toObjectId(userId);
  if (!id) {
    return;
  }

  await Relationship.deleteMany({
    $or: [{ follower: id }, { following: id }],
  });
};
