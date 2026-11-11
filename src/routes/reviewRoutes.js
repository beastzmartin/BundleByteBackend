import express from 'express';
import {
  getProductReviews,
  createReview,
  getAllReviews,
  moderateReview,
  deleteReview,
} from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.get('/product/:productId', getProductReviews);
router.post('/', protect, createReview);

// Admin moderation
router.get('/all', protect, requirePermission('products.view'), getAllReviews);
router.put('/:id/moderate', protect, requirePermission('products.update'), moderateReview);
router.delete('/:id', protect, requirePermission('products.delete'), deleteReview);

export default router;

