import express from 'express';
import {
  getMyPurchasedProducts,
  getDeliveryByOrderId,
  getPendingManualQueue,
  fulfillManualOrderItem,
  redeliverOrderItem,
  getDeliveryAuditHistory,
} from '../controllers/deliveryController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);

// Customer endpoints
router.get('/my-products', getMyPurchasedProducts);
router.get('/my', getMyPurchasedProducts); // backwards compatibility
router.get('/history', authorize('admin', 'manager'), getDeliveryAuditHistory);
router.get('/pending', authorize('admin', 'manager'), getPendingManualQueue);
router.get('/:orderId', getDeliveryByOrderId);

// Admin delivery actions
router.post('/:orderId/manual', authorize('admin', 'manager'), fulfillManualOrderItem);
router.post('/:orderId/redeliver', authorize('admin', 'manager'), redeliverOrderItem);

export default router;
