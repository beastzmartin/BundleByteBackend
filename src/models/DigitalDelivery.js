import mongoose from 'mongoose';

const digitalDeliverySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    productTitle: {
      type: String,
      required: true,
    },
    productLogo: {
      type: String,
      default: '',
    },
    duration: {
      type: String,
      required: true,
    },
    deliveryType: {
      type: String,
      enum: [
        'instant_automated',
        'admin_assisted',
        'account_credentials',
        'license_key',
        'activation_code',
        'access_link',
        'whatsapp_manual',
      ],
      default: 'instant_automated',
    },
    deliveryMethod: {
      type: String,
      enum: ['automatic', 'manual', 'hybrid', 'whatsapp_manual'],
      default: 'automatic',
      index: true,
    },
    deliveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    redeliveryCount: {
      type: Number,
      default: 0,
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    orderItemIndex: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['delivered', 'pending_manual_review', 'revoked'],
      default: 'delivered',
      index: true,
    },
    // The secure credentials / keys delivered to customer
    keys: {
      type: [String],
      default: [],
    },
    payload: {
      licenseKey: { type: String, default: '' },
      accountCredentials: {
        username: { type: String, default: '' },
        password: { type: String, default: '' },
        recoveryInfo: { type: String, default: '' },
      },
      accessLink: { type: String, default: '' },
      directDownloadUrl: { type: String, default: '' },
      instructions: { type: String, default: '' },
      activationProcess: { type: String, default: '' },
      orderNote: { type: String, default: '' },
    },
    deliveredAt: {
      type: Date,
      default: Date.now,
    },
    accessCount: {
      type: Number,
      default: 0,
    },
    lastAccessedAt: {
      type: Date,
      default: null,
    },
    adminNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('DigitalDelivery', digitalDeliverySchema);

