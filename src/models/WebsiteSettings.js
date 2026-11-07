import mongoose from 'mongoose';

const websiteSettingsSchema = new mongoose.Schema(
  {
    masterKey: {
      type: String,
      default: 'PRIMARY_WEBSITE_CONFIG',
      unique: true,
    },
    maintenanceMode: {
      enabled: { type: Boolean, default: false },
      title: { type: String, default: 'Scheduled System Maintenance' },
      message: { type: String, default: 'We are currently performing routine upgrades on our licensing vault servers. We will be back online shortly!' },
      allowedIps: { type: [String], default: [] },
      estimatedEndTime: { type: Date, default: null },
    },
    activeModules: {
      branding: { type: Boolean, default: true },
      theme: { type: Boolean, default: true },
      homepage: { type: Boolean, default: true },
      navigation: { type: Boolean, default: true },
      footer: { type: Boolean, default: true },
      popups: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
      banners: { type: Boolean, default: true },
      seo: { type: Boolean, default: true },
    },
    currentLiveVersion: {
      type: Number,
      default: 1,
    },
    hasUnpublishedDrafts: {
      type: Boolean,
      default: false,
    },
    lastPublishedAt: {
      type: Date,
      default: Date.now,
    },
    lastPublishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('WebsiteSettings', websiteSettingsSchema);

