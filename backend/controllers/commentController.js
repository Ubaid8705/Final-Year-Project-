import mongoose from "mongoose";
import Comment from "../models/Comments.js";
import Post from "../models/Post.js";
import { safeCreateNotification } from "../services/notificationService.js";

const toObjectId = (value) => {
  if (mongoose.Types.ObjectId.isValid(value)) {
    return new mongoose.Types.ObjectId(value);
  }
  return null;
};

const buildCommentResponse = (comment) => ({
  id: comment._id,
  postId: comment.postId,
  parentCommentId: comment.parentCommentId,
  content: comment.content,
  likesCount: comment.likesCount,
  isVisible: comment.isVisible,
  createdAt: comment.createdAt,
  updatedAt: comment.updatedAt,
  author: comment.userId && {
    id: comment.userId._id,
    username: comment.userId.username,
    name: comment.userId.name,
    avatar: comment.userId.avatar,
  },
});

const buildThread = (comments) => {
  const lookup = new Map();
  const roots = [];

  comments.forEach((comment) => {
    lookup.set(comment._id.toString(), { ...buildCommentResponse(comment), replies: [] });
  });

  comments.forEach((comment) => {
    const parentId = comment.parentCommentId?.toString();
    const node = lookup.get(comment._id.toString());

    if (parentId && lookup.has(parentId)) {
      lookup.get(parentId).replies.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
};

const refreshResponseCount = async (postId) => {
  const visibleCount = await Comment.countDocuments({ postId, isVisible: true });
  await Post.findByIdAndUpdate(postId, { responseCount: visibleCount });
};

export const getComments = async (req, res) => {
  try {
    const { postId } = req.query;
    const objectId = toObjectId(postId);

    if (!objectId) {
      return res.status(400).json({ error: "Invalid or missing postId" });
    }

    const comments = await Comment.find({ postId: objectId, isVisible: true })
      .sort({ createdAt: 1 })
      .populate("userId", "username name avatar")
      .lean();

    res.json({ items: buildThread(comments) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
};

export const createComment = async (req, res) => {
  try {
    const { postId, content, parentCommentId } = req.body;
    const postObjectId = toObjectId(postId);

    if (!postObjectId) {
      return res.status(400).json({ error: "Invalid postId" });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    const parentId = parentCommentId ? toObjectId(parentCommentId) : null;

    const post = await Post.findById(postObjectId).select("author title slug").lean();

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const comment = await Comment.create({
      postId: postObjectId,
      userId: req.user._id,
      content: content.trim(),
      parentCommentId: parentId,
    });

    await refreshResponseCount(postObjectId);
    await comment.populate("userId", "username name avatar");

    const actorName = req.user.name || req.user.username || "Someone";
    const metadata = {
      postId: post._id.toString(),
      postSlug: post.slug,
      commentId: comment._id.toString(),
      excerpt: comment.content.slice(0, 160),
    };

    if (post.author && post.author.toString() !== req.user._id.toString()) {
      await safeCreateNotification({
        recipient: post.author,
        sender: req.user._id,
        type: "comment",
        post: post._id,
        message: `${actorName} commented on "${post.title}"`,
        metadata,
      });
    }

    if (parentId) {
      const parent = await Comment.findById(parentId).select("userId").lean();

      if (
        parent?.userId &&
        parent.userId.toString() !== req.user._id.toString() &&
        parent.userId.toString() !== post.author?.toString()
      ) {
        await safeCreateNotification({
          recipient: parent.userId,
          sender: req.user._id,
          type: "reply",
          post: post._id,
          message: `${actorName} replied to your comment on "${post.title}"`,
          metadata: { ...metadata, parentCommentId: parentId.toString() },
        });
      }
    }

    res.status(201).json(buildCommentResponse(comment));
  } catch (error) {
    res.status(500).json({ error: "Failed to create comment" });
  }
};

export const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = toObjectId(id);

    if (!objectId) {
      return res.status(400).json({ error: "Invalid comment id" });
    }

    const comment = await Comment.findById(objectId);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to edit this comment" });
    }

    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Content is required" });
    }

    comment.content = content.trim();
    await comment.save();
    await comment.populate("userId", "username name avatar");

    res.json(buildCommentResponse(comment));
  } catch (error) {
    res.status(500).json({ error: "Failed to update comment" });
  }
};

export const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    const objectId = toObjectId(id);

    if (!objectId) {
      return res.status(400).json({ error: "Invalid comment id" });
    }

    const comment = await Comment.findById(objectId);

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this comment" });
    }

    await Comment.findByIdAndDelete(objectId);
    await refreshResponseCount(comment.postId);

    res.json({ message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete comment" });
  }
};
