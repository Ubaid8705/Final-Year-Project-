import mongoose from "mongoose";

const hiddenPostSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    hiddenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

hiddenPostSchema.index({ user: 1, post: 1 }, { unique: true });

const HiddenPostModel =
  mongoose.models.HiddenPost || mongoose.model("HiddenPost", hiddenPostSchema);

export default HiddenPostModel;
