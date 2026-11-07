import mongoose from 'mongoose';

const conversionRuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    scope: {
      type: String,
      enum: ['global', 'currency', 'gateway', 'product'],
      required: true,
      index: true,
    },
    targetCurrency: {
      type: String,
      uppercase: true,
      default: '',
    },
    gatewayKey: {
      type: String,
      default: '',
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    marginPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    fixedCharge: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

conversionRuleSchema.index({ scope: 1, isActive: 1, priority: -1 });

export default mongoose.model('ConversionRule', conversionRuleSchema);

