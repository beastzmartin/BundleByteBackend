import mongoose from 'mongoose';

const websiteVersionSchema = new mongoose.Schema(
  {
    versionNumber: {
      type: Number,
      required: true,
      index: true,
    },
    versionName: {
      type: String,
      default: '',
      trim: true,
    },
    notes: {
      type: String,
      default: '',
    },
    isLive: {
      type: Boolean,
      default: false,
      index: true,
    },
    snapshotData: {
      branding: { type: mongoose.Schema.Types.Mixed, default: null },
      theme: { type: mongoose.Schema.Types.Mixed, default: null },
      homepageSections: { type: [mongoose.Schema.Types.Mixed], default: [] },
      navigation: { type: mongoose.Schema.Types.Mixed, default: null },
      footer: { type: mongoose.Schema.Types.Mixed, default: null },
      seo: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    publishedByEmail: {
      type: String,
      default: 'system',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('WebsiteVersion', websiteVersionSchema);

