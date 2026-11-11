import express from 'express';
import {
  getOrderWhatsAppDelivery,
  markCustomerContacted,
  listWhatsAppDeliveries,
  updateWhatsAppStatus,
  fulfillWhatsAppOrder,
} from '../controllers/whatsappDeliveryController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// Customer or admin can fetch their order's WhatsApp details
router.get('/order/:orderId', protect, getOrderWhatsAppDelivery);
router.post('/order/:orderId/contacted', protect, markCustomerContacted);

// Admin queue endpoints
router.get('/admin/queue', protect, requirePermission('orders.view'), listWhatsAppDeliveries);
router.put('/admin/:id/status', protect, requirePermission('orders.update'), updateWhatsAppStatus);
router.post('/admin/:id/fulfill', protect, requirePermission('orders.manage'), fulfillWhatsAppOrder);

export default router;

