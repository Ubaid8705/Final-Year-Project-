import mongoose from "mongoose";

const newsletterSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  subscribersCount: { type: Number, default: 0 },
  isSubscribed: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
},
{ timestamps: true });

const NewsletterModel =
  mongoose.models.Newsletter || mongoose.model("Newsletter", newsletterSchema);

export default NewsletterModel;
