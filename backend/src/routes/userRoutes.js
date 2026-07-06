import express from 'express';
import {
  updateProfile,
  getUserHistory,
  getNotifications,
  markNotificationsRead,
} from '../controllers/userController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.put('/profile', protect, updateProfile);
router.get('/history', protect, getUserHistory);
router.get('/notifications', protect, getNotifications);
router.put('/notifications/read', protect, markNotificationsRead);

export default router;
