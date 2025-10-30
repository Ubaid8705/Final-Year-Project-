import express from 'express';
import { getCurrentUser, updateUser, deleteUser, getUserByUsername } from '../controllers/userController.js';
const router = express.Router();

// Middleware to check if user is authenticated
export const isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ error: 'You must be logged in.' });
};

// User routes
router.get('/me', isAuthenticated, getCurrentUser);
router.put('/update', isAuthenticated, updateUser);
router.delete('/delete', isAuthenticated, deleteUser);
router.get('/:username', getUserByUsername);

export default router;