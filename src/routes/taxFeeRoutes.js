import express from 'express';
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
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
router.put('/config', protect, requirePermission('gst.settings.manage'), updateTaxConfig);

router.get('/categories', getTaxCategories);
router.post('/categories', protect, requirePermission('gst.rules.manage'), createTaxCategory);
router.put('/categories/:id', protect, requirePermission('gst.rules.manage'), updateTaxCategory);
router.delete('/categories/:id', protect, requirePermission('gst.rules.manage'), deleteTaxCategory);

router.get('/gateway-fees', protect, requirePermission('gateway_fees.view'), getGatewayFeeConfigs);
router.put('/gateway-fees/:key', protect, requirePermission('gateway_fees.manage'), updateGatewayFeeConfig);

router.get('/reports', protect, requirePermission('reports_analytics.view'), getFinancialGstReports);
router.get('/reports/export-csv', protect, requirePermission('reports_analytics.export'), exportGstReportCsv);

export default router;
