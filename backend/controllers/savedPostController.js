import mongoose from "mongoose";
import SavedPost from "../models/SavedPost.js";
import Post from "../models/Post.js";
import { hydratePost } from "./postController.js";

const isObjectId = (value = "") => mongoose.Types.ObjectId.isValid(value);

export const listSavedPosts = async (req, res) => {
  try {
    const savedItems = await SavedPost.find({ user: req.user._id })
      .sort({ savedAt: -1 })
      .populate({
        path: "post",
        populate: { path: "author", select: "username name avatar bio membershipStatus" },
      })
      .lean();

    const items = savedItems
      .filter((entry) => Boolean(entry.post))
      .map((entry) => ({
        id: entry._id,
        savedAt: entry.savedAt,
        post: hydratePost(entry.post),
      }));

    res.json({ items });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch saved posts" });
  }
};

export const savePost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!isObjectId(postId)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const postDoc = await Post.findById(postId).populate(
      "author",
      "username name avatar bio membershipStatus"
    );

    if (!postDoc) {
      return res.status(404).json({ error: "Post not found" });
    }

    let saved = await SavedPost.findOne({ user: req.user._id, post: postId });
    if (saved) {
      return res.json({
        saved: true,
        savedAt: saved.savedAt,
        post: hydratePost(postDoc),
      });
    }

    saved = await SavedPost.create({ user: req.user._id, post: postId });

    res.status(201).json({
      saved: true,
      savedAt: saved.savedAt,
      post: hydratePost(postDoc),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to save post" });
  }
};

export const removeSavedPost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!isObjectId(postId)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const deleted = await SavedPost.findOneAndDelete({
      user: req.user._id,
      post: postId,
    });

    if (!deleted) {
      return res.status(404).json({ error: "Saved post not found" });
    }

    res.json({ removed: true, postId });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove saved post" });
  }
};
