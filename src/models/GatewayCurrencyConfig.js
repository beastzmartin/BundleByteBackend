import mongoose from 'mongoose';

const gatewayCurrencyConfigSchema = new mongoose.Schema(
  {
    gatewayKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    gatewayName: {
      type: String,
      required: true,
    },
    supportedCurrencies: {
      type: [String],
      required: true,
      default: ['INR'],
    },
    settlementCurrency: {
      type: String,
      required: true,
      default: 'INR',
    },
    processingCurrency: {
      type: String,
      required: true,
      default: 'INR',
    },
    requiresConversion: {
      type: Boolean,
      default: true,
    },
    percentageFee: {
      type: Number,
      default: 0, // e.g. 1.8% gateway transaction fee
      min: 0,
      max: 100,
    },
    fixedFee: {
      type: Number,
      default: 0, // e.g. $0.30 or ₹15 fixed fee
      min: 0,
    },
    minTransactionAmount: {
      type: Number,
      default: 1,
    },
    maxTransactionAmount: {
      type: Number,
      default: 10000000,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('GatewayCurrencyConfig', gatewayCurrencyConfigSchema);

