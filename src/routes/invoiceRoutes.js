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
import { protect, adminOnly } from '../middleware/auth.js';

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
router.get('/admin/settings', protect, adminOnly, getInvoiceDesignerSettings);
router.put('/admin/settings', protect, adminOnly, updateInvoiceDesignerSettings);
router.post('/admin/test-pdf', protect, adminOnly, generateTestInvoicePdf);
router.get('/admin/all', protect, adminOnly, getAllInvoicesAdmin);
router.post('/admin/generate/:orderId', protect, adminOnly, generateInvoiceForOrderAdmin);
router.post('/admin/:id/regenerate', protect, adminOnly, regenerateInvoiceAdmin);
router.post('/admin/:id/credit-note', protect, adminOnly, issueCreditNoteAdmin);
router.get('/admin/:id/download', protect, adminOnly, downloadInvoicePdf);

export default router;
