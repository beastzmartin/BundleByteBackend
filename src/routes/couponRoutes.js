import express from 'express';
import {
  validateCoupon,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/couponController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

// Public coupon validation for checkout
router.post('/validate', validateCoupon);

// Admin routes
router.use(protect, authorize('admin', 'manager'));
router.get('/', getCoupons);
router.post('/', createCoupon);
router.put('/:id', updateCoupon);
router.delete('/:id', deleteCoupon);

export default router;

