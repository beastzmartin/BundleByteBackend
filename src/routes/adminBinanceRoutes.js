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
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

router.get('/status', requirePermission('payments.view'), getBinanceStatus);
router.get('/deposits', requirePermission('payments.view'), getBinanceLiveDeposits);
router.get('/verifications', requirePermission('payments.view'), getVerifications);
router.post('/verify/:id/approve', requirePermission('payments.approve'), approveVerification);
router.post('/verify/:id/reject', requirePermission('payments.manage'), rejectVerification);
router.post('/sync', requirePermission('payments.manage'), syncBinanceDeposits);
router.get('/config', requirePermission('payments.view'), getBinanceConfig);
router.put('/config', requirePermission('payments.configure'), updateBinanceConfig);
router.post('/config', requirePermission('payments.configure'), updateBinanceConfig);
router.post('/seed-trusted-utr', requirePermission('payments.manage'), seedTrustedBankRecord);

export default router;

