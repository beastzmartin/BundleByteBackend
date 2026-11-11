import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/all', requirePermission('orders.view'), getAllOrders);
router.get('/:id', getOrderById);
router.put('/:id/status', requirePermission('orders.update'), updateOrderStatus);

export default router;

