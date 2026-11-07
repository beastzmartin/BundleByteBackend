import express from 'express';
import {
  getProductReviews,
  createReview,
  getAllReviews,
  moderateReview,
  deleteReview,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.get('/product/:productId', getProductReviews);
router.post('/', protect, createReview);

// Admin moderation
router.get('/all', protect, authorize('admin', 'manager'), getAllReviews);
router.put('/:id/moderate', protect, authorize('admin', 'manager'), moderateReview);
router.delete('/:id', protect, authorize('admin'), deleteReview);

export default router;

