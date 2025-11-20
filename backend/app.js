import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import passportConfig from './auth/passport.js';  // Import passport configuration function
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import postsRoutes from './routes/posts.js';
import commentsRoutes from './routes/comments.js';
import settingsRoutes from './routes/settings.js';
import savedRoutes from './routes/saved.js';
import notificationsRoutes from './routes/notifications.js';
import hiddenRoutes from './routes/hidden.js';
import uploadsRoutes from './routes/uploads.js';
import newsletterRoutes from './routes/newsletter.js';
import billingRoutes from './routes/billing.js';

const app = express();

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim());

// Middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static('uploads'));

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Initialize passport
app.use(passport.initialize());
app.use(passport.session());

// Configure passport strategies
passportConfig(passport);

// Routes
app.use('/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/saved-posts', savedRoutes);
app.use('/api/hidden-posts', hiddenRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/billing', billingRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;