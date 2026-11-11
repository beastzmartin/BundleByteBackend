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
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

// Merchant management
router.get('/merchants', requirePermission('payments.view'), getMerchants);
router.post('/merchants', requirePermission('payments.configure'), createMerchant);
router.put('/merchants/:id', requirePermission('payments.configure'), updateMerchant);
router.delete('/merchants/:id', requirePermission('payments.configure'), deleteMerchant);
router.patch('/merchants/:id/status', requirePermission('payments.configure'), toggleMerchantStatus);

// Multi-Merchant Routing configuration
router.get('/routing', requirePermission('payments.view'), getRoutingConfig);
router.put('/routing', requirePermission('payments.configure'), updateRoutingConfig);

// Transaction ledger & reconciliation
router.get('/transactions', requirePermission('payments.view'), getTransactions);
router.get('/reconciliation', requirePermission('payments.view'), getReconciliationReport);
router.post('/recheck/:paymentId', requirePermission('payments.manage'), recheckTransaction);
router.get('/export-csv', requirePermission('payments.export'), exportTransactionsCSV);

export default router;

