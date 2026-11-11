import express from 'express';
import {
  getMyInvoices,
  downloadInvoicePdf,
  getInvoiceById,
  getAllInvoicesAdmin,
  generateInvoiceForOrderAdmin,
  regenerateInvoiceAdmin,
  issueCreditNoteAdmin,
  getInvoiceDesignerSettings,
  updateInvoiceDesignerSettings,
  generateTestInvoicePdf,
  downloadInvoicePdfForOrder,
  getInvoiceForOrder,
} from '../controllers/invoiceController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

// General & Settings Endpoints
router.get('/settings', getInvoiceDesignerSettings);

// Customer Endpoints
router.get('/my-invoices', protect, getMyInvoices);
router.get('/order/:orderId', protect, getInvoiceForOrder);
router.get('/order/:orderId/pdf', protect, downloadInvoicePdfForOrder);
router.get('/:id/pdf', protect, downloadInvoicePdf);
router.get('/:id', protect, getInvoiceById);

// Admin Endpoints
router.get('/admin/settings', protect, requirePermission('system_settings.view'), getInvoiceDesignerSettings);
router.put('/admin/settings', protect, requirePermission('system_settings.manage'), updateInvoiceDesignerSettings);
router.post('/admin/test-pdf', protect, requirePermission('system_settings.manage'), generateTestInvoicePdf);
router.get('/admin/all', protect, requirePermission('orders.view'), getAllInvoicesAdmin);
router.post('/admin/generate/:orderId', protect, requirePermission('orders.manage'), generateInvoiceForOrderAdmin);
router.post('/admin/:id/regenerate', protect, requirePermission('orders.manage'), regenerateInvoiceAdmin);
router.post('/admin/:id/credit-note', protect, requirePermission('orders.refund'), issueCreditNoteAdmin);
router.get('/admin/:id/download', protect, requirePermission('orders.view'), downloadInvoicePdf);

export default router;
