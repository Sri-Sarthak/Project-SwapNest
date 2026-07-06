import express from 'express';
import {
  getWishlist,
  toggleWishlistItem,
  updateAlertPreferences,
} from '../controllers/wishlistController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);

router.get('/', getWishlist);
router.post('/toggle/:itemId', toggleWishlistItem);
router.put('/alerts', updateAlertPreferences);

export default router;
