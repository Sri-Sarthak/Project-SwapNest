import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Protect routes - supports Passport sessions, JWT in Cookies, and JWT in Authorization headers
export const protect = async (req, res, next) => {
  let token;

  // 1. Check if user is authenticated via Passport session
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }

  // 2. Check for JWT token in cookies
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // 3. Check for JWT token in Authorization headers
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no session or token' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_jwt_key_98765');

    // Get user from the token, exclude password
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found with this token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth verification error:', error.message);
    return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
  }
};

// Check if user is verified (college email verification check)
export const isVerified = (req, res, next) => {
  if (!req.user || !req.user.verified) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Please verify your college email address first.',
    });
  }
  next();
};
