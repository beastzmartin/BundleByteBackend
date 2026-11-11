import express from 'express';
import {
  getAllWallets,
  getUserWalletDetails,
  adminCreditWallet,
  adminDebitWallet,
  exportWalletLedgerCSV,
} from '../controllers/adminWalletController.js';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.get('/', requirePermission('wallets.view'), getAllWallets);
router.get('/export', requirePermission('wallets.export'), exportWalletLedgerCSV);
router.get('/:userId', requirePermission('wallets.view'), getUserWalletDetails);
router.post('/:userId/credit', requirePermission('wallets.manage'), adminCreditWallet);
router.post('/:userId/debit', requirePermission('wallets.manage'), adminDebitWallet);

export default router;

