import mongoose from "mongoose";

const MarkupSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true },
    start: { type: Number },
    end: { type: Number },
    href: { type: String, trim: true },
  },
  { _id: false }
);

const ListItemSchema = new mongoose.Schema(
  {
    text: { type: String, trim: true },
    markups: [MarkupSchema],
  },
  { _id: false }
);

const ContentBlockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "P",
        "H1",
        "H2",
        "H3",
        "BQ",
        "BLOCKQUOTE",
        "IMG",
        "VIDEO",
        "CODE",
        "UL",
        "OL",
        "DIVIDER",
      ],
      required: true,
      uppercase: true,
      trim: true,
    },
    text: { type: String },
    markups: [MarkupSchema],
    image: {
      url: { type: String, trim: true },
      alt: { type: String, trim: true },
      width: { type: Number },
      height: { type: Number },
      caption: { type: String, trim: true },
    },
    video: {
      url: { type: String, trim: true },
      caption: { type: String, trim: true },
      platform: {
        type: String,
        enum: ["YOUTUBE", "VIMEO", "UPLOAD"],
        default: "UPLOAD",
      },
      thumbnail: { type: String, trim: true },
      width: { type: Number },
      height: { type: Number },
    },
    items: [ListItemSchema],
    codeBlock: { type: String },
  },
  { _id: false }
);

const PostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: { type: String, trim: true },
    slug: {
      type: String,
      unique: true,
      index: true,
      trim: true,
    },
    content: [ContentBlockSchema],
    tags: [{ type: String, trim: true, lowercase: true }],
    coverImage: { type: String, trim: true },
    readingTime: { type: Number },
    wordCount: { type: Number },
    clapCount: { type: Number, default: 0 },
    responseCount: { type: Number, default: 0 },
    mediumUrl: { type: String, trim: true },
    isPublished: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    allowResponses: { type: Boolean, default: true },
    responseMode: {
      type: String,
      enum: ["EVERYONE", "FOLLOWERS", "DISABLED"],
      default: "EVERYONE",
    },
    distributionMode: {
      type: String,
      enum: ["AUTO_EMAIL", "PROMPT"],
      default: "AUTO_EMAIL",
    },
    publishedAt: { type: Date },
    visibility: {
      type: String,
      enum: ["PUBLIC", "PRIVATE", "UNLISTED"],
      default: "PUBLIC",
    },
    inheritsDefaults: {
      type: Boolean,
      default: true,
    },
    settingsSnapshot: {
      visibility: {
        type: String,
        enum: ["Public", "Unlisted", "Private"],
        default: "Public",
      },
      commentSetting: {
        type: String,
        enum: ["Everyone", "Followers only", "Disabled"],
        default: "Everyone",
      },
      sendEmails: {
        type: Boolean,
        default: true,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Post", PostSchema);
