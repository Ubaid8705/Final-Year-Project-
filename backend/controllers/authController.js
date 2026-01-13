import passport from 'passport';
import jwt from 'jsonwebtoken';

const buildOAuthRedirectUrl = (user) => {
  const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const safeUser = {
    id: user._id.toString(),
    email: user.email,
    username: user.username,
    name: user.name,
    avatar: user.avatar,
    provider: user.provider,
    lastLogin: user.lastLogin,
    topics: Array.isArray(user.topics) ? user.topics : [],
    topicsUpdatedAt: user.topicsUpdatedAt || null,
    membershipStatus: Boolean(user.membershipStatus),
  };

  const params = new URLSearchParams({
    token,
    user: JSON.stringify(safeUser),
  });

 return `${process.env.CLIENT_URL}/oauth-callback?${params.toString()}`;
};

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

    const redirectUrl = buildOAuthRedirectUrl(user);
    console.log('OAuth Redirect URL:', redirectUrl);
    res.redirect(redirectUrl);
  })(req, res, next);
};

// Handle user logout
export const logout = (req, res) => {
  req.logout();
  res.redirect(`${process.env.CLIENT_URL}/login`);
};