import mongoose from "mongoose";

const newsletterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  userId: { type: String, ref: "User", required: true },
  subscribersCount: { type: Number, default: 0 },
  isSubscribed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Newsletter", newsletterSchema);
