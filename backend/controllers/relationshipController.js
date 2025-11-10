import mongoose from "mongoose";
import Relationship from "../models/Relationship.js";
import User from "../models/User.js";
import {
  RELATIONSHIP_STATUS,
  getFollowStatsForUser,
  getRelationshipBetween,
  removeMutualFollowRelationships,
} from "../services/relationshipService.js";
import { safeCreateNotification } from "../services/notificationService.js";

const USER_PROJECTION = "username name avatar bio pronouns membershipStatus createdAt";

const sanitizeUser = (userDoc) => {
  if (!userDoc) {
    return null;
  }

  const source = userDoc.toObject ? userDoc.toObject({ getters: true }) : userDoc;

  return {
    id: source._id?.toString() || source.id,
    username: source.username,
    name: source.name,
    avatar: source.avatar,
    bio: source.bio,
    pronouns: source.pronouns,
    membershipStatus: Boolean(source.membershipStatus),
    createdAt: source.createdAt,
  };
};

const resolveUser = async (identifier) => {
  if (!identifier) {
    return null;
  }

  if (mongoose.Types.ObjectId.isValid(identifier)) {
    const user = await User.findById(identifier).select(USER_PROJECTION);
    if (user) {
      return user;
    }
  }

  return User.findOne({ username: identifier }).select(USER_PROJECTION);
};

const parsePagination = (query) => {
  const rawPage = Number.parseInt(query.page, 10);
  const rawLimit = Number.parseInt(query.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), 50)
    : 20;

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const buildViewerMap = async (viewerId, targetIds) => {
  if (!viewerId || !Array.isArray(targetIds) || targetIds.length === 0) {
    return new Set();
  }

  const relationships = await Relationship.find({
    follower: viewerId,
    following: { $in: targetIds },
    status: RELATIONSHIP_STATUS.FOLLOWING,
  })
    .select("following")
    .lean();

  return new Set(relationships.map((rel) => rel.following.toString()));
};

const buildViewerIncomingMap = async (viewerId, targetIds) => {
  if (!viewerId || !Array.isArray(targetIds) || targetIds.length === 0) {
    return new Set();
  }

  const relationships = await Relationship.find({
    follower: { $in: targetIds },
    following: viewerId,
    status: RELATIONSHIP_STATUS.FOLLOWING,
  })
    .select("follower")
    .lean();

  return new Set(relationships.map((rel) => rel.follower.toString()));
};

const ensureTargetUser = async (identifier) => {
  const user = await resolveUser(identifier);
  if (!user) {
    const error = new Error("User not found");
    error.status = 404;
    throw error;
  }
  return user;
};

const forbidSelfAction = (actorId, targetId) => {
  if (actorId.toString() === targetId.toString()) {
    const error = new Error("Operation not allowed on the same account");
    error.status = 400;
    throw error;
  }
};

const applyErrorHandling = (res, error) => {
  if (error?.status) {
    return res.status(error.status).json({ error: error.message });
  }
  console.error(error);
  return res.status(500).json({ error: "Unable to complete request" });
};

export const followUser = async (req, res) => {
  try {
    const target = await ensureTargetUser(req.params.username);
    forbidSelfAction(req.user._id, target._id);

    const existing = await Relationship.findOne({
      follower: req.user._id,
      following: target._id,
    });

    if (existing?.status === RELATIONSHIP_STATUS.BLOCKED) {
      return res.status(403).json({ error: "You have blocked this user" });
    }

    if (existing?.status === RELATIONSHIP_STATUS.FOLLOWING) {
      const stats = await getFollowStatsForUser(target._id);
      return res.json({
        message: "Already following this user",
        user: sanitizeUser(target),
        stats,
        isFollowing: true,
      });
    }

    await Relationship.findOneAndUpdate(
      { follower: req.user._id, following: target._id },
      { $set: { status: RELATIONSHIP_STATUS.FOLLOWING } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const actorName = req.user.name || req.user.username || "Someone";
    await safeCreateNotification({
      recipient: target._id,
      sender: req.user._id,
      type: "follow",
      message: `${actorName} started following you`,
      metadata: {
        followerId: req.user._id.toString(),
        followerUsername: req.user.username,
      },
    });

    const stats = await getFollowStatsForUser(target._id);

    return res.json({
      message: "Successfully followed user",
      user: sanitizeUser(target),
      stats,
      isFollowing: true,
    });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

export const unfollowUser = async (req, res) => {
  try {
    const target = await ensureTargetUser(req.params.username);
    forbidSelfAction(req.user._id, target._id);

    const deletion = await Relationship.findOneAndDelete({
      follower: req.user._id,
      following: target._id,
      status: RELATIONSHIP_STATUS.FOLLOWING,
    });

    const stats = await getFollowStatsForUser(target._id);

    return res.json({
      message: deletion ? "Successfully unfollowed user" : "You were not following this user",
      user: sanitizeUser(target),
      stats,
      isFollowing: false,
    });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

export const blockUser = async (req, res) => {
  try {
    const target = await ensureTargetUser(req.params.username);
    forbidSelfAction(req.user._id, target._id);

    await removeMutualFollowRelationships(req.user._id, target._id);

    await Relationship.findOneAndUpdate(
      { follower: req.user._id, following: target._id },
      { $set: { status: RELATIONSHIP_STATUS.BLOCKED } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.json({
      message: "User blocked",
      user: sanitizeUser(target),
      status: RELATIONSHIP_STATUS.BLOCKED,
    });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

export const unblockUser = async (req, res) => {
  try {
    const target = await ensureTargetUser(req.params.username);
    forbidSelfAction(req.user._id, target._id);

    const result = await Relationship.findOneAndDelete({
      follower: req.user._id,
      following: target._id,
      status: RELATIONSHIP_STATUS.BLOCKED,
    });

    return res.json({
      message: result ? "User unblocked" : "This user was not blocked",
      user: sanitizeUser(target),
      status: result ? null : RELATIONSHIP_STATUS.BLOCKED,
    });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

export const listFollowers = async (req, res) => {
  try {
    const target = await ensureTargetUser(req.params.username);
    const { page, limit, skip } = parsePagination(req.query);

    const [relationships, total] = await Promise.all([
      Relationship.find({
        following: target._id,
        status: RELATIONSHIP_STATUS.FOLLOWING,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "follower", select: USER_PROJECTION })
        .lean(),
      Relationship.countDocuments({
        following: target._id,
        status: RELATIONSHIP_STATUS.FOLLOWING,
      }),
    ]);

    let followers = relationships
      .map((rel) => sanitizeUser(rel.follower))
      .filter(Boolean);

    if (req.user && followers.length > 0) {
      const ids = followers.map((user) => user.id);
      const viewerFollowing = await buildViewerMap(req.user._id, ids);
      const viewerFollowedBy = await buildViewerIncomingMap(req.user._id, ids);

      followers = followers.map((user) => ({
        ...user,
        isFollowedByViewer: viewerFollowing.has(user.id),
        followsViewer: viewerFollowedBy.has(user.id),
      }));
    }

    const hasMore = skip + followers.length < total;

    return res.json({
      user: sanitizeUser(target),
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
      followers,
    });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

export const listFollowing = async (req, res) => {
  try {
    const target = await ensureTargetUser(req.params.username);
    const { page, limit, skip } = parsePagination(req.query);

    const [relationships, total] = await Promise.all([
      Relationship.find({
        follower: target._id,
        status: RELATIONSHIP_STATUS.FOLLOWING,
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate({ path: "following", select: USER_PROJECTION })
        .lean(),
      Relationship.countDocuments({
        follower: target._id,
        status: RELATIONSHIP_STATUS.FOLLOWING,
      }),
    ]);

    let following = relationships
      .map((rel) => sanitizeUser(rel.following))
      .filter(Boolean);

    if (req.user && following.length > 0) {
      const ids = following.map((user) => user.id);
      const viewerFollowing = await buildViewerMap(req.user._id, ids);
      const viewerFollowedBy = await buildViewerIncomingMap(req.user._id, ids);

      following = following.map((user) => ({
        ...user,
        isFollowedByViewer: viewerFollowing.has(user.id),
        followsViewer: viewerFollowedBy.has(user.id),
      }));
    }

    const hasMore = skip + following.length < total;

    return res.json({
      user: sanitizeUser(target),
      pagination: {
        page,
        limit,
        total,
        hasMore,
      },
      following,
    });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

export const getFollowStats = async (req, res) => {
  try {
    const target = await ensureTargetUser(req.params.username);
    const stats = await getFollowStatsForUser(target._id);

    return res.json({
      user: sanitizeUser(target),
      stats,
    });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

export const listBlockedUsers = async (req, res) => {
  try {
    const relationships = await Relationship.find({
      follower: req.user._id,
      status: RELATIONSHIP_STATUS.BLOCKED,
    })
      .sort({ createdAt: -1 })
      .populate({ path: "following", select: USER_PROJECTION })
      .lean();

    const blocked = relationships
      .map((rel) => sanitizeUser(rel.following))
      .filter(Boolean);

    return res.json({ blocked });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

export const getMyFollowStats = async (req, res) => {
  try {
    const stats = await getFollowStatsForUser(req.user._id);
    return res.json({ stats });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

export const getRelationshipStatus = async (req, res) => {
  try {
    const target = await ensureTargetUser(req.params.username);

    if (req.user._id.toString() === target._id.toString()) {
      return res.json({
        user: sanitizeUser(target),
        status: {
          isSelf: true,
          isFollowing: false,
          isBlocked: false,
          isFollowedBy: false,
          hasBlockedYou: false,
        },
      });
    }

    const [outgoing, incoming] = await Promise.all([
      getRelationshipBetween(req.user._id, target._id),
      getRelationshipBetween(target._id, req.user._id),
    ]);

    return res.json({
      user: sanitizeUser(target),
      status: {
        isFollowing: outgoing?.status === RELATIONSHIP_STATUS.FOLLOWING,
        isBlocked: outgoing?.status === RELATIONSHIP_STATUS.BLOCKED,
        isFollowedBy: incoming?.status === RELATIONSHIP_STATUS.FOLLOWING,
        hasBlockedYou: incoming?.status === RELATIONSHIP_STATUS.BLOCKED,
      },
    });
  } catch (error) {
    return applyErrorHandling(res, error);
  }
};

