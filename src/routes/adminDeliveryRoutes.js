import express from 'express';
import {
  getPendingManualQueue,
  fulfillManualOrderItem,
  redeliverOrderItem,
  getDeliveryAuditHistory,
} from '../controllers/deliveryController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/pending', getPendingManualQueue);
router.get('/history', getDeliveryAuditHistory);
router.post('/:orderId/manual', fulfillManualOrderItem);
router.post('/:orderId/redeliver', redeliverOrderItem);

export default router;

