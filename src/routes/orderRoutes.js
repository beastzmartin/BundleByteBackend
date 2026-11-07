import express from 'express';
import {
  createOrder,
  getMyOrders,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
} from '../controllers/orderController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);

router.post('/', createOrder);
router.get('/my', getMyOrders);
router.get('/all', authorize('admin', 'manager'), getAllOrders);
router.get('/:id', getOrderById);
router.put('/:id/status', authorize('admin', 'manager'), updateOrderStatus);

export default router;

