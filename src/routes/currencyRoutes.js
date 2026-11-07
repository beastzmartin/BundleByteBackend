import express from 'express';
import {
  getPublicCurrencies,
  getPublicExchangeRates,
  convertCurrency,
  createCheckoutQuote,
  getCheckoutQuote,
} from '../controllers/currencyController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getPublicCurrencies);
router.get('/rates', getPublicExchangeRates);
router.get('/convert', convertCurrency);
router.post('/quote', optionalAuth, createCheckoutQuote);
router.get('/quote/:quoteId', getCheckoutQuote);

export default router;

