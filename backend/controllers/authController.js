import passport from 'passport';
import jwt from 'jsonwebtoken';

// Handle Google OAuth login
export const googleLogin = passport.authenticate('google', { 
  scope: ['profile', 'email'],
  prompt: 'select_account' // This forces Google to show the account selection screen
});

// Handle Google OAuth callback
export const googleCallback = (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user) => {
    if (err) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=${err.message}`);
    }

    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=Authentication failed`);
    }

    // Create JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Redirect to frontend with token
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  })(req, res, next);
};

// Handle user logout
export const logout = (req, res) => {
  req.logout();
  res.redirect(`${process.env.CLIENT_URL}/login`);
};