import express from 'express';
import {
  getBinanceStatus,
  getBinanceLiveDeposits,
  getVerifications,
  approveVerification,
  rejectVerification,
  syncBinanceDeposits,
  getBinanceConfig,
  updateBinanceConfig,
  seedTrustedBankRecord,
} from '../controllers/adminBinanceController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin', 'manager'));

router.get('/status', getBinanceStatus);
router.get('/deposits', getBinanceLiveDeposits);
router.get('/verifications', getVerifications);
router.post('/verify/:id/approve', approveVerification);
router.post('/verify/:id/reject', rejectVerification);
router.post('/sync', syncBinanceDeposits);
router.get('/config', getBinanceConfig);
router.put('/config', updateBinanceConfig);
router.post('/config', updateBinanceConfig);
router.post('/seed-trusted-utr', seedTrustedBankRecord);

export default router;

