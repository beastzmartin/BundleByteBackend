import express from 'express';
import {
  getWallet,
  getWalletBalance,
  getWalletTransactions,
  initiateTopup,
  verifyTopup,
  payWithWallet,
} from '../controllers/walletController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getWallet);
router.get('/balance', getWalletBalance);
router.get('/transactions', getWalletTransactions);
router.post('/topup', initiateTopup);
router.post('/verify-topup', verifyTopup);
router.post('/pay', payWithWallet);

export default router;

