import mongoose from "mongoose";
import Post from "../models/Post.js";
import Comment from "../models/Comments.js";
import User from "../models/User.js";
import slugify from "../utils/slugify.js";
import { countWords, estimateReadingTime } from "../utils/postMetrics.js";

const isObjectId = (value = "") => mongoose.Types.ObjectId.isValid(value);

const ensureUniqueSlug = async (baseTitle, excludeId = null) => {
  const baseSlug = slugify(baseTitle) || slugify(Date.now().toString());
  let candidate = baseSlug;
  let suffix = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await Post.findOne({
      slug: candidate,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select("_id");

    if (!existing) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
};

const hydratePost = (postDoc) => {
  if (!postDoc) return null;
  const post = postDoc.toObject ? postDoc.toObject({ virtuals: true }) : postDoc;

  return {
    id: post._id,
    title: post.title,
    subtitle: post.subtitle,
    slug: post.slug,
    coverImage: post.coverImage,
    tags: post.tags,
    readingTime: post.readingTime,
    wordCount: post.wordCount,
    clapCount: post.clapCount,
    responseCount: post.responseCount,
    allowResponses: post.allowResponses,
    isPublished: post.isPublished,
    isLocked: post.isLocked,
    visibility: post.visibility,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    content: post.content,
    author: post.author && {
      id: post.author._id,
      username: post.author.username,
      name: post.author.name,
      avatar: post.author.avatar,
      bio: post.author.bio,
    },
  };
};

export const listPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      tag,
      status = "published",
      author,
      sort = "recent",
    } = req.query;

    const numericLimit = Math.min(Number(limit) || 10, 50);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * numericLimit;

    const filter = {};
    if (status === "published") {
      filter.isPublished = true;
    } else if (status === "draft") {
      filter.isPublished = false;
      filter.author = req.user?._id;
    }

    if (tag) {
      filter.tags = tag.toLowerCase();
    }

    if (author) {
      const user = await User.findOne({ username: author }).select("_id");
      if (!user) {
        return res.json({ items: [], pagination: { total: 0, page: Number(page) || 1 } });
      }
      filter.author = user._id;
    }

    const sortOption =
      sort === "popular"
        ? { clapCount: -1, responseCount: -1, publishedAt: -1 }
        : { publishedAt: -1, updatedAt: -1 };

    const [items, total] = await Promise.all([
      Post.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(numericLimit)
        .populate("author", "username name avatar bio")
        .lean(),
      Post.countDocuments(filter),
    ]);

    res.json({
      items: items.map(hydratePost),
      pagination: {
        total,
        page: Number(page) || 1,
        limit: numericLimit,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch posts" });
  }
};

const findPostByParam = async (param) => {
  if (isObjectId(param)) {
    const post = await Post.findById(param)
      .populate("author", "username name avatar bio pronouns")
      .lean();
    if (post) return post;
  }

  return Post.findOne({ slug: param })
    .populate("author", "username name avatar bio pronouns")
    .lean();
};

export const getPost = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const post = await findPostByParam(idOrSlug);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json(hydratePost(post));
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch post" });
  }
};

export const createPost = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      content = [],
      tags = [],
      coverImage,
      allowResponses = true,
      isPublished = false,
      visibility = "PUBLIC",
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const wordCount = countWords(content);
    const readingTime = estimateReadingTime(wordCount);
    const slug = await ensureUniqueSlug(title);

    const post = await Post.create({
      author: req.user._id,
      title,
      subtitle,
      content,
      tags,
      coverImage,
      allowResponses,
      isPublished,
      visibility,
      slug,
      wordCount,
      readingTime,
      publishedAt: isPublished ? new Date() : null,
    });

    await post.populate("author", "username name avatar bio");

    res.status(201).json(hydratePost(post));
  } catch (error) {
    res.status(500).json({ error: "Failed to create post" });
  }
};

export const updatePost = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const post = await findPostByParam(idOrSlug);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!req.user || post.author._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to edit this post" });
    }

    const updates = {};
    const allowed = [
      "title",
      "subtitle",
      "content",
      "tags",
      "coverImage",
      "allowResponses",
      "isPublished",
      "visibility",
    ];

    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (allowed.includes(key)) {
        updates[key] = value;
      }
    });

    if (updates.title) {
      updates.slug = await ensureUniqueSlug(updates.title, post._id);
    }

    if (updates.content) {
      const wordCount = countWords(updates.content);
      updates.wordCount = wordCount;
      updates.readingTime = estimateReadingTime(wordCount);
    }

    if (typeof updates.isPublished === "boolean") {
      updates.publishedAt = updates.isPublished
        ? post.publishedAt || new Date()
        : null;
    }

    const updated = await Post.findByIdAndUpdate(post._id, updates, {
      new: true,
      runValidators: true,
    }).populate("author", "username name avatar bio");

    res.json(hydratePost(updated));
  } catch (error) {
    res.status(500).json({ error: "Failed to update post" });
  }
};

export const deletePost = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const post = await findPostByParam(idOrSlug);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (!req.user || post.author._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: "Not authorized to delete this post" });
    }

    await Promise.all([
      Post.findByIdAndDelete(post._id),
      Comment.deleteMany({ postId: post._id }),
    ]);

    res.json({ message: "Post deleted" });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete post" });
  }
};

export const clapPost = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const post = await findPostByParam(idOrSlug);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const updated = await Post.findByIdAndUpdate(
      post._id,
      { $inc: { clapCount: 1 } },
      { new: true }
    );

    res.json({ clapCount: updated.clapCount });
  } catch (error) {
    res.status(500).json({ error: "Failed to clap post" });
  }
};

export const listAuthorPosts = async (req, res) => {
  try {
    const { username } = req.params;
    const user = await User.findOne({ username }).select("_id username name avatar bio");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const posts = await Post.find({ author: user._id, isPublished: true })
      .sort({ publishedAt: -1 })
      .populate("author", "username name avatar bio")
      .lean();

    res.json({
      author: {
        id: user._id,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
      },
      posts: posts.map(hydratePost),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch author posts" });
  }
};

export const listDrafts = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const drafts = await Post.find({ author: req.user._id, isPublished: false })
      .sort({ updatedAt: -1 })
      .populate("author", "username name avatar bio")
      .lean();

    res.json({ items: drafts.map(hydratePost) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch drafts" });
  }
};
