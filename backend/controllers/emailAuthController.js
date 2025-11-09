import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService.js';
import {
  buildDisplayName,
  generateUniqueUsername,
  normalizeEmail,
} from '../utils/userUtils.js';
import { initializeSeedData } from '../utils/seed.js';

// Register new user
export const register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'A valid password is required' });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(400).json({
        error: 'Email already registered'
      });
    }

    const resolvedName = buildDisplayName(normalizedEmail, name);
    const username = await generateUniqueUsername(normalizedEmail, resolvedName);

    // Create a short numeric OTP and expiry (10 minutes)
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const emailVerificationOTPExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Create new user
    const user = await User.create({
      provider: 'local',
      providerId: null,
      email: normalizedEmail,
      password,
      username,
      name: resolvedName,
      emailVerificationOTP: otp,
      emailVerificationOTPExpires,
      isEmailVerified: false,
      hasSubdomain: false,
      customDomainState: 'none',
      membershipStatus: false,
      pronouns: [],
      topics: [],
      lastLogin: null,
    });

    // Send OTP to user's email
  await sendVerificationEmail(user.email, otp);

  initializeSeedData().catch(() => {});

    res.status(201).json({
      message: 'Registration successful. An OTP was sent to your email to verify your account.'
    });
  } catch (error) {
    res.status(500).json({ error: 'Error creating user' });
  }
};

// Verify email
export const verifyEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !otp) {
      return res.status(400).json({ error: 'Email and otp are required' });
    }

    const user = await User.findOne({
      email: normalizedEmail,
      emailVerificationOTP: otp,
      emailVerificationOTPExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    user.isEmailVerified = true;
    user.emailVerificationOTP = undefined;
    user.emailVerificationOTPExpires = undefined;
    await user.save();

  initializeSeedData().catch(() => {});

  res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error verifying email' });
  }
};

// Login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    // Find user by email
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(401).json({ error: 'Please verify your email first' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    user.lastLogin = new Date();
    await user.save();

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        name: user.name,
        avatar: user.avatar,
        lastLogin: user.lastLogin,
        topics: Array.isArray(user.topics) ? user.topics : [],
        topicsUpdatedAt: user.topicsUpdatedAt || null,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
};

// Request password reset
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = normalizeEmail(email);
    const user = normalizedEmail ? await User.findOne({ email: normalizedEmail }) : null;

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

  await sendPasswordResetEmail(user.email, resetToken);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ error: 'Error requesting password reset' });
  }
};

// Reset password
export const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        error: 'Invalid or expired password reset token'
      });
    }

    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ error: 'Error resetting password' });
  }
};