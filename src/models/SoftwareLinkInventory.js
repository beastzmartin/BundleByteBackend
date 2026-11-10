import mongoose from 'mongoose';

const softwareLinkInventorySchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'Associated product is required'],
      index: true,
    },
    variant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProductVariant',
      default: null,
    },
    title: {
      type: String,
      required: [true, 'Link title or label is required'],
      trim: true,
    },
    planType: {
      type: String,
      default: 'any', // Matches durationType or custom plan id (e.g. '24_hours', '7_days', 'any')
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
    linkType: {
      type: String,
      enum: [
        'direct_download',
        'activation_portal',
        'workspace_invite',
        'setup_guide',
        'cloud_drive',
      ],
      default: 'direct_download',
      index: true,
    },
    url: {
      type: String,
      required: [true, 'Target URL or access endpoint is required'],
      trim: true,
    },
    backupUrl: {
      type: String,
      default: '',
      trim: true,
    },
    installationInstructions: {
      type: String,
      default: 'Click the link to download or redeem your software access. Follow the provided setup instructions.',
    },
    maxAccessCount: {
      type: Number,
      default: 0, // 0 = unlimited
    },
    currentAccessCount: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['Available', 'Reserved', 'Sold', 'Disabled', 'Expired'],
      default: 'Available',
      index: true,
    },
    allocatedToOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      default: null,
      index: true,
    },
    allocatedToUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    allocatedAt: {
      type: Date,
      default: null,
    },
    batchId: {
      type: String,
      default: '',
      index: true,
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

softwareLinkInventorySchema.index({ product: 1, status: 1 });

export default mongoose.model('SoftwareLinkInventory', softwareLinkInventorySchema);
