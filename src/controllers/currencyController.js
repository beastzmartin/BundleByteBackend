import Currency from '../models/Currency.js';
import ExchangeRate from '../models/ExchangeRate.js';
import CurrencyQuote from '../models/CurrencyQuote.js';
import exchangeRateService from '../services/currency/exchangeRateService.js';
import pricingEngine from '../services/currency/pricingEngine.js';

/**
 * Public: List all enabled currencies
 */
export const getPublicCurrencies = async (req, res, next) => {
  try {
    const currencies = await Currency.find({ isEnabled: true }).sort({ sortOrder: 1, code: 1 });
    const baseCurrency = currencies.find((c) => c.isBase) || currencies[0] || { code: 'INR' };
    const defaultCurrency = currencies.find((c) => c.isDefault) || baseCurrency;

    res.status(200).json({
      success: true,
      data: {
        baseCurrency: baseCurrency.code,
        defaultCurrency: defaultCurrency.code,
        currencies: currencies.map((c) => ({
          code: c.code,
          name: c.name,
          symbol: c.symbol,
          symbolPosition: c.symbolPosition,
          decimalDigits: c.decimalDigits,
          isBase: c.isBase,
          flagEmoji: c.flagEmoji,
          allowedGateways: c.allowedGateways,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Public: Get active exchange rates against base currency
 */
export const getPublicExchangeRates = async (req, res, next) => {
  try {
    const baseCurDoc = (await Currency.findOne({ isBase: true })) || { code: 'INR' };
    const rates = await ExchangeRate.find({ baseCurrency: baseCurDoc.code });

    const ratesMap = {};
    rates.forEach((r) => {
      ratesMap[r.targetCurrency] = {
        rate: r.effectiveRate,
        rawRate: r.providerRate,
        rateInverse: r.rateInverse,
        isStale: r.isStale,
        lastUpdated: r.lastUpdated,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        baseCurrency: baseCurDoc.code,
        rates: ratesMap,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Public: Convert an amount between two currencies
 */
export const convertCurrency = async (req, res, next) => {
  try {
    const { amount, from = 'INR', to = 'USD' } = req.query;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      return res.status(400).json({ success: false, message: 'Invalid amount provided' });
    }

    const rateInfo = await exchangeRateService.getExchangeRate(from, to);
    const toCurrencyDoc = (await Currency.findOne({ code: to.toUpperCase() })) || {
      decimalDigits: 2,
      roundingRule: 'none',
      symbol: to,
      symbolPosition: 'prefix',
    };

    const rawConverted = numAmount * rateInfo.effectiveRate;
    const finalConverted = exchangeRateService.applyRoundingRule(
      rawConverted,
      toCurrencyDoc.roundingRule,
      toCurrencyDoc.decimalDigits
    );

    res.status(200).json({
      success: true,
      data: {
        from: from.toUpperCase(),
        to: to.toUpperCase(),
        inputAmount: numAmount,
        convertedAmount: finalConverted,
        rate: rateInfo.effectiveRate,
        rateInverse: rateInfo.rateInverse,
        marginPercentage: rateInfo.marginPercentage || 0,
        isStale: rateInfo.isStale,
        formatted: `${toCurrencyDoc.symbolPosition === 'prefix' ? toCurrencyDoc.symbol : ''}${finalConverted.toFixed(toCurrencyDoc.decimalDigits)}${toCurrencyDoc.symbolPosition === 'suffix' ? ' ' + toCurrencyDoc.symbol : ''}`,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Public/Auth: Generate a locked 15-minute checkout quote
 */
export const createCheckoutQuote = async (req, res, next) => {
  try {
    const { items, customerCurrency = 'INR', paymentGateway = 'paytm', coupon = null } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart items are required to create a quote' });
    }

    const quote = await pricingEngine.createCheckoutQuote({
      items,
      customerCurrency,
      paymentGateway,
      user: req.user || null,
      coupon,
    });

    res.status(200).json({
      success: true,
      message: 'Currency exchange quote generated and locked for 15 minutes',
      data: quote,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Public/Auth: Get active checkout quote
 */
export const getCheckoutQuote = async (req, res, next) => {
  try {
    const { quoteId } = req.params;
    const quote = await CurrencyQuote.findOne({ quoteId });

    if (!quote) {
      return res.status(404).json({ success: false, message: 'Quote not found' });
    }

    const now = new Date();
    const isExpired = quote.expiresAt < now;
    const remainingSeconds = Math.max(0, Math.floor((quote.expiresAt.getTime() - now.getTime()) / 1000));

    res.status(200).json({
      success: true,
      data: {
        ...quote.toObject(),
        isExpired,
        remainingSeconds,
      },
    });
  } catch (err) {
    next(err);
  }
};

