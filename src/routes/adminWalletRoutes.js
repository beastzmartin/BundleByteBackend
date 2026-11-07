import express from 'express';
import {
  getAllWallets,
  getUserWalletDetails,
  adminCreditWallet,
  adminDebitWallet,
  exportWalletLedgerCSV,
} from '../controllers/adminWalletController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/', getAllWallets);
router.get('/export', exportWalletLedgerCSV);
router.get('/:userId', getUserWalletDetails);
router.post('/:userId/credit', adminCreditWallet);
router.post('/:userId/debit', adminDebitWallet);

export default router;

