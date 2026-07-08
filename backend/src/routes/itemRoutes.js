import express from 'express';
import {
  addItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
} from '../controllers/itemController.js';
import { protect, isVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.get('/', getItems);
router.get('/:id', getItemById);

// Protected routes (Requires verified college email)
router.post('/', protect, isVerified, addItem);
router.put('/:id', protect, isVerified, updateItem);
router.delete('/:id', protect, isVerified, deleteItem);

export default router;
