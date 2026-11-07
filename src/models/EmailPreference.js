import mongoose from 'mongoose';

const emailPreferenceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    orderUpdates: {
      type: Boolean,
      default: true,
    },
    deliveryNotifications: {
      type: Boolean,
      default: true,
    },
    invoiceReceipts: {
      type: Boolean,
      default: true,
    },
    subscriptionReminders: {
      type: Boolean,
      default: true,
    },
    securityAlerts: {
      type: Boolean,
      default: true, // Core security alerts are always on
    },
    marketingPromotions: {
      type: Boolean,
      default: true,
    },
    newsletter: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('EmailPreference', emailPreferenceSchema);
