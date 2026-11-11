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
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

// Customer endpoints
router.get('/my-products', getMyPurchasedProducts);
router.get('/my', getMyPurchasedProducts); // backwards compatibility
router.get('/history', requirePermission('orders.view'), getDeliveryAuditHistory);
router.get('/pending', requirePermission('orders.view'), getPendingManualQueue);
router.get('/:orderId', getDeliveryByOrderId);

// Admin delivery actions
router.post('/:orderId/manual', requirePermission('orders.manage'), fulfillManualOrderItem);
router.post('/:orderId/redeliver', requirePermission('orders.manage'), redeliverOrderItem);

export default router;
