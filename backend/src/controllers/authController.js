import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendVerificationEmail, sendResetPasswordEmail } from '../utils/email.js';

// Helper to generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_jwt_key_98765', {
    expiresIn: '30d',
  });
};

// Helper to set JWT cookie
const setTokenCookie = (res, token) => {
  const cookieOptions = {
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  };
  res.cookie('token', token, cookieOptions);
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password, department, semester } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists with this email' });
    }

    // Validate college email domain (ends with .edu, .ac.in, or similar)
    const isCollegeEmail = email.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]*\.(edu|ac\.in|college\.edu)$/i) || process.env.NODE_ENV === 'development';
    if (!isCollegeEmail) {
      return res.status(400).json({
        success: false,
        message: 'Only college email addresses (.edu, .ac.in) are allowed.',
      });
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');

    // Create user
    const user = await User.create({
      name,
      email,
      password,
      department: department || 'General',
      semester: semester || 1,
      verificationToken,
    });

    // Send verification email
    await sendVerificationEmail(email, verificationToken, req);

    res.status(201).json({
      success: true,
      message: 'Registration successful! Verification email has been sent. Please check your inbox or server logs.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email token
// @route   GET /api/auth/verify/:token
// @access  Public
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }

    user.verified = true;
    user.verificationToken = undefined;
    await user.save();

    // Redirect to frontend login with success message
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/login?verified=true`);
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Check for user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check if user is verified (if verification is enforced)
    if (!user.verified && process.env.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, message: 'Please verify your college email address first' });
    }

    // Generate JWT
    const token = generateToken(user._id);

    // Set cookie
    setTokenCookie(res, token);

    // Also support Passport session login for complete security & compatibility
    req.login(user, (err) => {
      if (err) {
        console.error('Passport login error:', err);
      }
      
      res.status(200).json({
        success: true,
        token,
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          department: user.department,
          semester: user.semester,
          trustScore: user.trustScore,
          sharePoints: user.sharePoints,
          verified: user.verified,
          avatar: user.avatar,
        },
      });
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Google OAuth Success Redirect
// @route   GET /api/auth/google/success
// @access  Private (Invoked by passport after success)
export const googleSuccess = (req, res) => {
  if (req.user) {
    // Generate JWT token to be compliant with both cookie-session & token workflows
    const token = generateToken(req.user._id);
    setTokenCookie(res, token);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    // Redirect to dashboard on frontend
    res.redirect(`${frontendUrl}/dashboard?login_success=true&token=${token}`);
  } else {
    res.status(401).json({ success: false, message: 'Google authentication failed' });
  }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account registered with this email' });
    }

    // Generate password reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    
    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Set expire (10 minutes)
    user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;

    await user.save();

    // Send reset email
    await sendResetPasswordEmail(email, resetToken, req);

    res.status(200).json({
      success: true,
      message: 'Reset password link sent to email (or logged in console). Valid for 10 minutes.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    // Get hashed token
    const resetPasswordToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }

    // Set new password (will be hashed by pre-save schema hook)
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & clear cookies/sessions
// @route   GET /api/auth/logout
// @access  Private
export const logout = (req, res, next) => {
  // Clear cookie
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  });

  // Logout from Passport session
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    // Destroy express session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          return next(err);
        }
        res.status(200).json({ success: true, message: 'Logged out successfully' });
      });
    } else {
      res.status(200).json({ success: true, message: 'Logged out successfully' });
    }
  });
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    // req.user is populated either by Passport deserializeUser or JWT protect middleware
    const user = await User.findById(req.user._id).select('-password');
    res.status(200).json({ success: true, user });
  } catch (error) {
    next(error);
  }
};
