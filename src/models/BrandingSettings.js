import mongoose from 'mongoose';

const brandingSettingsSchema = new mongoose.Schema(
  {
    // General Branding
    websiteName: {
      type: String,
      default: 'BundleByte',
      trim: true,
      required: true,
    },
    websiteTagline: {
      type: String,
      default: 'Premium Software Subscriptions & Digital Licenses',
      trim: true,
    },
    websiteDescription: {
      type: String,
      default: 'The premier marketplace for software subscriptions, digital developer tools, authorized accounts, and genuine perpetual license keys.',
      trim: true,
    },
    companyName: {
      type: String,
      default: 'BundleByte Technologies Inc.',
      trim: true,
    },
    copyrightText: {
      type: String,
      default: '© 2026 BundleByte Marketplace. All rights reserved. Authorized distribution.',
      trim: true,
    },
    websiteUrl: {
      type: String,
      default: 'https://bundlebyte.com',
      trim: true,
    },
    contactEmail: {
      type: String,
      default: 'contact@bundlebyte.com',
      trim: true,
      lowercase: true,
    },
    supportEmail: {
      type: String,
      default: 'support@bundlebyte.com',
      trim: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      default: '+1 (555) 019-2834',
      trim: true,
    },
    businessAddress: {
      street: { type: String, default: '100 Silicon Way, Suite 400' },
      city: { type: String, default: 'San Francisco' },
      state: { type: String, default: 'CA' },
      zipCode: { type: String, default: '94107' },
      country: { type: String, default: 'United States' },
    },

    // Logo Management
    logos: {
      main: { type: String, default: '' },
      light: { type: String, default: '' },
      dark: { type: String, default: '' },
      mobile: { type: String, default: '' },
      favicon: { type: String, default: '' },
      login: { type: String, default: '' },
      email: { type: String, default: '' },
      admin: { type: String, default: '' },
    },

    // Website Identity
    identity: {
      primaryColor: { type: String, default: '#4f46e5' },
      secondaryColor: { type: String, default: '#7c3aed' },
      accentColor: { type: String, default: '#06b6d4' },
      backgroundColorLight: { type: String, default: '#ffffff' },
      backgroundColorDark: { type: String, default: '#0b0f19' },
      textColorLight: { type: String, default: '#0f172a' },
      textColorDark: { type: String, default: '#f8fafc' },
      buttonPrimaryBg: { type: String, default: '#4f46e5' },
      buttonPrimaryText: { type: String, default: '#ffffff' },
      buttonSecondaryBg: { type: String, default: '#f1f5f9' },
      buttonSecondaryText: { type: String, default: '#0f172a' },
      borderRadius: { type: String, default: '0.75rem' },
      headingFont: { type: String, default: 'Plus Jakarta Sans, sans-serif' },
      bodyFont: { type: String, default: 'Inter, sans-serif' },
    },

    // State & Publishing
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
    lastPublishedAt: {
      type: Date,
      default: Date.now,
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('BrandingSettings', brandingSettingsSchema);

