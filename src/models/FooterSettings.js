import mongoose from 'mongoose';

const footerLinkSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    badge: { type: String, default: '', trim: true },
    openInNewTab: { type: Boolean, default: false },
    isEnabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { _id: true }
);

const footerColumnSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    links: [footerLinkSchema],
    order: { type: Number, default: 0 },
    isEnabled: { type: Boolean, default: true },
  },
  { _id: true }
);

const socialLinkSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true },
    url: { type: String, required: true, trim: true },
    icon: { type: String, default: '' },
    isEnabled: { type: Boolean, default: true },
  },
  { _id: true }
);

const paymentIconSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true },
    iconUrl: { type: String, default: '' },
    isEnabled: { type: Boolean, default: true },
  },
  { _id: true }
);

const trustBadgeSchema = new mongoose.Schema(
  {
    icon: { type: String, default: 'ShieldCheck' },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    color: { type: String, default: 'emerald' },
  },
  { _id: true }
);

const footerSettingsSchema = new mongoose.Schema(
  {
    logo: {
      useCustomLogo: { type: Boolean, default: false },
      customLogoUrl: { type: String, default: '' },
      logoText: { type: String, default: 'BundleByte' },
      showTextWithLogo: { type: Boolean, default: true },
    },
    description: {
      type: String,
      default: 'The premier marketplace for software subscriptions, digital developer tools, authorized accounts, and genuine perpetual license keys.',
      trim: true,
    },
    guaranteeBanner: {
      isEnabled: { type: Boolean, default: true },
      badges: [trustBadgeSchema],
    },
    columns: [footerColumnSchema],
    socialLinks: [socialLinkSchema],
    contactInfo: {
      showInFooter: { type: Boolean, default: true },
      email: { type: String, default: 'support@bundlebyte.com' },
      phone: { type: String, default: '+1 (555) 019-2834' },
      address: { type: String, default: '100 Silicon Way, Suite 400, San Francisco, CA' },
      hours: { type: String, default: '24/7 Digital Fulfillment & Support' },
    },
    paymentMethods: [paymentIconSchema],
    legalLinks: [footerLinkSchema],
    copyrightText: {
      type: String,
      default: 'BundleByte Marketplace. All rights reserved. Authorized distribution.',
    },
    newsletter: {
      isEnabled: { type: Boolean, default: true },
      title: { type: String, default: 'Subscribe to Secret Deals & Releases' },
      subtitle: { type: String, default: 'Get notified about exclusive software drops, flash sales, and early-bird licensing discounts.' },
      placeholder: { type: String, default: 'Enter your business email...' },
      buttonText: { type: String, default: 'Subscribe' },
    },
    isPublished: {
      type: Boolean,
      default: true,
    },
    draftData: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('FooterSettings', footerSettingsSchema);

