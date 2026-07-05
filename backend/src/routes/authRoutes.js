import express from 'express';
import passport from 'passport';
import {
  register,
  verifyEmail,
  login,
  googleSuccess,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Local Registration & Verification
router.post('/register', register);
router.get('/verify/:token', verifyEmail);

// Local Login & Logout
router.post('/login', login);
router.get('/logout', logout);

// Password Reset
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

// Get current user profile
router.get('/me', protect, getMe);

// Google OAuth Routes
router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/login?error=google_auth_failed`,
  }),
  googleSuccess
);

export default router;
