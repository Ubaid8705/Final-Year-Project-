import mongoose from "mongoose";
import Comment from "../models/Comments.js";
import Post from "../models/Post.js";
import User from "../models/User.js";
import { safeCreateNotification } from "../services/notificationService.js";
import { normalizeObjectId, objectIdToString } from "../utils/objectId.js";

const toObjectId = (value) => {
  return normalizeObjectId(value);
};

const MENTION_PATTERN = /@([a-z0-9_]{2,30})/gi;

const extractMentionedUsernames = (text = "") => {
  if (typeof text !== "string" || !text.includes("@")) {
    return new Set();
  }

  const mentions = new Set();
  let match;

  while ((match = MENTION_PATTERN.exec(text)) !== null) {
    const username = match[1]?.trim();
    if (!username) {
      continue;
    }
    mentions.add(username);
  }

  return mentions;
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

    const actorId = normalizeObjectId(req.user?._id);
    const actorIdString = objectIdToString(actorId);
    const postAuthorId = normalizeObjectId(post.author);
    const postAuthorIdString = objectIdToString(postAuthorId);
    const postIdString = objectIdToString(post._id) || post._id?.toString();

  const comment = await Comment.create({
      postId: postObjectId,
      userId: req.user._id,
      content: content.trim(),
      parentCommentId: parentId,
    });

    await refreshResponseCount(postObjectId);
    await comment.populate("userId", "username name avatar");

    const actorName = req.user.name || req.user.username || "Someone";
    const notifiedRecipients = new Set();
    const metadata = {
      ...(postIdString ? { postId: postIdString } : {}),
      postSlug: post.slug,
      commentId: comment._id.toString(),
      excerpt: comment.content.slice(0, 160),
    };

    if (postAuthorIdString && actorIdString && postAuthorIdString !== actorIdString) {
      await safeCreateNotification({
        recipient: postAuthorId,
        sender: actorId,
        type: "comment",
        post: post._id,
        message: `${actorName} commented on "${post.title}"`,
        metadata,
      });
      notifiedRecipients.add(postAuthorIdString);
    }

    let parentAuthorId = null;
    let parentAuthorIdString = null;
    if (parentId) {
      const parent = await Comment.findById(parentId).select("userId").lean();

      parentAuthorId = normalizeObjectId(parent?.userId);
      parentAuthorIdString = objectIdToString(parentAuthorId);

      if (
        parentAuthorIdString &&
        actorIdString &&
        parentAuthorIdString !== actorIdString &&
        parentAuthorIdString !== postAuthorIdString
      ) {
        await safeCreateNotification({
          recipient: parentAuthorId,
          sender: actorId,
          type: "reply",
          post: post._id,
          message: `${actorName} replied to your comment on "${post.title}"`,
          metadata: { ...metadata, parentCommentId: parentId.toString() },
        });
        notifiedRecipients.add(parentAuthorIdString);
      }
    }

    const mentionUsernames = extractMentionedUsernames(comment.content);

    if (mentionUsernames.size > 0) {
      const mentionList = Array.from(mentionUsernames);
      const mentionedUsers = await User.find({ username: { $in: mentionList } })
        .select("_id username name")
        .lean();

      for (const mentioned of mentionedUsers) {
        const mentionId = normalizeObjectId(mentioned?._id);
        const mentionIdString = objectIdToString(mentionId);

        if (!mentionIdString || mentionIdString === actorIdString) {
          continue;
        }

        if (
          notifiedRecipients.has(mentionIdString) ||
          mentionIdString === postAuthorIdString ||
          mentionIdString === parentAuthorIdString
        ) {
          continue;
        }

        await safeCreateNotification({
          recipient: mentionId,
          sender: actorId,
          type: "mention",
          post: post._id,
          message: `${actorName} mentioned you in a comment on "${post.title}"`,
          metadata: { ...metadata, mentionedUsername: mentioned.username },
        });

        notifiedRecipients.add(mentionIdString);
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
