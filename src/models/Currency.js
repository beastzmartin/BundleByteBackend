import mongoose from 'mongoose';

const currencySchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      minlength: 3,
      maxlength: 3,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
    },
    symbolPosition: {
      type: String,
      enum: ['prefix', 'suffix'],
      default: 'prefix',
    },
    decimalDigits: {
      type: Number,
      default: 2,
      min: 0,
      max: 4,
    },
    isBase: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    roundingRule: {
      type: String,
      enum: ['none', 'ceil', 'floor', 'round_to_99', 'round_to_00'],
      default: 'none',
    },
    allowedGateways: {
      type: [String],
      default: ['paytm', 'binance', 'wallet', 'upi'],
    },
    flagEmoji: {
      type: String,
      default: '',
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

currencySchema.index({ isBase: 1, isEnabled: 1 });

export default mongoose.model('Currency', currencySchema);

