import mongoose from 'mongoose';

const exchangeRateHistorySchema = new mongoose.Schema(
  {
    baseCurrency: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    targetCurrency: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    oldRate: {
      type: Number,
      required: true,
    },
    newRate: {
      type: Number,
      required: true,
    },
    changePercent: {
      type: Number,
      default: 0,
    },
    source: {
      type: String,
      enum: ['auto_sync', 'manual_override', 'fallback'],
      required: true,
    },
    provider: {
      type: String,
      default: 'system',
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Immutable historical record
  }
);

exchangeRateHistorySchema.index({ targetCurrency: 1, createdAt: -1 });

export default mongoose.model('ExchangeRateHistory', exchangeRateHistorySchema);

