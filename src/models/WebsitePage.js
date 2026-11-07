import mongoose from 'mongoose';

const pageBlockSchema = new mongoose.Schema(
  {
    blockType: {
      type: String,
      enum: ['hero', 'rich_text', 'features_grid', 'faq_accordion', 'cta_banner', 'contact_card', 'html_block'],
      required: true,
    },
    order: { type: Number, default: 0 },
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    content: { type: String, default: '' }, // Markdown / sanitized rich text
    data: { type: mongoose.Schema.Types.Mixed, default: {} }, // Structured block data
    styling: {
      backgroundColor: { type: String, default: '' },
      textColor: { type: String, default: '' },
      containerWidth: { type: String, default: 'max-w-4xl' },
    },
  },
  { _id: true }
);

const websitePageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    isSystemPage: {
      type: Boolean,
      default: false,
    },
    pageType: {
      type: String,
      enum: [
        'about',
        'contact',
        'faq',
        'privacy',
        'terms',
        'refund',
        'shipping',
        'compliance',
        'custom',
      ],
      default: 'custom',
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    excerpt: {
      type: String,
      default: '',
      trim: true,
    },
    blocks: [pageBlockSchema],
    htmlContent: {
      type: String,
      default: '',
    },
    seo: {
      metaTitle: { type: String, default: '' },
      metaDescription: { type: String, default: '' },
      metaKeywords: { type: [String], default: [] },
      canonicalUrl: { type: String, default: '' },
      ogImage: { type: String, default: '' },
      noIndex: { type: Boolean, default: false },
    },
    publishedAt: {
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

export default mongoose.model('WebsitePage', websitePageSchema);

