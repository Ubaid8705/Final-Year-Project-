import express from 'express';
import session from 'express-session';
import passport from 'passport';
import cors from 'cors';
import passportConfig from './auth/passport.js';  // Import passport configuration function
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';

const app = express();

// Middleware
app.use(cors());
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
// Note: posts routes not present in this workspace; add post routes import if/when created

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

export default app;