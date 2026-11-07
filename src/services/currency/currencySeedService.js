import Currency from '../../models/Currency.js';
import ExchangeRate from '../../models/ExchangeRate.js';
import ExchangeRateProvider from '../../models/ExchangeRateProvider.js';
import ConversionRule from '../../models/ConversionRule.js';
import GatewayCurrencyConfig from '../../models/GatewayCurrencyConfig.js';
import ExchangeRateHistory from '../../models/ExchangeRateHistory.js';

export const INITIAL_CURRENCIES = [
  {
    code: 'INR',
    name: 'Indian Rupee',
    symbol: '₹',
    symbolPosition: 'prefix',
    decimalDigits: 2,
    isBase: true,
    isDefault: true,
    isEnabled: true,
    flagEmoji: '🇮🇳',
    allowedGateways: ['paytm', 'binance', 'wallet', 'upi'],
    sortOrder: 1,
  },
  {
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    symbolPosition: 'prefix',
    decimalDigits: 2,
    isBase: false,
    isDefault: false,
    isEnabled: true,
    flagEmoji: '🇺🇸',
    allowedGateways: ['binance', 'paytm', 'wallet'],
    sortOrder: 2,
  },
  {
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    symbolPosition: 'prefix',
    decimalDigits: 2,
    isBase: false,
    isDefault: false,
    isEnabled: true,
    flagEmoji: '🇪🇺',
    allowedGateways: ['binance', 'paytm', 'wallet'],
    sortOrder: 3,
  },
  {
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    symbolPosition: 'prefix',
    decimalDigits: 2,
    isBase: false,
    isDefault: false,
    isEnabled: true,
    flagEmoji: '🇬🇧',
    allowedGateways: ['binance', 'paytm', 'wallet'],
    sortOrder: 4,
  },
  {
    code: 'AED',
    name: 'UAE Dirham',
    symbol: 'AED ',
    symbolPosition: 'prefix',
    decimalDigits: 2,
    isBase: false,
    isDefault: false,
    isEnabled: true,
    flagEmoji: '🇦🇪',
    allowedGateways: ['binance', 'paytm', 'wallet'],
    sortOrder: 5,
  },
  {
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'CA$',
    symbolPosition: 'prefix',
    decimalDigits: 2,
    isBase: false,
    isDefault: false,
    isEnabled: true,
    flagEmoji: '🇨🇦',
    allowedGateways: ['binance', 'paytm', 'wallet'],
    sortOrder: 6,
  },
  {
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'AU$',
    symbolPosition: 'prefix',
    decimalDigits: 2,
    isBase: false,
    isDefault: false,
    isEnabled: true,
    flagEmoji: '🇦🇺',
    allowedGateways: ['binance', 'paytm', 'wallet'],
    sortOrder: 7,
  },
  {
    code: 'SGD',
    name: 'Singapore Dollar',
    symbol: 'SG$',
    symbolPosition: 'prefix',
    decimalDigits: 2,
    isBase: false,
    isDefault: false,
    isEnabled: true,
    flagEmoji: '🇸🇬',
    allowedGateways: ['binance', 'paytm', 'wallet'],
    sortOrder: 8,
  },
];

// Baseline initial rates relative to 1 INR
export const BASELINE_RATES_FROM_INR = {
  INR: { rate: 1.0, inverse: 1.0 },
  USD: { rate: 0.0113, inverse: 88.50 }, // 1 INR = $0.0113 USD; 1 USD = ₹88.50 INR
  EUR: { rate: 0.0108, inverse: 92.60 }, // 1 EUR = ₹92.60 INR
  GBP: { rate: 0.0090, inverse: 111.10 }, // 1 GBP = ₹111.10 INR
  AED: { rate: 0.0415, inverse: 24.10 },  // 1 AED = ₹24.10 INR
  CAD: { rate: 0.0157, inverse: 63.70 },  // 1 CAD = ₹63.70 INR
  AUD: { rate: 0.0175, inverse: 57.14 },  // 1 AUD = ₹57.14 INR
  SGD: { rate: 0.0151, inverse: 66.22 },  // 1 SGD = ₹66.22 INR
};

export const ensureCurrencySystemDefaults = async () => {
  try {
    // 1. Ensure Currencies exist
    for (const cur of INITIAL_CURRENCIES) {
      await Currency.findOneAndUpdate(
        { code: cur.code },
        { $setOnInsert: cur },
        { upsert: true, new: true }
      );
    }

    // 2. Ensure Providers exist
    const defaultProviders = [
      {
        providerKey: 'exchangerate_api',
        name: 'ExchangeRate-API (Live v6)',
        isActive: true,
        priority: 1,
        apiEndpoint: 'https://open.er-api.com/v6/latest',
        syncIntervalMinutes: 60,
      },
      {
        providerKey: 'open_exchange_rates',
        name: 'Open Exchange Rates (Enterprise)',
        isActive: false,
        priority: 2,
        apiEndpoint: 'https://openexchangerates.org/api/latest.json',
        syncIntervalMinutes: 60,
      },
      {
        providerKey: 'currencylayer',
        name: 'CurrencyLayer API',
        isActive: false,
        priority: 3,
        apiEndpoint: 'https://api.currencylayer.com/live',
        syncIntervalMinutes: 120,
      },
      {
        providerKey: 'manual',
        name: 'Manual / Administrator Control',
        isActive: false,
        priority: 4,
      },
    ];

    for (const prov of defaultProviders) {
      await ExchangeRateProvider.findOneAndUpdate(
        { providerKey: prov.providerKey },
        { $setOnInsert: prov },
        { upsert: true, new: true }
      );
    }

    // 3. Ensure Baseline Exchange Rates
    const baseCode = 'INR';
    for (const [targetCode, data] of Object.entries(BASELINE_RATES_FROM_INR)) {
      const existing = await ExchangeRate.findOne({ baseCurrency: baseCode, targetCurrency: targetCode });
      if (!existing) {
        await ExchangeRate.create({
          baseCurrency: baseCode,
          targetCurrency: targetCode,
          providerRate: data.rate,
          rateInverse: data.inverse,
          marginPercentage: targetCode === 'INR' ? 0 : 2.0, // 2% margin on foreign conversions
          fixedMargin: 0,
          effectiveRate: data.rate * (1 - (targetCode === 'INR' ? 0 : 0.02)),
          provider: 'fallback',
          isManual: false,
          isStale: false,
          lastUpdated: new Date(),
          previousRate: data.rate,
          syncStatus: 'synced',
        });
      }
    }

    // 4. Ensure Default Conversion Rule (Global 2% profit margin)
    const existingRule = await ConversionRule.findOne({ scope: 'global' });
    if (!existingRule) {
      await ConversionRule.create({
        name: 'Standard Platform Conversion Margin',
        scope: 'global',
        marginPercentage: 2.0, // 2%
        fixedCharge: 0,
        isActive: true,
        priority: 10,
        description: 'Standard global 2% spread margin on customer currency conversions',
      });
    }

    // 5. Ensure Default Gateway Configurations
    const defaultGatewayConfigs = [
      {
        gatewayKey: 'paytm',
        gatewayName: 'Paytm Merchant Dynamic QR & Gateway',
        supportedCurrencies: ['INR'], // Paytm strictly processes INR
        settlementCurrency: 'INR',
        processingCurrency: 'INR',
        requiresConversion: true,
        percentageFee: 0,
        fixedFee: 0,
        minTransactionAmount: 1,
        maxTransactionAmount: 200000,
        isEnabled: true,
        notes: 'Processes in INR only. Foreign currencies are dynamically quoted and converted to INR before initiating QR transaction.',
      },
      {
        gatewayKey: 'binance',
        gatewayName: 'Binance USDT Crypto Gateway',
        supportedCurrencies: ['USD', 'USDT', 'INR', 'EUR', 'GBP', 'AED'],
        settlementCurrency: 'USDT',
        processingCurrency: 'USDT',
        requiresConversion: true,
        percentageFee: 0.5, // 0.5% crypto processing fee
        fixedFee: 0,
        minTransactionAmount: 1,
        maxTransactionAmount: 1000000,
        isEnabled: true,
        notes: 'Accepts USDT (TRC20 / BEP20). Base INR and foreign orders are converted to equivalent USDT tokens.',
      },
      {
        gatewayKey: 'upi',
        gatewayName: 'Direct UPI & UTR Verification',
        supportedCurrencies: ['INR'],
        settlementCurrency: 'INR',
        processingCurrency: 'INR',
        requiresConversion: true,
        percentageFee: 0,
        fixedFee: 0,
        minTransactionAmount: 1,
        maxTransactionAmount: 100000,
        isEnabled: true,
        notes: 'Direct Indian UPI transfer with UTR reconciliation in INR.',
      },
      {
        gatewayKey: 'wallet',
        gatewayName: 'Customer Store Credit Wallet',
        supportedCurrencies: ['INR', 'USD', 'EUR', 'GBP', 'AED', 'CAD', 'AUD', 'SGD'],
        settlementCurrency: 'INR',
        processingCurrency: 'INR',
        requiresConversion: true,
        percentageFee: 0,
        fixedFee: 0,
        minTransactionAmount: 0.01,
        maxTransactionAmount: 500000,
        isEnabled: true,
        notes: 'Customer wallet ledger kept in INR paise; multi-currency conversions calculated dynamically at locked checkout quote rates.',
      },
    ];

    for (const gConfig of defaultGatewayConfigs) {
      await GatewayCurrencyConfig.findOneAndUpdate(
        { gatewayKey: gConfig.gatewayKey },
        { $setOnInsert: gConfig },
        { upsert: true, new: true }
      );
    }

    console.log('✅ Enterprise Dual-Currency System defaults initialized successfully.');
  } catch (err) {
    console.error('❌ Error initializing currency system defaults:', err);
  }
};

