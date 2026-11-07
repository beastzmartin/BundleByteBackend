import express from 'express';
import {
  getOrderWhatsAppDelivery,
  markCustomerContacted,
  listWhatsAppDeliveries,
  updateWhatsAppStatus,
  fulfillWhatsAppOrder,
} from '../controllers/whatsappDeliveryController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Customer or admin can fetch their order's WhatsApp details
router.get('/order/:orderId', protect, getOrderWhatsAppDelivery);
router.post('/order/:orderId/contacted', protect, markCustomerContacted);

// Admin queue endpoints
router.get('/admin/queue', protect, adminOnly, listWhatsAppDeliveries);
router.put('/admin/:id/status', protect, adminOnly, updateWhatsAppStatus);
router.post('/admin/:id/fulfill', protect, adminOnly, fulfillWhatsAppOrder);

export default router;

