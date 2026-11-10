import express from 'express';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/roles.js';
import {
  getTaxConfig,
  updateTaxConfig,
  getTaxCategories,
  createTaxCategory,
  updateTaxCategory,
  deleteTaxCategory,
  getGatewayFeeConfigs,
  updateGatewayFeeConfig,
  calculateQuote,
  getFinancialGstReports,
  exportGstReportCsv,
} from '../controllers/taxFeeController.js';

const router = express.Router();

// Public / Authenticated calculation routes
router.get('/config', getTaxConfig);
router.post('/calculate-quote', calculateQuote);

// Protected Admin Routes
router.put('/config', protect, authorize('admin', 'super_admin'), updateTaxConfig);

router.get('/categories', getTaxCategories);
router.post('/categories', protect, authorize('admin', 'super_admin'), createTaxCategory);
router.put('/categories/:id', protect, authorize('admin', 'super_admin'), updateTaxCategory);
router.delete('/categories/:id', protect, authorize('admin', 'super_admin'), deleteTaxCategory);

router.get('/gateway-fees', protect, authorize('admin', 'super_admin'), getGatewayFeeConfigs);
router.put('/gateway-fees/:key', protect, authorize('admin', 'super_admin'), updateGatewayFeeConfig);

router.get('/reports', protect, authorize('admin', 'super_admin'), getFinancialGstReports);
router.get('/reports/export-csv', protect, authorize('admin', 'super_admin'), exportGstReportCsv);

export default router;
