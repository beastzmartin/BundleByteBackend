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
import { protect, adminOnly, superAdminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(adminOnly);

// Currencies CRUD
router.get('/', getAllCurrencies);
router.post('/', createCurrency);
router.put('/:id', updateCurrency);

// Exchange rates & Live sync
router.get('/rates/all', getExchangeRatesAdmin);
router.post('/rates/sync', syncExchangeRates);
router.put('/rates/manual', setManualRate);
router.get('/rates/history', getExchangeRateHistory);

// Exchange rate providers
router.get('/providers', getExchangeRateProviders);
router.put('/providers/:key', superAdminOnly, updateExchangeRateProvider);

// Conversion rules & margins
router.get('/conversion-rules', getConversionRules);
router.post('/conversion-rules', createConversionRule);
router.delete('/conversion-rules/:id', deleteConversionRule);

// Gateway currency configurations
router.get('/gateways', getGatewayCurrencyConfigs);
router.put('/gateways/:gatewayKey', updateGatewayCurrencyConfig);

// Product currency price overrides
router.get('/products/:productId/prices', getProductCurrencyPrices);
router.post('/products/:productId/prices', saveProductCurrencyPrice);

// Financial reporting
router.get('/reports', getFinancialReports);

export default router;

