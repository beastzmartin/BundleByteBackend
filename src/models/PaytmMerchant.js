import mongoose from 'mongoose';

const paytmMerchantSchema = new mongoose.Schema(
  {
    merchantName: {
      type: String,
      required: [true, 'Merchant name is required'],
      trim: true,
    },
    mid: {
      type: String,
      required: [true, 'Merchant ID (MID) is required'],
      unique: true,
      trim: true,
      index: true,
    },
    merchantKey: {
      type: String,
      required: [true, 'Merchant Key is required'],
      select: false, // Never returned by default to prevent leakage
    },
    upiId: {
      type: String,
      required: [true, 'Merchant UPI ID (VPA) is required'],
      trim: true,
    },
    websiteName: {
      type: String,
      default: 'DEFAULT',
      trim: true,
    },
    industryType: {
      type: String,
      default: 'Retail',
      trim: true,
    },
    channelId: {
      type: String,
      default: 'WEB',
      trim: true,
    },
    environment: {
      type: String,
      enum: ['production', 'staging'],
      default: 'production',
    },
    status: {
      type: String,
      enum: ['active', 'disabled'],
      default: 'active',
      index: true,
    },
    priority: {
      type: Number,
      default: 1, // 1 is highest priority
      index: true,
    },
    minAmount: {
      type: Number,
      default: 1, // Minimum transaction amount in INR
    },
    maxAmount: {
      type: Number,
      default: 100000, // Maximum transaction amount in INR
    },
    dailyLimit: {
      type: Number,
      default: 100000, // Maximum daily transaction volume in INR
    },
    currentDailyVolume: {
      type: Number,
      default: 0,
    },
    dailyVolumeResetDate: {
      type: Date,
      default: Date.now,
    },
    totalTransactions: {
      type: Number,
      default: 0,
    },
    successfulTransactions: {
      type: Number,
      default: 0,
    },
    failedTransactions: {
      type: Number,
      default: 0,
    },
    lastUsedAt: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      default: '',
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for success rate calculation
paytmMerchantSchema.virtual('successRate').get(function () {
  if (!this.totalTransactions || this.totalTransactions === 0) return 100;
  return Math.round((this.successfulTransactions / this.totalTransactions) * 100);
});

// Helper to check and reset daily volume if date has rolled over
paytmMerchantSchema.methods.checkAndResetDailyVolume = function () {
  const now = new Date();
  const lastReset = this.dailyVolumeResetDate ? new Date(this.dailyVolumeResetDate) : new Date(0);

  // Compare year, month, and day in UTC
  const isSameDay =
    now.getUTCFullYear() === lastReset.getUTCFullYear() &&
    now.getUTCMonth() === lastReset.getUTCMonth() &&
    now.getUTCDate() === lastReset.getUTCDate();

  if (!isSameDay) {
    this.currentDailyVolume = 0;
    this.dailyVolumeResetDate = now;
  }
};

export default mongoose.model('PaytmMerchant', paytmMerchantSchema);

