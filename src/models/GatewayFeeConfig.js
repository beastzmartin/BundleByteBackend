import mongoose from 'mongoose';

const methodFeeSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ['upi', 'card_debit', 'card_credit', 'netbanking', 'wallet', 'crypto', 'all'],
      default: 'all',
    },
    percentageFee: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    fixedFee: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const gatewayFeeConfigSchema = new mongoose.Schema(
  {
    gatewayKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    gatewayName: {
      type: String,
      required: true,
      trim: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
    },
    feeType: {
      type: String,
      enum: ['percentage', 'fixed', 'hybrid'],
      default: 'percentage',
    },
    percentageFee: {
      type: Number,
      default: 2.0,
      min: 0,
      max: 100,
    },
    fixedFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    minFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxFee: {
      type: Number,
      default: 0, // 0 = no cap
      min: 0,
    },
    feeGstRate: {
      type: Number,
      default: 18, // 18% GST on payment aggregator processing services
      enum: [0, 5, 12, 18, 28],
    },
    feePayer: {
      type: String,
      enum: ['merchant_absorb', 'customer_pay'],
      default: 'merchant_absorb',
    },
    methodFees: [methodFeeSchema],
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    minTransactionAmount: {
      type: Number,
      default: 0,
    },
    maxTransactionAmount: {
      type: Number,
      default: 10000000,
    },
    roundingRule: {
      type: String,
      enum: ['round_half_up', 'round_to_rupee', 'none'],
      default: 'round_half_up',
    },
    notes: {
      type: String,
      default: '',
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('GatewayFeeConfig', gatewayFeeConfigSchema);
