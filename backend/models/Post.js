const mongoose = require("mongoose");

const MarkupSchema = new mongoose.Schema({
  type: { type: String }, // e.g. 'A', 'B', 'EM' for link/bold/italic
  start: Number,
  end: Number,
  href: String
}, { _id: false });

const ContentBlockSchema = new mongoose.Schema({
  type: { 
    type: String, 
    enum: [
      'P',        // Paragraph
      'H1', 'H2', 'H3', // Headings
      'BQ',       // Blockquote
      'IMG',      // Image
      'VIDEO',    // Video
      'CODE',     // Code block
      'UL', 'OL', // Lists
      'DIVIDER'   // Horizontal divider
    ], 
    required: true 
  },
  text: String,

  image: {
    url: String,
    alt: String,
    width: Number,
    height: Number
  },

  video: {
    url: String, 
    caption: String,
    platform: { type: String, enum: ['YOUTUBE', 'VIMEO', 'UPLOAD'], default: 'UPLOAD' }
  },

  listItems: [String], // for UL or OL blocks

  markups: [MarkupSchema]
}, { _id: false });


const PostSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, ref: "User", required: true },
    title: { type: String, required: true },
    subtitle: String,
    slug: { type: String, unique: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: [ContentBlockSchema],
    tags: [String],
    coverImage: String,
    readingTime: Number,
    wordCount: Number,
    clapCount: { type: Number, default: 0 },
    mediumUrl: { type: String },
    isPublished: { type: Boolean, default: false },
    isLocked: { type: Boolean, default: false },
    allowResponses: { type: Boolean, default: true },
    publishedAt: Date,
    visibility: {
      type: String,
      enum: ["PUBLIC", "PRIVATE"],
      default: "PUBLIC",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", PostSchema);
