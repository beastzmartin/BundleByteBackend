import express from 'express';
import {
  getMerchants,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  toggleMerchantStatus,
  getRoutingConfig,
  updateRoutingConfig,
  getTransactions,
  getReconciliationReport,
  recheckTransaction,
  exportTransactionsCSV,
} from '../controllers/adminPaytmController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'manager'));

// Merchant management
router.get('/merchants', getMerchants);
router.post('/merchants', authorize('admin'), createMerchant);
router.put('/merchants/:id', authorize('admin'), updateMerchant);
router.delete('/merchants/:id', authorize('admin'), deleteMerchant);
router.patch('/merchants/:id/status', authorize('admin'), toggleMerchantStatus);

// Multi-Merchant Routing configuration
router.get('/routing', getRoutingConfig);
router.put('/routing', authorize('admin'), updateRoutingConfig);

// Transaction ledger & reconciliation
router.get('/transactions', getTransactions);
router.get('/reconciliation', getReconciliationReport);
router.post('/recheck/:paymentId', authorize('admin'), recheckTransaction);
router.get('/export-csv', exportTransactionsCSV);

export default router;

