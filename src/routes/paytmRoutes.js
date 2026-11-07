import express from 'express';
import {
  initiatePayment,
  checkPaymentStatus,
  handlePaytmCallback,
  cancelPayment,
} from '../controllers/paytmController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Callback endpoint (receives POST from Paytm / Webhooks)
router.post('/callback', handlePaytmCallback);

// Protected customer payment routes
router.use(protect);
router.post('/initiate', initiatePayment);
router.get('/status/:paymentId', checkPaymentStatus);
router.post('/cancel/:paymentId', cancelPayment);

export default router;

