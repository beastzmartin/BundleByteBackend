import mongoose from 'mongoose';

const exchangeRateSchema = new mongoose.Schema(
  {
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
      default: 'INR',
      index: true,
    },
    targetCurrency: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    // Raw provider rate (e.g. 1 Base = X Target)
    providerRate: {
      type: Number,
      required: true,
      min: 0,
    },
    // Rate of 1 Target in Base currency (e.g. 1 USD = 88.50 INR)
    rateInverse: {
      type: Number,
      required: true,
      min: 0,
    },
    // Margin percentage applied on conversion (e.g. 2.0 = 2%)
    marginPercentage: {
      type: Number,
      default: 0,
    },
    // Fixed fee added on conversion
    fixedMargin: {
      type: Number,
      default: 0,
    },
    // Final effective rate after margin
    effectiveRate: {
      type: Number,
      required: true,
      min: 0,
    },
    provider: {
      type: String,
      enum: ['exchangerate_api', 'open_exchange_rates', 'currencylayer', 'manual', 'fallback'],
      default: 'fallback',
    },
    isManual: {
      type: Boolean,
      default: false,
    },
    isStale: {
      type: Boolean,
      default: false,
    },
    maxAgeHours: {
      type: Number,
      default: 24,
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
      index: true,
    },
    previousRate: {
      type: Number,
      default: 0,
    },
    rateChangePercent: {
      type: Number,
      default: 0,
    },
    syncStatus: {
      type: String,
      enum: ['synced', 'manual', 'stale', 'error'],
      default: 'synced',
    },
  },
  {
    timestamps: true,
  }
);

exchangeRateSchema.index({ baseCurrency: 1, targetCurrency: 1 }, { unique: true });

export default mongoose.model('ExchangeRate', exchangeRateSchema);

