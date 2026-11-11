import express from 'express';
import {
  getPendingManualQueue,
  fulfillManualOrderItem,
  redeliverOrderItem,
  getDeliveryAuditHistory,
} from '../controllers/deliveryController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.get('/pending', requirePermission('orders.view'), getPendingManualQueue);
router.get('/history', requirePermission('orders.view'), getDeliveryAuditHistory);
router.post('/:orderId/manual', requirePermission('orders.manage'), fulfillManualOrderItem);
router.post('/:orderId/redeliver', requirePermission('orders.manage'), redeliverOrderItem);

export default router;

