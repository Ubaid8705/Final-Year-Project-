import mongoose from "mongoose";

const { Schema } = mongoose;

const RelationshipSchema = new Schema(
  {
    follower: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    following: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["following", "blocked"],
      default: "following",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

RelationshipSchema.index({ follower: 1, following: 1 }, { unique: true });
RelationshipSchema.index({ following: 1, status: 1 });
RelationshipSchema.index({ follower: 1, status: 1 });

RelationshipSchema.pre("save", function handleSelfFollow(next) {
  if (this.follower && this.following && this.follower.equals(this.following)) {
    return next(new Error("Users cannot follow themselves"));
  }
  return next();
});

const RelationshipModel =
  mongoose.models.Relationship || mongoose.model("Relationship", RelationshipSchema);

export default RelationshipModel;
