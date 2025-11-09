import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

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

const CommentModel = mongoose.models.Comment || mongoose.model("Comment", commentSchema);

export default CommentModel;
