import mongoose from 'mongoose';

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage',
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    maxDiscountAmount: {
      type: Number,
      default: 0, // 0 means no cap
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    usageLimit: {
      type: Number,
      default: 1000,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

couponSchema.methods.isValid = function (subtotal) {
  if (!this.isActive) return { valid: false, message: 'Coupon is inactive' };
  const now = new Date();
  if (this.expiryDate && now > this.expiryDate) {
    return { valid: false, message: 'Coupon has expired' };
  }
  if (this.usageLimit > 0 && this.usageCount >= this.usageLimit) {
    return { valid: false, message: 'Coupon usage limit has been reached' };
  }
  if (subtotal < this.minOrderAmount) {
    return {
      valid: false,
      message: `Minimum order amount of $${this.minOrderAmount.toFixed(2)} required for this coupon`,
    };
  }
  return { valid: true };
};

export default mongoose.model('Coupon', couponSchema);

