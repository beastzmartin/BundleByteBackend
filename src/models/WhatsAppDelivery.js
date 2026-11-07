import mongoose from 'mongoose';

const whatsAppDeliverySchema = new mongoose.Schema(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerEmail: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      default: '',
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
    duration: {
      type: String,
      default: 'annual',
    },
    status: {
      type: String,
      enum: ['awaiting_whatsapp_contact', 'customer_contacted', 'processing', 'delivered', 'cancelled'],
      default: 'awaiting_whatsapp_contact',
      index: true,
    },
    whatsappPhone: {
      type: String,
      required: true, // Business WhatsApp number e.g. +919876543210
    },
    prefilledMessage: {
      type: String,
      default: '',
    },
    clickToChatUrl: {
      type: String,
      default: '',
    },
    customerContactedAt: {
      type: Date,
      default: null,
    },
    internalNotes: {
      type: String,
      default: '',
    },
    deliveredCredentials: {
      username: { type: String, default: '' },
      password: { type: String, default: '' },
      licenseKey: { type: String, default: '' },
      instructions: { type: String, default: '' },
      accessLink: { type: String, default: '' },
    },
    deliveredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

whatsAppDeliverySchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('WhatsAppDelivery', whatsAppDeliverySchema);

