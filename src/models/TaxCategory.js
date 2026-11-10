import mongoose from 'mongoose';

const taxCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    hsnSacCode: {
      type: String,
      required: true,
      trim: true,
      default: '998434',
    },
    gstRate: {
      type: Number,
      required: true,
      enum: [0, 5, 12, 18, 28],
      default: 18,
    },
    description: {
      type: String,
      default: '',
    },
    isExempt: {
      type: Boolean,
      default: false,
    },
    exemptionReason: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('TaxCategory', taxCategorySchema);
