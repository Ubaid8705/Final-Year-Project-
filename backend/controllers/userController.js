import User from "../models/User.js";
import Post from "../models/Post.js";
import Relationship from "../models/Relationship.js";
import UserSettings from "../models/Settings.js";
import { deleteAssetByPublicId } from "../services/cloudinaryService.js";
import {
  RELATIONSHIP_STATUS,
  getFollowStatsForUser,
  getRelationshipBetween,
  removeAllRelationshipsForUser,
} from "../services/relationshipService.js";

const OWN_USER_PROJECTION =
  "username name email avatar coverImage bio pronouns topics topicsUpdatedAt hasSubdomain customDomainState membershipStatus createdAt updatedAt";
const PUBLIC_USER_PROJECTION =
  "username name avatar coverImage bio pronouns membershipStatus topics createdAt updatedAt";

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

const toTrimmedString = (value) => {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
};

const sanitizeImageAsset = (imageDoc) => {
  if (!imageDoc) {
    return null;
  }

  const source = imageDoc.toObject ? imageDoc.toObject({ getters: true }) : imageDoc;

  const url = toTrimmedString(source.url);
  const secureUrl = toTrimmedString(source.secureUrl);
  const originalUrl = toTrimmedString(source.originalUrl);
  const thumbnailUrl = toTrimmedString(source.thumbnailUrl);
  const placeholderUrl = toTrimmedString(source.placeholderUrl);
  const publicId = toTrimmedString(source.publicId);

  const primary = secureUrl || url || originalUrl || thumbnailUrl;

  if (!primary && !placeholderUrl) {
    return null;
  }

  const payload = {
    url: primary || placeholderUrl || null,
    secureUrl: secureUrl || primary || placeholderUrl || null,
    originalUrl: originalUrl || secureUrl || primary || null,
    thumbnailUrl: thumbnailUrl || null,
    placeholderUrl: placeholderUrl || null,
    publicId: publicId || null,
  };

  const uploadedRaw = source.uploadedAt || source.uploaded_at;
  if (uploadedRaw) {
    const uploadedAt = new Date(uploadedRaw);
    if (!Number.isNaN(uploadedAt.getTime())) {
      payload.uploadedAt = uploadedAt.toISOString();
    }
  }

  return payload;
};

const sanitizeCoverImageInput = (input) => {
  if (input === null || typeof input === "undefined" || input === "") {
    return { value: null };
  }

  if (typeof input !== "object") {
    return { error: "Invalid cover image payload." };
  }

  const pick = (key) => {
    const candidate = input[key];
    if (typeof candidate === "string") {
      const trimmed = candidate.trim();
      return trimmed || null;
    }
    return null;
  };

  const url = pick("url") || pick("displayUrl");
  const secureUrl = pick("secureUrl");
  const originalUrl = pick("originalUrl");
  const thumbnailUrl = pick("thumbnailUrl");
  const placeholderUrl = pick("placeholderUrl");
  const publicId = pick("publicId");

  const primary = secureUrl || url || originalUrl || thumbnailUrl;

  if (!primary) {
    return { error: "Cover image is missing a valid URL." };
  }

  const payload = {
    url: url || secureUrl || originalUrl || thumbnailUrl,
    secureUrl: secureUrl || url || originalUrl || thumbnailUrl,
    originalUrl: originalUrl || secureUrl || url || thumbnailUrl,
    thumbnailUrl: thumbnailUrl || undefined,
    placeholderUrl: placeholderUrl || undefined,
    publicId: publicId || undefined,
  };

  const uploadedRaw = input.uploadedAt || input.uploaded_at;
  if (uploadedRaw) {
    const uploadedAt = new Date(uploadedRaw);
    if (!Number.isNaN(uploadedAt.getTime())) {
      payload.uploadedAt = uploadedAt;
    }
  }

  const normalized = Object.entries(payload).reduce((acc, [key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      acc[key] = value;
    }
    return acc;
  }, {});

  if (!normalized.url) {
    normalized.url = primary;
  }

  if (!normalized.secureUrl) {
    normalized.secureUrl = normalized.url;
  }

  if (!normalized.originalUrl) {
    normalized.originalUrl = normalized.secureUrl;
  }

  return { value: normalized };
};

const sanitizePronounsInput = (pronouns) => {
  if (!pronouns) {
    return [];
  }

  const sourceList = Array.isArray(pronouns) ? pronouns : [pronouns];
  const unique = [];

  sourceList.forEach((item) => {
    const sanitized = toTrimmedString(item);
    if (!sanitized) {
      return;
    }
    if (sanitized.length > 24) {
      return;
    }
    const lower = sanitized.toLowerCase();
    if (!unique.some((existing) => existing.toLowerCase() === lower)) {
      unique.push(sanitized);
    }
  });

  return unique.slice(0, 4);
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
    coverImage: sanitizeImageAsset(source.coverImage),
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
    coverImage: sanitizeImageAsset(source.coverImage),
    bio: source.bio,
    pronouns: source.pronouns,
    topics: Array.isArray(source.topics) ? source.topics : [],
    membershipStatus: Boolean(source.membershipStatus),
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  };
};

const sanitizeProfileSettings = (settingsDoc) => {
  if (!settingsDoc) {
    return {
      visibility: "Public",
      commentSetting: "Everyone",
      sendEmails: true,
    };
  }

  const source = settingsDoc.toObject ? settingsDoc.toObject({ getters: true }) : settingsDoc;

  return {
    visibility: source.visibility || "Public",
    commentSetting: source.commentSetting || "Everyone",
    sendEmails: typeof source.sendEmails === "boolean" ? source.sendEmails : true,
  };
};

// Get current user profile
export const getCurrentUser = async (req, res) => {
  try {
    const [userDoc, stats, settingsDoc] = await Promise.all([
      User.findById(req.user._id).select(OWN_USER_PROJECTION),
      getFollowStatsForUser(req.user._id),
      UserSettings.findOne({ user: req.user._id }).lean(),
    ]);

    if (!userDoc) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      user: sanitizeOwnUser(userDoc),
      stats,
      settings: sanitizeProfileSettings(settingsDoc),
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
      "coverImage",
    ];

    const sourceBody = req.body && typeof req.body === "object" ? req.body : {};
    const updates = Object.keys(sourceBody)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = sourceBody[key];
        return obj;
      }, {});

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let coverImageToDelete = null;

    if (Object.prototype.hasOwnProperty.call(updates, "topics")) {
      const sanitizedTopics = sanitizeTopicsInput(updates.topics);
      user.topics = sanitizedTopics;
      user.topicsUpdatedAt = sanitizedTopics.length ? new Date() : null;
      user.markModified("topics");
    }

    if (Object.prototype.hasOwnProperty.call(updates, "pronouns")) {
      const sanitizedPronouns = sanitizePronounsInput(updates.pronouns);
      user.pronouns = sanitizedPronouns;
      user.markModified("pronouns");
    }

    if (Object.prototype.hasOwnProperty.call(updates, "coverImage")) {
      const { value: nextCover, error: coverError } = sanitizeCoverImageInput(updates.coverImage);
      if (coverError) {
        return res.status(400).json({ error: coverError });
      }

      const currentCover = user.coverImage;

      if (!nextCover) {
        if (currentCover?.publicId) {
          coverImageToDelete = currentCover.publicId;
        }
        user.coverImage = null;
      } else {
        if (currentCover?.publicId) {
          if (!nextCover.publicId || currentCover.publicId !== nextCover.publicId) {
            coverImageToDelete = currentCover.publicId;
          }
        }
        user.coverImage = nextCover;
      }

      user.markModified("coverImage");
    }

    const directKeys = [
      "username",
      "name",
      "email",
      "avatar",
      "bio",
      "hasSubdomain",
      "customDomainState",
    ];

    directKeys.forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        const value = updates[key];
        user[key] = typeof value === "string" ? value.trim() : value;
      }
    });

    await user.save({ validateBeforeSave: true });

    if (coverImageToDelete) {
      const cleanupResult = await deleteAssetByPublicId(coverImageToDelete);
      if (!cleanupResult.success) {
        console.warn(
          "Unable to remove previous cover image",
          cleanupResult.error || cleanupResult.reason || "unknown-error"
        );
      }
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
    // Decode and normalize the username parameter
    const normalizedUsername = decodeURIComponent(req.params.username).trim();
    
    // Case-insensitive username lookup
    const user = await User.findOne({ 
      username: { $regex: new RegExp(`^${normalizedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    }).select(
      PUBLIC_USER_PROJECTION
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

  const viewerId = req.user?._id;
  const isSelf = viewerId && user._id.toString() === viewerId.toString();

    const [stats, settingsDoc] = await Promise.all([
      getFollowStatsForUser(user._id),
      UserSettings.findOne({ user: user._id }).lean(),
    ]);

    const profileSettings = sanitizeProfileSettings(settingsDoc);

    let relationship = null;
    let permissions = {
      canViewProfile: true,
      canViewPosts: true,
      canViewLists: Boolean(isSelf),
      reason: null,
    };

    if (viewerId) {
      const [outgoing, incoming] = await Promise.all([
        getRelationshipBetween(viewerId, user._id),
        getRelationshipBetween(user._id, viewerId),
      ]);

      relationship = {
        isFollowing: outgoing?.status === RELATIONSHIP_STATUS.FOLLOWING,
        isBlocked: outgoing?.status === RELATIONSHIP_STATUS.BLOCKED,
        isFollowedBy: incoming?.status === RELATIONSHIP_STATUS.FOLLOWING,
        hasBlockedYou: incoming?.status === RELATIONSHIP_STATUS.BLOCKED,
      };

      if (relationship.hasBlockedYou) {
        permissions = {
          canViewProfile: false,
          canViewPosts: false,
          canViewLists: false,
          reason: "blocked",
        };
      } else {
        const isFollower = relationship.isFollowing;

        if (relationship.isBlocked) {
          permissions.canViewPosts = false;
          permissions.canViewLists = false;
          permissions.reason = "self-blocked";
        }

        if (profileSettings.visibility === "Private" && !isSelf && !isFollower) {
          if (!permissions.reason) {
            permissions.reason = "private";
          }
          permissions.canViewPosts = false;
        }
      }
    } else if (!isSelf && profileSettings.visibility === "Private") {
      permissions.canViewPosts = false;
      permissions.reason = "private";
    }

    if (isSelf) {
      permissions = {
        canViewProfile: true,
        canViewPosts: true,
        canViewLists: true,
        reason: null,
      };
    }

    res.json({
      user: sanitizePublicUser(user),
      stats,
      relationship,
      settings: profileSettings,
      permissions,
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
    let viewerTopics = [];
    const viewerIdString = viewerId ? viewerId.toString() : null;

    if (viewerId) {
      const [followingDocs, viewerDoc] = await Promise.all([
        Relationship.find({
          follower: viewerId,
          status: RELATIONSHIP_STATUS.FOLLOWING,
        })
          .select("following")
          .lean(),
        User.findById(viewerId).select("topics").lean(),
      ]);

      viewerFollowing = new Set(
        followingDocs
          .map((doc) => doc.following?.toString())
          .filter(Boolean)
      );
      viewerFollowing.add(viewerIdString);

      viewerTopics = Array.isArray(viewerDoc?.topics)
        ? viewerDoc.topics.filter(Boolean)
        : [];
    }

    const normalizedViewerTopics = viewerTopics.map((topic) => topic.toLowerCase());
    const candidateMap = new Map();

    if (normalizedViewerTopics.length) {
      const topicCandidates = await User.find({
        topics: { $in: normalizedViewerTopics },
      })
        .select(PUBLIC_USER_PROJECTION)
        .limit(limit * 8)
        .lean();

      topicCandidates.forEach((userDoc) => {
        const id = userDoc?._id?.toString();
        if (!id) {
          return;
        }
        if (viewerIdString && id === viewerIdString) {
          return;
        }
        if (viewerFollowing.has(id)) {
          return;
        }

        const docTopics = Array.isArray(userDoc.topics) ? userDoc.topics : [];
        const sharedTopics = Array.from(
          new Set(
            docTopics
              .map((topic) => (typeof topic === "string" ? topic.toLowerCase() : topic))
              .filter((topic) => normalizedViewerTopics.includes(topic))
          )
        );

        if (!sharedTopics.length) {
          return;
        }

        const score = 300 + sharedTopics.length * 25;
        candidateMap.set(id, {
          userDoc,
          score,
          sharedTopics,
        });
      });
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

    const fallbackRanking = [];

    followerAggregation.forEach((entry, index) => {
      const id = entry?._id ? entry._id.toString() : null;
      if (!id) {
        return;
      }
      if (viewerFollowing.has(id)) {
        return;
      }
      if (viewerIdString && id === viewerIdString) {
        return;
      }

      const boost = Math.max(10, 120 - index * 10);

      if (candidateMap.has(id)) {
        const current = candidateMap.get(id);
        current.score += boost;
        candidateMap.set(id, current);
      } else {
        fallbackRanking.push({ id, score: 200 + boost });
      }
    });

    if (fallbackRanking.length) {
      const fallbackDocs = await User.find({
        _id: { $in: fallbackRanking.map((entry) => entry.id) },
      })
        .select(PUBLIC_USER_PROJECTION)
        .lean();

      const fallbackMap = new Map(
        fallbackDocs.map((doc) => [doc._id?.toString(), doc])
      );

      fallbackRanking.forEach(({ id, score }) => {
        if (candidateMap.has(id)) {
          return;
        }
        const userDoc = fallbackMap.get(id);
        if (!userDoc) {
          return;
        }
        candidateMap.set(id, {
          userDoc,
          score,
          sharedTopics: [],
        });
      });
    }

    if (candidateMap.size < limit) {
      const fallbackUsers = await User.find({
        ...(viewerId ? { _id: { $ne: viewerId } } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(limit * 6)
        .select(PUBLIC_USER_PROJECTION)
        .lean();

      fallbackUsers.forEach((userDoc, index) => {
        const id = userDoc?._id?.toString();
        if (!id) {
          return;
        }
        if (viewerFollowing.has(id)) {
          return;
        }
        if (candidateMap.has(id)) {
          return;
        }
        candidateMap.set(id, {
          userDoc,
          score: 80 - index,
          sharedTopics: [],
        });
      });
    }

    if (!candidateMap.size) {
      return res.json({ suggestions: [] });
    }

    const rankedCandidates = Array.from(candidateMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    const payload = await Promise.all(
      rankedCandidates.map(async ({ userDoc, sharedTopics }) => {
        const sanitized = sanitizePublicUser(userDoc);
        const stats = await getFollowStatsForUser(userDoc._id);
        const normalizedSharedTopics = Array.from(
          new Set((sharedTopics || []).map((topic) => topic.toString()))
        ).slice(0, 4);

        return {
          user: sanitized,
          stats,
          isFollowing: viewerFollowing.has(sanitized.id),
          sharedTopics: normalizedSharedTopics,
        };
      })
    );

    res.json({ suggestions: payload });
  } catch (error) {
    res.status(500).json({ error: "Unable to load suggestions" });
  }
};

export const getPremiumUsers = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 3, 1), 10);

    const premiumUsers = await User.find({ membershipStatus: true })
      .select(PUBLIC_USER_PROJECTION)
      .lean();

    if (!premiumUsers.length) {
      return res.json({ premiumUsers: [] });
    }

    const shuffled = premiumUsers.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, limit);

    const payload = await Promise.all(
      selected.map(async (userDoc) => {
        const sanitized = sanitizePublicUser(userDoc);
        const stats = await getFollowStatsForUser(userDoc._id);

        const topPost = await Post.findOne({
          author: userDoc._id,
          isPublished: true,
        })
          .sort({ clapCount: -1, responseCount: -1, publishedAt: -1 })
          .select("title subtitle slug clapCount responseCount publishedAt")
          .lean();

        return {
          user: sanitized,
          stats,
          highlight: topPost
            ? {
                title: topPost.title,
                subtitle: topPost.subtitle,
                slug: topPost.slug,
                clapCount: topPost.clapCount ?? 0,
                responseCount: topPost.responseCount ?? 0,
                publishedAt: topPost.publishedAt,
              }
            : null,
        };
      })
    );

    res.json({ premiumUsers: payload });
  } catch (error) {
    res.status(500).json({ error: "Unable to load premium users" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    const query = req.query.q?.trim();
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);

    if (!query) {
      return res.json({ users: [] });
    }

    const searchRegex = new RegExp(query, "i");
    const users = await User.find({
      $or: [
        { username: searchRegex },
        { name: searchRegex },
      ],
    })
      .select(PUBLIC_USER_PROJECTION)
      .limit(limit)
      .lean();

    const payload = users.map((userDoc) => sanitizePublicUser(userDoc));

    res.json({ users: payload });
  } catch (error) {
    res.status(500).json({ error: "Unable to search users" });
  }
};