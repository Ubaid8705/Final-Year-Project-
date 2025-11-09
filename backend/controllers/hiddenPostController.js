import mongoose from "mongoose";
import HiddenPost from "../models/HiddenPost.js";
import Post from "../models/Post.js";

const isObjectId = (value = "") => mongoose.Types.ObjectId.isValid(value);

export const hidePost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!isObjectId(postId)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const postExists = await Post.exists({ _id: postId, isPublished: true });
    if (!postExists) {
      return res.status(404).json({ error: "Post not found" });
    }

    const result = await HiddenPost.updateOne(
      { user: req.user._id, post: postId },
      { $setOnInsert: { hiddenAt: new Date() } },
      { upsert: true }
    );

    const created =
      (typeof result.upsertedCount === "number" && result.upsertedCount > 0) ||
      (Array.isArray(result.upserted) && result.upserted.length > 0);

    res.status(created ? 201 : 200).json({ hidden: true, postId });
  } catch (error) {
    res.status(500).json({ error: "Failed to hide post" });
  }
};

export const unhidePost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!isObjectId(postId)) {
      return res.status(400).json({ error: "Invalid post id" });
    }

    const result = await HiddenPost.findOneAndDelete({
      user: req.user._id,
      post: postId,
    }).lean();

    if (!result) {
      return res.status(404).json({ error: "Hidden post not found" });
    }

    res.json({ hidden: false, postId });
  } catch (error) {
    res.status(500).json({ error: "Failed to unhide post" });
  }
};
