import express from 'express';
import {
  validateCoupon,
  getCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/couponController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// Public coupon validation for checkout
router.post('/validate', validateCoupon);

// Admin routes
router.use(protect);
router.get('/', requirePermission('marketing.view'), getCoupons);
router.post('/', requirePermission('marketing.create'), createCoupon);
router.put('/:id', requirePermission('marketing.update'), updateCoupon);
router.delete('/:id', requirePermission('marketing.delete'), deleteCoupon);

export default router;

