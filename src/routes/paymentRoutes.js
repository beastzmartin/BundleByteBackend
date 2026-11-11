import express from 'express';
import {
  verifyPayment,
  handleWebhook,
  getTransactions,
  submitBinanceTxId,
  submitUpiUtr,
  getOrderPaymentStatus,
} from '../controllers/paymentController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// Webhook endpoint (public with provider verification)
router.post('/webhook/:gateway?', handleWebhook);

// Protected payment routes
router.post('/verify', protect, verifyPayment);
router.post('/binance/submit-txid', protect, submitBinanceTxId);
router.post('/upi/submit-utr', protect, submitUpiUtr);
router.get('/status/:orderId', protect, getOrderPaymentStatus);
router.get('/transactions', protect, requirePermission('payments.view'), getTransactions);

export default router;


