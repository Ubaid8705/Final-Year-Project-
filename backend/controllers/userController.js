import User from "../models/User.js";
import Relationship from "../models/Relationship.js";
import {
  RELATIONSHIP_STATUS,
  getFollowStatsForUser,
  getRelationshipBetween,
  removeAllRelationshipsForUser,
} from "../services/relationshipService.js";

const OWN_USER_PROJECTION =
  "username name email avatar bio pronouns topics topicsUpdatedAt hasSubdomain customDomainState membershipStatus createdAt updatedAt";
const PUBLIC_USER_PROJECTION =
  "username name avatar bio pronouns membershipStatus topics createdAt updatedAt";

const MAX_TOPIC_COUNT = 12;

const slugifyTopic = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || null;
};

const sanitizeTopicsInput = (topics) => {
  if (!topics) {
    return [];
  }

  const candidateList = Array.isArray(topics) ? topics : [topics];
  const unique = [];

  candidateList.forEach((candidate) => {
    const slug = slugifyTopic(candidate);
    if (!slug) {
      return;
    }
    if (!unique.includes(slug)) {
      unique.push(slug);
    }
  });

  return unique.slice(0, MAX_TOPIC_COUNT);
};

const sanitizeOwnUser = (userDoc) => {
  if (!userDoc) {
    return null;
  }

  const source = userDoc.toObject ? userDoc.toObject({ getters: true }) : userDoc;

  return {
    id: source._id?.toString() || source.id,
    username: source.username,
    name: source.name,
    email: source.email,
    avatar: source.avatar,
    bio: source.bio,
    pronouns: source.pronouns,
    topics: Array.isArray(source.topics) ? source.topics : [],
    topicsUpdatedAt: source.topicsUpdatedAt,
    hasSubdomain: Boolean(source.hasSubdomain),
    customDomainState: source.customDomainState,
    membershipStatus: Boolean(source.membershipStatus),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

const sanitizePublicUser = (userDoc) => {
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
    topics: Array.isArray(source.topics) ? source.topics : [],
    membershipStatus: Boolean(source.membershipStatus),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

// Get current user profile
export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(OWN_USER_PROJECTION);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const stats = await getFollowStatsForUser(req.user._id);

    res.json({
      user: sanitizeOwnUser(user),
      stats,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching user profile" });
  }
};

// Update user profile
export const updateUser = async (req, res) => {
  try {
    const allowedUpdates = [
      "username",
      "name",
      "email",
      "avatar",
      "bio",
      "pronouns",
      "topics",
      "hasSubdomain",
      "customDomainState",
    ];

    const updates = Object.keys(req.body)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

    if (Object.prototype.hasOwnProperty.call(updates, "topics")) {
      const sanitizedTopics = sanitizeTopicsInput(updates.topics);
      updates.topics = sanitizedTopics;
      updates.topicsUpdatedAt = sanitizedTopics.length ? new Date() : null;
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select(OWN_USER_PROJECTION);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: sanitizeOwnUser(user) });
  } catch (error) {
    if (error.code === 11000) {
      res.status(400).json({ error: "Username or email already taken" });
    } else {
      res.status(500).json({ error: "Error updating user profile" });
    }
  }
};

// Delete user account
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.user._id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await removeAllRelationshipsForUser(user._id);

    if (typeof req.logout === "function") {
      req.logout(() => {});
    }

    res.json({ message: "User account deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting user account" });
  }
};

// Get user by username (public profile)
export const getUserByUsername = async (req, res) => {
  try {
    const user = await User.findOne({ username: req.params.username }).select(
      PUBLIC_USER_PROJECTION
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const stats = await getFollowStatsForUser(user._id);

    let relationship = null;
    if (req.user) {
      const [outgoing, incoming] = await Promise.all([
        getRelationshipBetween(req.user._id, user._id),
        getRelationshipBetween(user._id, req.user._id),
      ]);

      relationship = {
        isFollowing: outgoing?.status === RELATIONSHIP_STATUS.FOLLOWING,
        isBlocked: outgoing?.status === RELATIONSHIP_STATUS.BLOCKED,
        isFollowedBy: incoming?.status === RELATIONSHIP_STATUS.FOLLOWING,
        hasBlockedYou: incoming?.status === RELATIONSHIP_STATUS.BLOCKED,
      };
    }

    res.json({
      user: sanitizePublicUser(user),
      stats,
      relationship,
    });
  } catch (error) {
    res.status(500).json({ error: "Error fetching user profile" });
  }
};

export const updateTopics = async (req, res) => {
  try {
    const sanitizedTopics = sanitizeTopicsInput(req.body?.topics);
    const update = {
      topics: sanitizedTopics,
      topicsUpdatedAt: sanitizedTopics.length ? new Date() : null,
    };

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true, runValidators: true }
    ).select(OWN_USER_PROJECTION);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user: sanitizeOwnUser(user) });
  } catch (error) {
    res.status(500).json({ error: "Error updating topics" });
  }
};

export const getSuggestedUsers = async (req, res) => {
  try {
    const viewerId = req.user?._id;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 6, 1), 20);

    let viewerFollowing = new Set();

    if (viewerId) {
      const followingDocs = await Relationship.find({
        follower: viewerId,
        status: RELATIONSHIP_STATUS.FOLLOWING,
      })
        .select("following")
        .lean();

      viewerFollowing = new Set(
        followingDocs
          .map((doc) => doc.following?.toString())
          .filter(Boolean)
      );
      viewerFollowing.add(viewerId.toString());
    }

    const followerAggregation = await Relationship.aggregate([
      { $match: { status: RELATIONSHIP_STATUS.FOLLOWING } },
      {
        $group: {
          _id: "$following",
          followers: { $sum: 1 },
          lastFollowedAt: { $max: "$createdAt" },
        },
      },
      { $sort: { followers: -1, lastFollowedAt: -1 } },
      { $limit: limit * 4 },
    ]);

    const aggregatedIds = followerAggregation
      .map((entry) => (entry?._id ? entry._id.toString() : null))
      .filter(Boolean);

    const candidateIds = new Set();
    aggregatedIds.forEach((id) => {
      if (!viewerFollowing.has(id)) {
        candidateIds.add(id);
      }
    });

    if (candidateIds.size < limit * 2) {
      const fallbackUsers = await User.find({})
        .sort({ createdAt: -1 })
        .limit(limit * 6)
        .select(PUBLIC_USER_PROJECTION)
        .lean();

      fallbackUsers.forEach((userDoc) => {
        const id = userDoc?._id?.toString();
        if (!id || viewerFollowing.has(id)) {
          return;
        }
        candidateIds.add(id);
      });
    }

    const ids = Array.from(candidateIds).slice(0, limit * 2);

    if (!ids.length) {
      return res.json({ suggestions: [] });
    }

    const users = await User.find({ _id: { $in: ids } })
      .select(PUBLIC_USER_PROJECTION)
      .lean();

    const orderedUsers = users.sort((a, b) => {
      const aIdx = ids.indexOf(a._id.toString());
      const bIdx = ids.indexOf(b._id.toString());
      return aIdx - bIdx;
    });

    const payload = await Promise.all(
      orderedUsers.slice(0, limit).map(async (userDoc) => {
        const sanitized = sanitizePublicUser(userDoc);
        const stats = await getFollowStatsForUser(userDoc._id);

        return {
          user: sanitized,
          stats,
          isFollowing: viewerFollowing.has(userDoc._id.toString()),
        };
      })
    );

    res.json({ suggestions: payload });
  } catch (error) {
    res.status(500).json({ error: "Unable to load suggestions" });
  }
};