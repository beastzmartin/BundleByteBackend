import mongoose from 'mongoose';

const exchangeRateProviderSchema = new mongoose.Schema(
  {
    providerKey: {
      type: String,
      required: true,
      unique: true,
      enum: ['exchangerate_api', 'open_exchange_rates', 'currencylayer', 'manual'],
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: Number,
      default: 1,
    },
    apiKey: {
      type: String,
      default: '',
    },
    apiEndpoint: {
      type: String,
      default: '',
    },
    syncIntervalMinutes: {
      type: Number,
      default: 60, // hourly by default
      min: 5,
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    lastSyncStatus: {
      type: String,
      enum: ['success', 'failed', 'idle'],
      default: 'idle',
    },
    lastError: {
      type: String,
      default: '',
    },
    ratesCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('ExchangeRateProvider', exchangeRateProviderSchema);

