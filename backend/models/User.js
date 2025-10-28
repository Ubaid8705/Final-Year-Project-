import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "37e620777380"
  username: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String },
  imageUrl: { type: String },
  bio: { type: String, maxlength: 160 },
  pronouns: [{ type: String ,maxlength: 4}],
  hasSubdomain: { type: Boolean, default: false },
  customDomainState: { type: String },
  membershipStatus: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },

  linkedAccounts: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LinkedAccount",
  },
  newsletter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Newsletter",
  },
});

export default mongoose.model("User", userSchema);
