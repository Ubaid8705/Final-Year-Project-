import express from "express";
import {
  getCurrentUser,
  updateUser,
  deleteUser,
  getUserByUsername,
  updateTopics,
  getSuggestedUsers,
} from "../controllers/userController.js";
import {
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  listFollowers,
  listFollowing,
  getFollowStats,
  getMyFollowStats,
  getRelationshipStatus,
  listBlockedUsers,
} from "../controllers/relationshipController.js";
import { authenticate, optionalAuthenticate } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/me", authenticate, getCurrentUser);
router.get("/me/follow-stats", authenticate, getMyFollowStats);
router.get("/me/blocked", authenticate, listBlockedUsers);
router.put("/update", authenticate, updateUser);
router.put("/me/topics", authenticate, updateTopics);
router.delete("/delete", authenticate, deleteUser);
router.get("/suggestions", optionalAuthenticate, getSuggestedUsers);

router.post("/:username/follow", authenticate, followUser);
router.delete("/:username/follow", authenticate, unfollowUser);
router.post("/:username/block", authenticate, blockUser);
router.delete("/:username/block", authenticate, unblockUser);
router.get("/:username/relationship", authenticate, getRelationshipStatus);

router.get("/:username/followers", optionalAuthenticate, listFollowers);
router.get("/:username/following", optionalAuthenticate, listFollowing);
router.get("/:username/follow-stats", optionalAuthenticate, getFollowStats);

router.get("/:username", optionalAuthenticate, getUserByUsername);

export default router;