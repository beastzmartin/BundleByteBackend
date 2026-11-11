import express from 'express';
import {
  getAllCurrencies,
  createCurrency,
  updateCurrency,
  getExchangeRatesAdmin,
  syncExchangeRates,
  setManualRate,
  getExchangeRateHistory,
  getExchangeRateProviders,
  updateExchangeRateProvider,
  getConversionRules,
  createConversionRule,
  deleteConversionRule,
  getGatewayCurrencyConfigs,
  updateGatewayCurrencyConfig,
  getProductCurrencyPrices,
  saveProductCurrencyPrice,
  getFinancialReports,
} from '../controllers/adminCurrencyController.js';
import { protect, superAdminOnly } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

// Currencies CRUD
router.get('/', requirePermission('payments.view'), getAllCurrencies);
router.post('/', requirePermission('payments.configure'), createCurrency);
router.put('/:id', requirePermission('payments.configure'), updateCurrency);

// Exchange rates & Live sync
router.get('/rates/all', requirePermission('payments.view'), getExchangeRatesAdmin);
router.post('/rates/sync', requirePermission('payments.configure'), syncExchangeRates);
router.put('/rates/manual', requirePermission('payments.configure'), setManualRate);
router.get('/rates/history', requirePermission('payments.view'), getExchangeRateHistory);

// Exchange rate providers
router.get('/providers', requirePermission('payments.view'), getExchangeRateProviders);
router.put('/providers/:key', superAdminOnly, updateExchangeRateProvider);

// Conversion rules & margins
router.get('/conversion-rules', requirePermission('payments.view'), getConversionRules);
router.post('/conversion-rules', requirePermission('payments.configure'), createConversionRule);
router.delete('/conversion-rules/:id', requirePermission('payments.configure'), deleteConversionRule);

// Gateway currency configurations
router.get('/gateways', requirePermission('payments.view'), getGatewayCurrencyConfigs);
router.put('/gateways/:gatewayKey', requirePermission('payments.configure'), updateGatewayCurrencyConfig);

// Product currency price overrides
router.get('/products/:productId/prices', requirePermission('products.view'), getProductCurrencyPrices);
router.post('/products/:productId/prices', requirePermission('products.update'), saveProductCurrencyPrice);

// Financial reporting
router.get('/reports', requirePermission('reports_analytics.view'), getFinancialReports);

export default router;

