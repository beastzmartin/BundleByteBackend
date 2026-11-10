import mongoose from 'mongoose';

const licenseInventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },
    durationType: {
      type: String,
      default: 'any',
      index: true,
    },
    planId: {
      type: String,
      default: '',
      index: true,
    },
    validityDuration: {
      value: { type: Number, default: 0 },
      unit: { type: String, enum: ['hours', 'days', 'weeks', 'months', 'years', 'lifetime', ''], default: '' },
    },
    licenseKey: {
      type: String,
      default: '',
      index: true,
    },
    accountCredentials: {
      username: { type: String, default: '' },
      password: { type: String, default: '' },
      recoveryInfo: { type: String, default: '' },
    },
    accessLink: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['Available', 'Reserved', 'Sold', 'Disabled', 'Expired'],
      default: 'Available',
      index: true,
    },
    // Backwards-compatible flag
    isAllocated: {
      type: Boolean,
      default: false,
      index: true,
    },
    allocatedToOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
    },
    allocatedToUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    allocatedAt: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    batchId: {
      type: String,
      default: '',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Auto-sync status and isAllocated
licenseInventorySchema.pre('save', function (next) {
  if (this.status === 'Sold') {
    this.isAllocated = true;
  } else if (this.status === 'Available') {
    this.isAllocated = false;
  }
  next();
});

licenseInventorySchema.index({ product: 1, status: 1 });
licenseInventorySchema.index({ product: 1, isAllocated: 1 });
licenseInventorySchema.index({ status: 1, expiryDate: 1 });

export default mongoose.model('LicenseInventory', licenseInventorySchema);
