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
import { requirePermission } from '../middleware/rbac.js';
import { paymentUpload } from '../middleware/paymentUpload.js';

const router = express.Router();

// Public / Customer Endpoints
router.get('/custom-payment-methods', getActiveCustomMethods);
router.post('/payments/upload-receipt', protect, paymentUpload.single('file'), uploadPaymentFile);
router.post('/payments/custom/submit', protect, submitCustomPayment);
router.get('/payments/my-requests', protect, getMyPaymentRequests);

// Admin Custom Payment Method Management
router.get('/admin/custom-payment-methods', protect, requirePermission('payments.view'), getAllCustomMethods);
router.post('/admin/custom-payment-methods', protect, requirePermission('payments.manage'), createCustomMethod);
router.put('/admin/custom-payment-methods/:id', protect, requirePermission('payments.manage'), updateCustomMethod);
router.patch('/admin/custom-payment-methods/:id/toggle', protect, requirePermission('payments.manage'), toggleCustomMethod);
router.delete('/admin/custom-payment-methods/:id', protect, requirePermission('payments.manage'), deleteCustomMethod);

// Admin Unified Payment Requests
router.get('/admin/payment-requests', protect, requirePermission('payments.view'), getAdminPaymentRequests);
router.post('/admin/payment-requests/:id/approve', protect, requirePermission('payments.approve'), approvePaymentRequest);
router.post('/admin/payment-requests/:id/reject', protect, requirePermission('payments.manage'), rejectPaymentRequest);
router.put('/admin/payment-requests/:id', protect, requirePermission('payments.manage'), updatePaymentRequest);

export default router;

