import mongoose from 'mongoose';

const productCurrencyPriceSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    currency: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    duration: {
      type: String,
      enum: ['monthly', 'quarterly', 'half_yearly', 'annual', 'lifetime'],
      required: true,
    },
    manualPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    manualOriginalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    isManual: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productCurrencyPriceSchema.index({ product: 1, currency: 1, duration: 1 }, { unique: true });

export default mongoose.model('ProductCurrencyPrice', productCurrencyPriceSchema);

