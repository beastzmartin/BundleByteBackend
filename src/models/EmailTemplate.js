import mongoose from 'mongoose';

const emailTemplateSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['auth', 'order', 'finance', 'delivery', 'support', 'marketing', 'system'],
      default: 'system',
      index: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    htmlBody: {
      type: String,
      required: true,
    },
    textBody: {
      type: String,
      default: '',
    },
    variables: {
      type: [String],
      default: [],
    },
    previewText: {
      type: String,
      default: '',
    },
    headerLogo: {
      type: String,
      default: '',
    },
    headerLogoEnabled: {
      type: Boolean,
      default: true,
    },
    brandColor: {
      type: String,
      default: '#4f46e5',
    },
    footerText: {
      type: String,
      default: '',
    },
    headline: {
      type: String,
      default: '',
    },
    greeting: {
      type: String,
      default: '',
    },
    securityNotice: {
      type: String,
      default: '',
    },
    productAccessBoxEnabled: {
      type: Boolean,
      default: false,
    },
    primaryButtonText: {
      type: String,
      default: '',
    },
    primaryButtonUrl: {
      type: String,
      default: '',
    },
    primaryButtonColor: {
      type: String,
      default: '#4f46e5',
    },
    primaryButtonRadius: {
      type: String,
      default: '8px',
    },
    visualSections: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    version: {
      type: Number,
      default: 1,
    },
    hasDraft: {
      type: Boolean,
      default: false,
    },
    draftSubject: {
      type: String,
      default: '',
    },
    draftHtmlBody: {
      type: String,
      default: '',
    },
    draftTextBody: {
      type: String,
      default: '',
    },
    draftPreviewText: {
      type: String,
      default: '',
    },
    draftBrandColor: {
      type: String,
      default: '',
    },
    draftVisualSections: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
    },
    versionHistory: [
      {
        version: Number,
        subject: String,
        htmlBody: String,
        textBody: String,
        previewText: String,
        brandColor: String,
        visualSections: mongoose.Schema.Types.Mixed,
        savedAt: { type: Date, default: Date.now },
        savedBy: { type: String, default: 'admin' },
      },
    ],
    isSystem: {
      type: Boolean,
      default: true,
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

export default mongoose.model('EmailTemplate', emailTemplateSchema);
