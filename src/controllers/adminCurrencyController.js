import Currency from '../models/Currency.js';
import ExchangeRate from '../models/ExchangeRate.js';
import ExchangeRateProvider from '../models/ExchangeRateProvider.js';
import ExchangeRateHistory from '../models/ExchangeRateHistory.js';
import ConversionRule from '../models/ConversionRule.js';
import GatewayCurrencyConfig from '../models/GatewayCurrencyConfig.js';
import ProductCurrencyPrice from '../models/ProductCurrencyPrice.js';
import Order from '../models/Order.js';
import exchangeRateService from '../services/currency/exchangeRateService.js';
import financialReportService from '../services/currency/financialReportService.js';

/**
 * List all currencies (admin view)
 */
export const getAllCurrencies = async (req, res, next) => {
  try {
    const currencies = await Currency.find().sort({ sortOrder: 1, isBase: -1, code: 1 });
    res.status(200).json({ success: true, data: currencies });
  } catch (err) {
    next(err);
  }
};

/**
 * Create new currency
 */
export const createCurrency = async (req, res, next) => {
  try {
    const {
      code,
      name,
      symbol,
      symbolPosition = 'prefix',
      decimalDigits = 2,
      roundingRule = 'none',
      allowedGateways = ['paytm', 'binance', 'wallet'],
      flagEmoji = '',
      sortOrder = 0,
      initialRateAgainstBase = 0,
    } = req.body;

    const curCode = code.toUpperCase().trim();
    const existing = await Currency.findOne({ code: curCode });
    if (existing) {
      return res.status(400).json({ success: false, message: `Currency ${curCode} already exists` });
    }

    const currency = await Currency.create({
      code: curCode,
      name,
      symbol,
      symbolPosition,
      decimalDigits: parseInt(decimalDigits) || 2,
      roundingRule,
      allowedGateways,
      flagEmoji,
      sortOrder: parseInt(sortOrder) || 0,
      isBase: false,
      isEnabled: true,
    });

    // If initial rate provided, initialize it
    if (initialRateAgainstBase > 0) {
      await exchangeRateService.setManualRate(
        curCode,
        initialRateAgainstBase,
        2.0,
        req.user?._id,
        'Initial currency registration'
      );
    } else {
      // Sync rates from provider
      await exchangeRateService.syncExchangeRates();
    }

    res.status(201).json({ success: true, message: `Currency ${curCode} created`, data: currency });
  } catch (err) {
    next(err);
  }
};

/**
 * Update currency settings
 */
export const updateCurrency = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      name,
      symbol,
      symbolPosition,
      decimalDigits,
      isEnabled,
      isDefault,
      roundingRule,
      allowedGateways,
      flagEmoji,
      sortOrder,
    } = req.body;

    const currency = await Currency.findById(id);
    if (!currency) {
      return res.status(404).json({ success: false, message: 'Currency not found' });
    }

    // Do not allow disabling base currency
    if (currency.isBase && isEnabled === false) {
      return res.status(400).json({ success: false, message: 'Base currency cannot be disabled' });
    }

    if (name !== undefined) currency.name = name;
    if (symbol !== undefined) currency.symbol = symbol;
    if (symbolPosition !== undefined) currency.symbolPosition = symbolPosition;
    if (decimalDigits !== undefined) currency.decimalDigits = parseInt(decimalDigits);
    if (isEnabled !== undefined) currency.isEnabled = isEnabled;
    if (roundingRule !== undefined) currency.roundingRule = roundingRule;
    if (allowedGateways !== undefined) currency.allowedGateways = allowedGateways;
    if (flagEmoji !== undefined) currency.flagEmoji = flagEmoji;
    if (sortOrder !== undefined) currency.sortOrder = parseInt(sortOrder);

    if (isDefault) {
      // Unset previous default
      await Currency.updateMany({ isDefault: true }, { isDefault: false });
      currency.isDefault = true;
    }

    await currency.save();

    res.status(200).json({ success: true, message: `Currency ${currency.code} updated`, data: currency });
  } catch (err) {
    next(err);
  }
};

/**
 * Get detailed exchange rates (admin view)
 */
export const getExchangeRatesAdmin = async (req, res, next) => {
  try {
    const baseCurDoc = (await Currency.findOne({ isBase: true })) || { code: 'INR' };
    const rates = await ExchangeRate.find().sort({ targetCurrency: 1 });

    res.status(200).json({
      success: true,
      data: {
        baseCurrency: baseCurDoc.code,
        rates,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Trigger live exchange rate synchronization
 */
export const syncExchangeRates = async (req, res, next) => {
  try {
    const { providerKey } = req.body;
    const result = await exchangeRateService.syncExchangeRates(providerKey, req.user?._id);

    res.status(200).json({
      success: true,
      message: `Exchange rates synchronized successfully via ${result.provider}`,
      data: result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Set manual exchange rate override
 */
export const setManualRate = async (req, res, next) => {
  try {
    const { targetCurrency, rateInverse, marginPercentage = 0, reason } = req.body;

    if (!targetCurrency || !rateInverse) {
      return res.status(400).json({
        success: false,
        message: 'targetCurrency and rateInverse (e.g. 1 USD = 88.50 INR) are required',
      });
    }

    const updated = await exchangeRateService.setManualRate(
      targetCurrency,
      rateInverse,
      marginPercentage,
      req.user?._id,
      reason || 'Administrator manual override'
    );

    res.status(200).json({
      success: true,
      message: `Manual rate for ${targetCurrency.toUpperCase()} updated successfully`,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get exchange rate audit history
 */
export const getExchangeRateHistory = async (req, res, next) => {
  try {
    const { currency, limit = 50 } = req.query;
    const filter = {};
    if (currency) filter.targetCurrency = currency.toUpperCase();

    const history = await ExchangeRateHistory.find(filter)
      .populate('changedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({ success: true, data: history });
  } catch (err) {
    next(err);
  }
};

/**
 * Get exchange rate providers
 */
export const getExchangeRateProviders = async (req, res, next) => {
  try {
    const providers = await ExchangeRateProvider.find().sort({ priority: 1 });
    // Mask API keys for security
    const masked = providers.map((p) => {
      const obj = p.toObject();
      if (obj.apiKey) {
        obj.apiKeyMasked = `${obj.apiKey.substring(0, 4)}••••••••${obj.apiKey.slice(-4)}`;
        delete obj.apiKey;
      }
      return obj;
    });

    res.status(200).json({ success: true, data: masked });
  } catch (err) {
    next(err);
  }
};

/**
 * Update exchange rate provider configuration
 */
export const updateExchangeRateProvider = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { isActive, priority, apiKey, apiEndpoint, syncIntervalMinutes } = req.body;

    const provider = await ExchangeRateProvider.findOne({ providerKey: key });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Provider not found' });
    }

    if (isActive !== undefined) {
      if (isActive) {
        // Set this provider as active
        await ExchangeRateProvider.updateMany({}, { isActive: false });
        provider.isActive = true;
      } else {
        provider.isActive = false;
      }
    }

    if (priority !== undefined) provider.priority = parseInt(priority);
    if (apiKey !== undefined && apiKey.trim()) provider.apiKey = apiKey.trim();
    if (apiEndpoint !== undefined) provider.apiEndpoint = apiEndpoint.trim();
    if (syncIntervalMinutes !== undefined) provider.syncIntervalMinutes = parseInt(syncIntervalMinutes);

    await provider.save();

    res.status(200).json({ success: true, message: `Provider ${provider.name} updated`, data: provider });
  } catch (err) {
    next(err);
  }
};

/**
 * Get conversion rules / margins
 */
export const getConversionRules = async (req, res, next) => {
  try {
    const rules = await ConversionRule.find().populate('product', 'title').sort({ priority: -1, createdAt: -1 });
    res.status(200).json({ success: true, data: rules });
  } catch (err) {
    next(err);
  }
};

/**
 * Create conversion rule
 */
export const createConversionRule = async (req, res, next) => {
  try {
    const { name, scope, targetCurrency, gatewayKey, productId, marginPercentage, fixedCharge, priority, description } = req.body;

    const rule = await ConversionRule.create({
      name,
      scope,
      targetCurrency: targetCurrency ? targetCurrency.toUpperCase() : '',
      gatewayKey: gatewayKey || '',
      product: productId || null,
      marginPercentage: parseFloat(marginPercentage) || 0,
      fixedCharge: parseFloat(fixedCharge) || 0,
      priority: parseInt(priority) || 0,
      description: description || '',
      isActive: true,
    });

    // Re-sync effective rates
    await exchangeRateService.syncExchangeRates();

    res.status(201).json({ success: true, message: 'Conversion rule created', data: rule });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete conversion rule
 */
export const deleteConversionRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    await ConversionRule.findByIdAndDelete(id);

    // Re-sync effective rates
    await exchangeRateService.syncExchangeRates();

    res.status(200).json({ success: true, message: 'Conversion rule removed' });
  } catch (err) {
    next(err);
  }
};

/**
 * Get gateway currency configurations
 */
export const getGatewayCurrencyConfigs = async (req, res, next) => {
  try {
    const configs = await GatewayCurrencyConfig.find().sort({ gatewayKey: 1 });
    res.status(200).json({ success: true, data: configs });
  } catch (err) {
    next(err);
  }
};

/**
 * Update gateway currency configuration
 */
export const updateGatewayCurrencyConfig = async (req, res, next) => {
  try {
    const { gatewayKey } = req.params;
    const {
      supportedCurrencies,
      settlementCurrency,
      processingCurrency,
      requiresConversion,
      percentageFee,
      fixedFee,
      minTransactionAmount,
      maxTransactionAmount,
      isEnabled,
      notes,
    } = req.body;

    const config = await GatewayCurrencyConfig.findOneAndUpdate(
      { gatewayKey },
      {
        $set: {
          supportedCurrencies,
          settlementCurrency,
          processingCurrency,
          requiresConversion,
          percentageFee: parseFloat(percentageFee) || 0,
          fixedFee: parseFloat(fixedFee) || 0,
          minTransactionAmount: parseFloat(minTransactionAmount) || 1,
          maxTransactionAmount: parseFloat(maxTransactionAmount) || 10000000,
          isEnabled,
          notes,
        },
      },
      { new: true, upsert: true }
    );

    res.status(200).json({ success: true, message: `Gateway config for ${gatewayKey} updated`, data: config });
  } catch (err) {
    next(err);
  }
};

/**
 * Get manual product currency prices
 */
export const getProductCurrencyPrices = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const prices = await ProductCurrencyPrice.find({ product: productId }).sort({ currency: 1, duration: 1 });
    res.status(200).json({ success: true, data: prices });
  } catch (err) {
    next(err);
  }
};

/**
 * Save manual product currency price
 */
export const saveProductCurrencyPrice = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const { currency, duration, manualPrice, manualOriginalPrice } = req.body;

    const curCode = currency.toUpperCase().trim();

    const priceDoc = await ProductCurrencyPrice.findOneAndUpdate(
      { product: productId, currency: curCode, duration },
      {
        $set: {
          manualPrice: parseFloat(manualPrice),
          manualOriginalPrice: parseFloat(manualOriginalPrice) || parseFloat(manualPrice),
          isManual: true,
        },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      success: true,
      message: `Manual price for ${curCode} (${duration}) updated`,
      data: priceDoc,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Financial Reports by Currency
 */
export const getFinancialReports = async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await financialReportService.getCurrencyFinancialReport({ startDate, endDate });
    res.status(200).json({ success: true, data: report });
  } catch (err) {
    next(err);
  }
};

