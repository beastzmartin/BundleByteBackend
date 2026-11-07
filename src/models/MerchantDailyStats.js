import mongoose from 'mongoose';

const merchantDailyStatsSchema = new mongoose.Schema(
  {
    merchant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaytmMerchant',
      required: true,
      index: true,
    },
    dateString: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      index: true,
    },
    totalVolume: {
      type: Number,
      default: 0,
    },
    successfulCount: {
      type: Number,
      default: 0,
    },
    failedCount: {
      type: Number,
      default: 0,
    },
    pendingCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

merchantDailyStatsSchema.index({ merchant: 1, dateString: 1 }, { unique: true });

export default mongoose.model('MerchantDailyStats', merchantDailyStatsSchema);

