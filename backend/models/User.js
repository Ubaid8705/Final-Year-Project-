import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  provider: { type: String},
  providerId: { type: String},
  username: { type: String, required: true, unique: true },
  name: { type: String },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  // Email verification fields (for email signup flow)
  isEmailVerified: { type: Boolean, default: false },
  // OTP code sent to email for verification
  emailVerificationOTP: String,
  emailVerificationOTPExpires: Date,
  // Password reset fields
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  avatar: { type: String },
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
},
{ timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password')) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("User", userSchema);
