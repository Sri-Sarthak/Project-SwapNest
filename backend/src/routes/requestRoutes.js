import express from 'express';
import {
  createRequest,
  respondToRequest,
  verifyHandover,
  requestReturn,
  verifyReturn,
  fileComplaint,
} from '../controllers/requestController.js';
import { protect, isVerified } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect);
router.use(isVerified);

router.post('/', createRequest);
router.put('/:id/respond', respondToRequest);
router.post('/:id/handover', verifyHandover);
router.post('/:id/return-request', requestReturn);
router.post('/:id/return-verify', verifyReturn);
router.post('/:id/complain', fileComplaint);

export default router;
