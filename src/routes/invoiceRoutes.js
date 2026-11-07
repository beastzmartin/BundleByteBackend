import express from 'express';
import {
  getMyInvoices,
  downloadInvoicePdf,
  getInvoiceById,
  getAllInvoicesAdmin,
  generateInvoiceForOrderAdmin,
  regenerateInvoiceAdmin,
  issueCreditNoteAdmin,
} from '../controllers/invoiceController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// Customer Endpoints
router.get('/my-invoices', protect, getMyInvoices);
router.get('/:id/pdf', protect, downloadInvoicePdf);
router.get('/:id', protect, getInvoiceById);

// Admin Endpoints
router.get('/admin/all', protect, adminOnly, getAllInvoicesAdmin);
router.post('/admin/generate/:orderId', protect, adminOnly, generateInvoiceForOrderAdmin);
router.post('/admin/:id/regenerate', protect, adminOnly, regenerateInvoiceAdmin);
router.post('/admin/:id/credit-note', protect, adminOnly, issueCreditNoteAdmin);
router.get('/admin/:id/download', protect, adminOnly, downloadInvoicePdf);

export default router;
