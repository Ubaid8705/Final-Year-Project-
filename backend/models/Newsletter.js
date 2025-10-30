import mongoose from "mongoose";

const newsletterSchema = new mongoose.Schema({
  userId: { type: String, ref: "User", required: true },
  subscribersCount: { type: Number, default: 0 },
  isSubscribed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
},
{ timestamps: true });

export default mongoose.model("Newsletter", newsletterSchema);
