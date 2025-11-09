import mongoose from "mongoose";

const postReportSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 120,
      trim: true,
    },
    details: {
      type: String,
      maxlength: 2000,
      trim: true,
    },
  },
  { timestamps: true }
);

postReportSchema.index({ post: 1, user: 1 }, { unique: true });

const PostReportModel =
  mongoose.models.PostReport || mongoose.model("PostReport", postReportSchema);

export default PostReportModel;
