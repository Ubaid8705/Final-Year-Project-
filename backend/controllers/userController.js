import User from "../models/User.js";
import {
  RELATIONSHIP_STATUS,
  getFollowStatsForUser,
  getRelationshipBetween,
  removeAllRelationshipsForUser,
} from "../services/relationshipService.js";

const OWN_USER_PROJECTION =
  "username name email avatar bio pronouns hasSubdomain customDomainState membershipStatus createdAt updatedAt";
const PUBLIC_USER_PROJECTION =
  "username name avatar bio pronouns membershipStatus createdAt updatedAt";

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
      "hasSubdomain",
      "customDomainState",
    ];

    const updates = Object.keys(req.body)
      .filter((key) => allowedUpdates.includes(key))
      .reduce((obj, key) => {
        obj[key] = req.body[key];
        return obj;
      }, {});

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