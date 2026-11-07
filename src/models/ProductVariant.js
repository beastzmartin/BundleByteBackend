import mongoose from 'mongoose';

const productVariantSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true, // e.g. "Single User", "Family / Team 5 Users", "Enterprise"
      trim: true,
    },
    sku: {
      type: String,
      unique: true,
      sparse: true,
    },
    priceModifier: {
      type: Number,
      default: 0, // added or subtracted relative to base duration price
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    stockCount: {
      type: Number,
      default: -1,
    },
    features: [String],
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('ProductVariant', productVariantSchema);

