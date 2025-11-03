import express from 'express';
import { googleLogin, googleCallback, facebookLogin, facebookCallback, logout } from '../controllers/authController.js';
import {
	register,
	login,
	verifyEmail,
	forgotPassword,
	resetPassword,
} from '../controllers/emailAuthController.js';

const router = express.Router();

// Google OAuth routes
router.get('/google', googleLogin);
router.get('/google/callback', googleCallback);
router.get('/facebook', facebookLogin);
router.get('/facebook/callback', facebookCallback);

// Email signup / signin routes
router.post('/register', register);
router.post('/login', login);
// Verify emailed OTP (body: { email, otp })
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Logout route
router.get('/logout', logout);

export default router;