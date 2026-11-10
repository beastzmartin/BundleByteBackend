import express from 'express';
import {
  getActiveCustomMethods,
  getAllCustomMethods,
  createCustomMethod,
  updateCustomMethod,
  toggleCustomMethod,
  deleteCustomMethod,
  uploadPaymentFile,
  submitCustomPayment,
  getMyPaymentRequests,
  getAdminPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest,
  updatePaymentRequest,
} from '../controllers/customPaymentController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import { paymentUpload } from '../middleware/paymentUpload.js';

const router = express.Router();

// Public / Customer Endpoints
router.get('/custom-payment-methods', getActiveCustomMethods);
router.post('/payments/upload-receipt', protect, paymentUpload.single('file'), uploadPaymentFile);
router.post('/payments/custom/submit', protect, submitCustomPayment);
router.get('/payments/my-requests', protect, getMyPaymentRequests);

// Admin Custom Payment Method Management
router.get('/admin/custom-payment-methods', protect, authorize('admin'), getAllCustomMethods);
router.post('/admin/custom-payment-methods', protect, authorize('admin'), createCustomMethod);
router.put('/admin/custom-payment-methods/:id', protect, authorize('admin'), updateCustomMethod);
router.patch('/admin/custom-payment-methods/:id/toggle', protect, authorize('admin'), toggleCustomMethod);
router.delete('/admin/custom-payment-methods/:id', protect, authorize('admin'), deleteCustomMethod);

// Admin Unified Payment Requests
router.get('/admin/payment-requests', protect, authorize('admin'), getAdminPaymentRequests);
router.post('/admin/payment-requests/:id/approve', protect, authorize('admin'), approvePaymentRequest);
router.post('/admin/payment-requests/:id/reject', protect, authorize('admin'), rejectPaymentRequest);
router.put('/admin/payment-requests/:id', protect, authorize('admin'), updatePaymentRequest);

export default router;

