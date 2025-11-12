import mongoose from "mongoose";
import Post from "../models/Post.js";
import Comment from "../models/Comments.js";
import User from "../models/User.js";
import Relationship from "../models/Relationship.js";
import HiddenPost from "../models/HiddenPost.js";
import PostReport from "../models/PostReport.js";
import UserSettings from "../models/Settings.js";
import slugify from "../utils/slugify.js";
import { countWords, estimateReadingTime } from "../utils/postMetrics.js";
import { safeCreateNotification } from "../services/notificationService.js";
import { normalizeObjectId, objectIdToString } from "../utils/objectId.js";
import {
  RELATIONSHIP_STATUS,
  getRelationshipBetween,
} from "../services/relationshipService.js";
import { sendPostPublicationEmail } from "../services/emailService.js";

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

const VALID_VISIBILITY_VALUES = ["PUBLIC", "UNLISTED", "PRIVATE"];
const RESPONSE_MODE_VALUES = ["EVERYONE", "FOLLOWERS", "DISABLED"];

const toVisibilityToken = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (VALID_VISIBILITY_VALUES.includes(normalized)) {
    return normalized;
  }

  return null;
};

const toVisibilityLabel = (value) => {
  const token = toVisibilityToken(value) || "PUBLIC";
  switch (token) {
    case "PRIVATE":
      return "Private";
    case "UNLISTED":
      return "Unlisted";
    default:
      return "Public";
  }
};

const mapCommentSettingToResponse = (value) => {
  const normalized = (value || "").toString().trim().toLowerCase();
  if (normalized === "followers only") {
    return "FOLLOWERS";
  }
  if (normalized === "disabled") {
    return "DISABLED";
  }
  return "EVERYONE";
};

const mapResponseModeToSetting = (mode) => {
  switch ((mode || "").toString().toUpperCase()) {
    case "FOLLOWERS":
      return "Followers only";
    case "DISABLED":
      return "Disabled";
    default:
      return "Everyone";
  }
};

const CODE_LANGUAGE_ALIASES = {
  plaintext: "plaintext",
  text: "plaintext",
  plain: "plaintext",
  none: "plaintext",
  javascript: "javascript",
  js: "javascript",
  typescript: "typescript",
  ts: "typescript",
  python: "python",
  py: "python",
  java: "java",
  ruby: "ruby",
  rb: "ruby",
  go: "go",
  golang: "go",
  php: "php",
  xml: "xml",
  html: "xml",
  css: "css",
  json: "json",
  bash: "bash",
  shell: "bash",
  sh: "bash",
  c: "c",
  "c-lang": "c",
  cpp: "cpp",
  "c++": "cpp",
  cplusplus: "cpp",
};

const normalizeCodeLanguageToken = (value) => {
  if (!value) {
    return null;
  }

  const normalized = value.toString().trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (CODE_LANGUAGE_ALIASES[normalized]) {
    return CODE_LANGUAGE_ALIASES[normalized];
  }

  return null;
};

const normalizeVisibility = (value, fallback = "PUBLIC") => {
  return toVisibilityToken(value) || toVisibilityToken(fallback) || "PUBLIC";
};

const determineResponseMode = (body = {}, fallback = "EVERYONE") => {
  const { responseMode, commentSetting, allowResponses } = body;

  if (typeof responseMode === "string") {
    const normalized = responseMode.trim().toUpperCase();
    if (RESPONSE_MODE_VALUES.includes(normalized)) {
      return normalized;
    }
  }

  if (typeof commentSetting === "string") {
    return mapCommentSettingToResponse(commentSetting);
  }

  if (typeof allowResponses === "boolean") {
    return allowResponses ? "EVERYONE" : "DISABLED";
  }

  return RESPONSE_MODE_VALUES.includes((fallback || "").toUpperCase())
    ? fallback
    : "EVERYONE";
};

const normalizeDistributionMode = (body = {}, fallback = "AUTO_EMAIL") => {
  const { distributionMode, sendEmails } = body;

  if (typeof distributionMode === "string") {
    const normalized = distributionMode.trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (normalized === "AUTO_EMAIL" || normalized === "PROMPT") {
      return normalized;
    }
  }

  if (typeof sendEmails === "boolean") {
    return sendEmails ? "AUTO_EMAIL" : "PROMPT";
  }

  const normalizedFallback = (fallback || "AUTO_EMAIL").toString().trim().toUpperCase();
  return normalizedFallback === "PROMPT" ? "PROMPT" : "AUTO_EMAIL";
};

const defaultSnapshotFromSettings = (settings) => {
  if (!settings) {
    return {
      visibility: "Public",
      commentSetting: "Everyone",
      sendEmails: true,
    };
  }

  return {
    visibility: settings.visibility || "Public",
    commentSetting: settings.commentSetting || "Everyone",
    sendEmails: typeof settings.sendEmails === "boolean" ? settings.sendEmails : true,
  };
};

const OVERRIDE_KEYS = [
  "visibility",
  "responseMode",
  "commentSetting",
  "allowResponses",
  "distributionMode",
  "sendEmails",
];

const hasSettingOverrides = (body = {}) =>
  OVERRIDE_KEYS.some((key) => Object.prototype.hasOwnProperty.call(body, key));

const mapDistributionToSendEmails = (distributionMode) =>
  (distributionMode || "AUTO_EMAIL").toUpperCase() === "AUTO_EMAIL";

const toTrimmedString = (value) => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toFiniteNumber = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeImageAsset = (image = {}) => {
  if (!image || typeof image !== "object") {
    return null;
  }

  const normalized = {};

  const assignString = (key, sourceKey = key) => {
    const value = toTrimmedString(image[sourceKey]);
    if (value) {
      normalized[key] = value;
    }
  };

  assignString("url");
  assignString("displayUrl");
  assignString("originalUrl");
  assignString("thumbnailUrl");
  assignString("placeholderUrl");
  assignString("publicId");
  assignString("alt");
  assignString("caption");

  const width = toFiniteNumber(image.width);
  if (width !== null) {
    normalized.width = width;
  }

  const height = toFiniteNumber(image.height);
  if (height !== null) {
    normalized.height = height;
  }

  const aspectRatio = toFiniteNumber(image.aspectRatio);
  if (aspectRatio !== null) {
    normalized.aspectRatio = aspectRatio;
  } else if (width && height) {
    normalized.aspectRatio = Number((width / height).toFixed(4));
  }

  if (!normalized.url && normalized.displayUrl) {
    normalized.url = normalized.displayUrl;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const normalizeCoverImageMeta = (meta = {}) => {
  if (!meta || typeof meta !== "object") {
    return null;
  }

  const base = normalizeImageAsset(meta) || {};

  const format = toTrimmedString(meta.format);
  if (format) {
    base.format = format;
  }

  const bytes = toFiniteNumber(meta.bytes);
  if (bytes !== null) {
    base.bytes = bytes;
  }

  const uploadedAtCandidate = meta.uploadedAt || meta.uploaded_at;
  if (uploadedAtCandidate) {
    const uploadDate = new Date(uploadedAtCandidate);
    if (!Number.isNaN(uploadDate.getTime())) {
      base.uploadedAt = uploadDate;
    }
  }

  return Object.keys(base).length > 0 ? base : null;
};

const normalizeContentBlocks = (blocks = []) => {
  if (!Array.isArray(blocks)) {
    return [];
  }

  return blocks
    .map((block) => {
      if (!block || typeof block !== "object") {
        return null;
      }

      const type = typeof block.type === "string" ? block.type.trim().toUpperCase() : null;
      const normalizedBlock = {
        ...block,
        ...(type ? { type } : {}),
      };

      if (type === "CODE") {
        const normalizedLanguage = normalizeCodeLanguageToken(
          block.codeLanguage || block.language
        );

        if (normalizedLanguage) {
          normalizedBlock.codeLanguage = normalizedLanguage;
          normalizedBlock.language = normalizedLanguage;
        } else {
          delete normalizedBlock.codeLanguage;
          delete normalizedBlock.language;
        }

        if (typeof normalizedBlock.codeBlock === "string") {
          normalizedBlock.codeBlock = normalizedBlock.codeBlock.replace(/\r\n?/g, "\n");
        }
      }

      if (block.image) {
        const normalizedImage = normalizeImageAsset(block.image);
        if (normalizedImage) {
          normalizedBlock.image = normalizedImage;
        } else {
          delete normalizedBlock.image;
        }
      }

      return normalizedBlock;
    })
    .filter(Boolean);
};

const buildPostPermalink = (postDoc) => {
  const base = (process.env.CLIENT_URL || "http://localhost:3000").toString().trim();
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;

  const slugValue = typeof postDoc?.slug === "string" ? postDoc.slug.trim() : "";
  if (slugValue) {
    return `${normalizedBase}/post/${slugValue}`;
  }

  const identifierCandidate =
    (postDoc?._id && typeof postDoc._id.toString === "function"
      ? postDoc._id.toString()
      : postDoc?._id) ||
    (postDoc?.id && typeof postDoc.id.toString === "function"
      ? postDoc.id.toString()
      : postDoc?.id);

  if (!identifierCandidate) {
    return null;
  }

  return `${normalizedBase}/post/${identifierCandidate}`;
};

const extractFirstTextualContent = (content = []) => {
  if (!Array.isArray(content)) {
    return "";
  }

  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }

    if (typeof block.text === "string" && block.text.trim()) {
      return block.text.trim();
    }

    if (Array.isArray(block.items)) {
      const item = block.items.find(
        (entry) => entry && typeof entry.text === "string" && entry.text.trim()
      );
      if (item) {
        return item.text.trim();
      }
    }

    if (
      typeof block.codeBlock === "string" &&
      block.codeBlock.trim()
    ) {
      return block.codeBlock
        .trim()
        .split("\n")
        .slice(0, 3)
        .join(" ");
    }
  }

  return "";
};

const derivePostPreview = (postDoc) => {
  if (!postDoc) {
    return "";
  }

  const subtitle = typeof postDoc.subtitle === "string" ? postDoc.subtitle.trim() : "";
  if (subtitle) {
    return subtitle;
  }

  const preview = extractFirstTextualContent(postDoc.content);
  return preview || "";
};

const collectFollowerEmails = async (authorId) => {
  if (!authorId) {
    return [];
  }

  const relationships = await Relationship.find({
    following: authorId,
    status: "following",
  })
    .select("follower")
    .lean();

  if (!relationships.length) {
    return [];
  }

  const followerIds = relationships
    .map((entry) => entry.follower)
    .filter(Boolean)
    .map((value) => (value && typeof value.toString === "function" ? value.toString() : value));

  if (!followerIds.length) {
    return [];
  }

  const uniqueFollowerIds = [...new Set(followerIds)];

  const followers = await User.find({ _id: { $in: uniqueFollowerIds } })
    .select("email")
    .lean();

  return followers
    .map((user) => (user.email || "").toString().trim().toLowerCase())
    .filter(Boolean);
};

const dispatchPostPublicationEmail = async (postDoc, authorSettings = {}) => {
  if (!postDoc?.author?._id) {
    return;
  }

  const recipients = await collectFollowerEmails(postDoc.author._id);
  if (!recipients.length) {
    return;
  }

  const postUrl = buildPostPermalink(postDoc);
  if (!postUrl) {
    return;
  }

  const preview = derivePostPreview(postDoc);
  const signature =
    (typeof authorSettings.signature === "string" && authorSettings.signature.trim()) ||
    "Thank you for reading!";

  const displayName =
    (typeof authorSettings.displayName === "string" && authorSettings.displayName.trim()) ||
    (typeof postDoc.author.name === "string" && postDoc.author.name.trim()) ||
    (typeof postDoc.author.username === "string" && postDoc.author.username.trim()) ||
    "A BlogsHive creator";

  await sendPostPublicationEmail({
    recipients,
    author: {
      displayName,
      name: postDoc.author.name,
      username: postDoc.author.username,
    },
    post: {
      title: postDoc.title,
      url: postUrl,
      subtitle: postDoc.subtitle,
    },
    preview,
    signature,
  });
};

const resolveCoverImageValue = (coverImage, coverMeta) => {
  const sanitizedCover = toTrimmedString(coverImage);
  if (sanitizedCover) {
    return sanitizedCover;
  }

  if (coverMeta?.displayUrl) {
    return coverMeta.displayUrl;
  }

  if (coverMeta?.url) {
    return coverMeta.url;
  }

  if (coverMeta?.originalUrl) {
    return coverMeta.originalUrl;
  }

  return null;
};

export const hydratePost = (postDoc) => {
  if (!postDoc) return null;
  const post = postDoc.toObject ? postDoc.toObject({ virtuals: true }) : postDoc;

  const normalizedContent = Array.isArray(post.content)
    ? post.content.map((block) => {
        if (!block || typeof block !== "object") {
          return block;
        }

        const type = (block.type || "").toString().toUpperCase();
        if (type !== "CODE") {
          return block;
        }

        const normalizedLanguage = normalizeCodeLanguageToken(
          block.codeLanguage || block.language
        );

        const next = { ...block };

        if (normalizedLanguage) {
          next.codeLanguage = normalizedLanguage;
          next.language = normalizedLanguage;
        } else {
          delete next.codeLanguage;
          delete next.language;
        }

        return next;
      })
    : post.content;

  const responseMode = RESPONSE_MODE_VALUES.includes((post.responseMode || "").toUpperCase())
    ? post.responseMode.toUpperCase()
    : post.allowResponses === false
    ? "DISABLED"
    : "EVERYONE";

  const distributionMode = (post.distributionMode || "")
    .toString()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

  const normalizedDistribution =
    distributionMode === "PROMPT" || distributionMode === "AUTO_EMAIL"
      ? distributionMode
      : mapDistributionToSendEmails(post.settingsSnapshot?.sendEmails)
      ? "AUTO_EMAIL"
      : "PROMPT";

  const snapshot = {
    visibility: post.settingsSnapshot?.visibility || toVisibilityLabel(post.visibility),
    commentSetting: post.settingsSnapshot?.commentSetting || mapResponseModeToSetting(responseMode),
    sendEmails:
      typeof post.settingsSnapshot?.sendEmails === "boolean"
        ? post.settingsSnapshot.sendEmails
        : mapDistributionToSendEmails(normalizedDistribution),
  };

  const normalizedVisibility = normalizeVisibility(post.visibility, snapshot.visibility);
  const allowResponses = responseMode !== "DISABLED";
  const defaultResponseMode = mapCommentSettingToResponse(snapshot.commentSetting);
  const defaultDistributionMode = snapshot.sendEmails ? "AUTO_EMAIL" : "PROMPT";
  const defaultVisibilityToken = normalizeVisibility(snapshot.visibility);

  const inheritsDefaults =
    typeof post.inheritsDefaults === "boolean"
      ? post.inheritsDefaults
      : normalizedVisibility === defaultVisibilityToken &&
        responseMode === defaultResponseMode &&
        normalizedDistribution === defaultDistributionMode;

  return {
    id: post._id,
    title: post.title,
    subtitle: post.subtitle,
    slug: post.slug,
  coverImage: post.coverImage,
  coverImageMeta: post.coverImageMeta || null,
    tags: post.tags,
    readingTime: post.readingTime,
    wordCount: post.wordCount,
    clapCount: post.clapCount,
    responseCount: post.responseCount,
    allowResponses,
    responseMode,
    distributionMode: normalizedDistribution,
    inheritsDefaults,
    settingsSnapshot: snapshot,
    visibility: normalizedVisibility,
    visibilityLabel: toVisibilityLabel(normalizedVisibility),
    commentAccess: mapResponseModeToSetting(responseMode),
    isPublished: post.isPublished,
    isLocked: post.isLocked,
    publishedAt: post.publishedAt,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    content: normalizedContent,
    author: post.author && {
      id: post.author._id,
      username: post.author.username,
      name: post.author.name,
      avatar: post.author.avatar,
      bio: post.author.bio,
      isPremium: Boolean(post.author.membershipStatus),
    },
  };
};

export const listPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status = "published",
      author,
      sort = "recent",
      scope,
    } = req.query;

    const numericLimit = Math.min(Number(limit) || 10, 50);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * numericLimit;

    const filter = {};
    const viewerId = req.user?._id;
    const hiddenPostDocs = viewerId
      ? await HiddenPost.find({ user: viewerId }).select("post").lean()
      : [];
    const hiddenPostIds = hiddenPostDocs
      .map((entry) => entry.post)
      .filter((value) => Boolean(value));
    const viewerTopics = Array.isArray(req.user?.topics)
      ? Array.from(
          new Set(
            req.user.topics
              .map((topic) => (typeof topic === "string" ? topic.trim().toLowerCase() : ""))
              .filter(Boolean)
          )
        )
      : [];
    let selectedAuthorId = null;

    if (status === "draft") {
      if (!viewerId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      filter.isPublished = false;
      filter.author = viewerId;
    } else {
      filter.isPublished = true;
    }

    const scopeToken = (scope || "forYou").toString().trim().toLowerCase();
    const resolvedScope = scopeToken === "featured" ? "featured" : "forYou";

    if (hiddenPostIds.length > 0) {
      filter._id = {
        ...(filter._id || {}),
        $nin: hiddenPostIds,
      };
    }

    if (author) {
      const user = await User.findOne({ username: author }).select("_id");
      if (!user) {
        return res.json({ items: [], pagination: { total: 0, page: Number(page) || 1 } });
      }
      filter.author = user._id;
      selectedAuthorId = user._id;
    }

    if (resolvedScope === "featured" && !filter.author) {
      if (!viewerId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const relationships = await Relationship.find({
        follower: viewerId,
        status: "following",
      }).select("following");

      const followedIds = relationships
        .map((rel) => rel.following)
        .filter(Boolean)
        .map((id) => id.toString())
        .filter((id) => id && id !== viewerId.toString());

      const uniqueIds = Array.from(new Set(followedIds));

      if (uniqueIds.length === 0) {
        return res.json({
          items: [],
          pagination: {
            total: 0,
            page: Number(page) || 1,
            limit: numericLimit,
          },
        });
      }

      filter.author = {
        $in: uniqueIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const authorMatchesViewer =
      selectedAuthorId &&
      viewerId &&
      selectedAuthorId.toString() === viewerId.toString();

    if (filter.isPublished !== false) {
      const visibilityConditions = [{ visibility: "PUBLIC" }];

      if (viewerId) {
        visibilityConditions.push({ author: viewerId });
      }

      if (!authorMatchesViewer) {
        filter.$or = visibilityConditions;
      }
    }

    const sortOption =
      sort === "popular"
        ? { clapCount: -1, responseCount: -1, publishedAt: -1 }
        : { publishedAt: -1, updatedAt: -1 };

    const shouldApplyTopicScoring =
      resolvedScope === "forYou" &&
      filter.isPublished !== false &&
      viewerTopics.length > 0 &&
      !author;

    if (shouldApplyTopicScoring) {
  const matchStage = { ...filter };

      const pipeline = [
        { $match: matchStage },
        {
          $addFields: {
            topicScore: {
              $size: {
                $setIntersection: ["$tags", viewerTopics],
              },
            },
          },
        },
        {
          $sort: {
            topicScore: -1,
            publishedAt: -1,
            updatedAt: -1,
          },
        },
        {
          $facet: {
            items: [
              { $skip: skip },
              { $limit: numericLimit },
              {
                $lookup: {
                  from: "users",
                  localField: "author",
                  foreignField: "_id",
                  as: "author",
                  pipeline: [
                    {
                      $project: {
                        username: 1,
                        name: 1,
                        avatar: 1,
                        bio: 1,
                        membershipStatus: 1,
                      },
                    },
                  ],
                },
              },
              { $unwind: "$author" },
            ],
            meta: [{ $count: "total" }],
          },
        },
      ];

      const [result] = await Post.aggregate(pipeline);
      const items = Array.isArray(result?.items) ? result.items : [];
      const total = Array.isArray(result?.meta) && result.meta.length > 0 ? result.meta[0].total : 0;

      res.json({
        items: items.map(hydratePost),
        pagination: {
          total,
          page: Number(page) || 1,
          limit: numericLimit,
        },
      });
      return;
    }

    const [items, total] = await Promise.all([
      Post.find(filter)
        .sort(sortOption)
        .skip(skip)
        .limit(numericLimit)
        .populate("author", "username name avatar bio membershipStatus")
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
  .populate("author", "username name avatar bio pronouns membershipStatus")
      .lean();
    if (post) return post;
  }

  return Post.findOne({ slug: param })
  .populate("author", "username name avatar bio pronouns membershipStatus")
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
      isPublished = false,
    } = req.body;

    const normalizedCoverMeta = normalizeCoverImageMeta(req.body.coverImageMeta);
    const normalizedContent = normalizeContentBlocks(content);
    const resolvedCoverImage = resolveCoverImageValue(coverImage, normalizedCoverMeta);

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const userSettings = await UserSettings.findOne({ user: req.user._id }).lean();
    const settingsSnapshot = defaultSnapshotFromSettings(userSettings);
    const defaultResponseMode = mapCommentSettingToResponse(settingsSnapshot.commentSetting);
    const resolvedVisibility = normalizeVisibility(req.body.visibility, settingsSnapshot.visibility);
    const resolvedResponseMode = determineResponseMode(req.body, defaultResponseMode);
    const resolvedDistributionMode = normalizeDistributionMode(
      req.body,
      settingsSnapshot.sendEmails ? "AUTO_EMAIL" : "PROMPT"
    );
    const inheritsDefaults = !hasSettingOverrides(req.body);
    const allowResponsesResolved = resolvedResponseMode !== "DISABLED";

    const wordCount = countWords(normalizedContent);
    const readingTime = estimateReadingTime(wordCount);
    const slug = await ensureUniqueSlug(title);

    const post = await Post.create({
      author: req.user._id,
      title,
      subtitle,
      content: normalizedContent,
      tags,
      coverImage: resolvedCoverImage,
      coverImageMeta: normalizedCoverMeta,
      allowResponses: allowResponsesResolved,
      responseMode: resolvedResponseMode,
      distributionMode: resolvedDistributionMode,
      inheritsDefaults,
      settingsSnapshot,
      isPublished,
      visibility: resolvedVisibility,
      slug,
      wordCount,
      readingTime,
      publishedAt: isPublished ? new Date() : null,
    });

    await post.populate("author", "username name avatar bio membershipStatus");
    const responsePayload = hydratePost(post);

    const explicitDistributionFlag = Object.prototype.hasOwnProperty.call(
      req.body || {},
      "shouldSendDistributionEmail"
    )
      ? Boolean(req.body.shouldSendDistributionEmail)
      : null;

    const shouldDistribute =
      post.isPublished &&
      (explicitDistributionFlag !== null
        ? explicitDistributionFlag
        : resolvedDistributionMode === "AUTO_EMAIL");

    if (shouldDistribute) {
      try {
        await dispatchPostPublicationEmail(post, userSettings || {});
      } catch (error) {
        console.error("Failed to distribute post via email", error);
      }
    }

    res.status(201).json(responsePayload);
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

    const wasPublished = Boolean(post.isPublished);
    const body = req.body || {};
    const updates = {};
    const allowed = [
      "title",
      "subtitle",
      "content",
      "tags",
      "coverImage",
      "coverImageMeta",
      "isPublished",
    ];

    Object.entries(body).forEach(([key, value]) => {
      if (allowed.includes(key)) {
        updates[key] = value;
      }
    });

    if (updates.title) {
      updates.slug = await ensureUniqueSlug(updates.title, post._id);
    }

    if (Object.prototype.hasOwnProperty.call(updates, "content")) {
      const normalizedContent = normalizeContentBlocks(updates.content);
      updates.content = normalizedContent;
      const wordCount = countWords(normalizedContent);
      updates.wordCount = wordCount;
      updates.readingTime = estimateReadingTime(wordCount);
    }

    const hasCoverMetaUpdate = Object.prototype.hasOwnProperty.call(updates, "coverImageMeta");
    if (hasCoverMetaUpdate) {
      updates.coverImageMeta = normalizeCoverImageMeta(body.coverImageMeta);
    }

    if (Object.prototype.hasOwnProperty.call(updates, "coverImage") || hasCoverMetaUpdate) {
      const coverCandidate = Object.prototype.hasOwnProperty.call(updates, "coverImage")
        ? updates.coverImage
        : post.coverImage;
      const metaCandidate = hasCoverMetaUpdate ? updates.coverImageMeta : post.coverImageMeta;
      updates.coverImage = resolveCoverImageValue(coverCandidate, metaCandidate);
    }

    if (typeof updates.isPublished === "boolean") {
      updates.publishedAt = updates.isPublished ? post.publishedAt || new Date() : null;
    }

    let resolvedVisibility;
    if (Object.prototype.hasOwnProperty.call(body, "visibility")) {
      const fallbackVisibility = post.settingsSnapshot?.visibility || post.visibility;
      resolvedVisibility = normalizeVisibility(body.visibility, fallbackVisibility);
      updates.visibility = resolvedVisibility;
    }

    let resolvedResponseMode;
    if (
      ["responseMode", "commentSetting", "allowResponses"].some((key) =>
        Object.prototype.hasOwnProperty.call(body, key)
      )
    ) {
      const fallbackMode =
        post.responseMode || mapCommentSettingToResponse(post.settingsSnapshot?.commentSetting);
      resolvedResponseMode = determineResponseMode(body, fallbackMode);
      updates.responseMode = resolvedResponseMode;
      updates.allowResponses = resolvedResponseMode !== "DISABLED";
    }

    let resolvedDistributionMode;
    if (
      ["distributionMode", "sendEmails"].some((key) =>
        Object.prototype.hasOwnProperty.call(body, key)
      )
    ) {
      const fallbackDistribution =
        post.distributionMode || (post.settingsSnapshot?.sendEmails ? "AUTO_EMAIL" : "PROMPT");
      resolvedDistributionMode = normalizeDistributionMode(body, fallbackDistribution);
      updates.distributionMode = resolvedDistributionMode;
    }

    const touchedSetting =
      typeof resolvedVisibility !== "undefined" ||
      typeof resolvedResponseMode !== "undefined" ||
      typeof resolvedDistributionMode !== "undefined";

    if (touchedSetting) {
      const defaultVisibilityToken = normalizeVisibility(
        post.settingsSnapshot?.visibility,
        post.settingsSnapshot?.visibility
      );
      const defaultResponseMode = mapCommentSettingToResponse(
        post.settingsSnapshot?.commentSetting
      );
      const defaultDistributionMode = post.settingsSnapshot?.sendEmails ? "AUTO_EMAIL" : "PROMPT";

      const finalVisibility = updates.visibility || post.visibility;
      const finalResponse = updates.responseMode || post.responseMode || defaultResponseMode;
      const finalDistribution =
        updates.distributionMode || post.distributionMode || defaultDistributionMode;

      updates.inheritsDefaults =
        finalVisibility === defaultVisibilityToken &&
        finalResponse === defaultResponseMode &&
        finalDistribution === defaultDistributionMode;
    }

    const updated = await Post.findByIdAndUpdate(post._id, updates, {
      new: true,
      runValidators: true,
    }).populate("author", "username name avatar bio membershipStatus");

    const responsePayload = hydratePost(updated);

    const justPublished = !wasPublished && Boolean(updated.isPublished);
    let shouldDistribute = false;

    if (justPublished) {
      const explicitDistributionFlag = Object.prototype.hasOwnProperty.call(
        body,
        "shouldSendDistributionEmail"
      )
        ? Boolean(body.shouldSendDistributionEmail)
        : null;

      const finalDistributionMode = (updated.distributionMode || "")
        .toString()
        .trim()
        .toUpperCase();

      shouldDistribute =
        explicitDistributionFlag !== null
          ? explicitDistributionFlag
          : finalDistributionMode === "AUTO_EMAIL";
    }

    if (shouldDistribute) {
      try {
        const authorSettings = await UserSettings.findOne({ user: req.user._id }).lean();
        await dispatchPostPublicationEmail(updated, authorSettings || {});
      } catch (error) {
        console.error("Failed to distribute post via email", error);
      }
    }

    res.json(responsePayload);
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

    const authorId = normalizeObjectId(post?.author);
    const actorId = normalizeObjectId(req.user?._id);
    const authorIdString = objectIdToString(authorId);
    const actorIdString = objectIdToString(actorId);
    const postIdString =
      objectIdToString(post?._id) || objectIdToString(post?.id) || post?._id?.toString();

    if (authorIdString && actorIdString && authorIdString !== actorIdString) {
      const actorName = req.user.name || req.user.username || "Someone";

      await safeCreateNotification({
        recipient: authorId,
        sender: actorId,
        type: "like",
        post: post._id,
        message: `${actorName} clapped for your story "${post.title}"`,
        metadata: {
          postId: postIdString,
          postSlug: post.slug,
        },
      });
    }

    res.json({ clapCount: updated.clapCount });
  } catch (error) {
    res.status(500).json({ error: "Failed to clap post" });
  }
};

export const reportPost = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    const rawReason = req.body?.reason;
    const rawDetails = req.body?.details;

    const reason = typeof rawReason === "string" ? rawReason.trim().slice(0, 120) : "";
    if (!reason) {
      return res.status(400).json({ error: "A report reason is required" });
    }

    const post = await findPostByParam(idOrSlug);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const details = typeof rawDetails === "string" ? rawDetails.trim().slice(0, 2000) : "";

    await PostReport.findOneAndUpdate(
      { user: req.user._id, post: post._id },
      {
        $set: {
          reason,
          details: details || undefined,
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { new: true, upsert: true }
    );

    res.status(201).json({ reported: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to submit report" });
  }
};

export const listAuthorPosts = async (req, res) => {
  try {
    const { username } = req.params;
    const author = await User.findOne({ username }).select(
      "_id username name avatar bio membershipStatus"
    );

    if (!author) {
      return res.status(404).json({ error: "User not found" });
    }

    const viewerId = req.user?._id;
    const isSelf = viewerId && author._id.toString() === viewerId.toString();

    let outgoing = null;
    let incoming = null;

    if (viewerId && !isSelf) {
      [outgoing, incoming] = await Promise.all([
        getRelationshipBetween(viewerId, author._id),
        getRelationshipBetween(author._id, viewerId),
      ]);
    }

    if (incoming?.status === RELATIONSHIP_STATUS.BLOCKED) {
      return res.status(403).json({ error: "This user has blocked you." });
    }

    if (outgoing?.status === RELATIONSHIP_STATUS.BLOCKED) {
      return res
        .status(403)
        .json({ error: "Unblock this user to view their stories." });
    }

    const settingsDoc = await UserSettings.findOne({ user: author._id }).lean();
    const profileVisibility = settingsDoc?.visibility || "Public";
    const isFollower = outgoing?.status === RELATIONSHIP_STATUS.FOLLOWING;

    if (!isSelf && profileVisibility === "Private" && (!viewerId || !isFollower)) {
      return res.status(403).json({ error: "This profile is private." });
    }

    let visibilityFilter = {};
    if (!isSelf) {
      if (isFollower) {
        visibilityFilter = { visibility: { $ne: "PRIVATE" } };
      } else {
        visibilityFilter = { visibility: "PUBLIC" };
      }
    }

    const posts = await Post.find({
      author: author._id,
      isPublished: true,
      ...visibilityFilter,
    })
      .sort({ publishedAt: -1, createdAt: -1 })
      .populate("author", "username name avatar bio membershipStatus")
      .lean();

    res.json({
      author: {
        id: author._id,
        username: author.username,
        name: author.name,
        avatar: author.avatar,
        bio: author.bio,
        isPremium: Boolean(author.membershipStatus),
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
  .populate("author", "username name avatar bio membershipStatus")
      .lean();

    res.json({ items: drafts.map(hydratePost) });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch drafts" });
  }
};
