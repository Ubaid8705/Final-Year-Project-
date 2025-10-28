import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    postId: { type: String, ref: "Post", required: true },
    userId: { type: String, ref: "User", required: true },

    content: { type: String, required: true, trim: true },

    // For threaded replies
    parentCommentId: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },

    // Optional: if you later add reactions (likes)
    likesCount: { type: Number, default: 0 },

    // Whether the comment is visible (for moderation)
    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true } // adds createdAt and updatedAt
);

export default mongoose.model("Comment", commentSchema);
