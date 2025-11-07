import mongoose from "mongoose";

const SavedPostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    savedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

SavedPostSchema.index({ user: 1, post: 1 }, { unique: true });

export default mongoose.model("SavedPost", SavedPostSchema);
