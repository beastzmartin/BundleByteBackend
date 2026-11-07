import mongoose from 'mongoose';

const seoSettingsSchema = new mongoose.Schema(
  {
    defaultTitle: {
      type: String,
      default: 'BundleByte | Software Subscriptions & Digital Licenses Marketplace',
      trim: true,
    },
    titleTemplate: {
      type: String,
      default: '%s | BundleByte',
    },
    defaultDescription: {
      type: String,
      default: 'Premier digital software license marketplace. Instant automated delivery for developer tools, IDEs, creative suites, and perpetual enterprise licenses.',
      trim: true,
    },
    defaultKeywords: {
      type: [String],
      default: ['software licenses', 'digital keys', 'subscriptions', 'developer tools', 'IDE licenses', 'instant delivery'],
    },
    homepage: {
      title: { type: String, default: 'BundleByte – Genuine Software Subscriptions & Digital Licenses' },
      description: { type: String, default: 'Buy authentic software subscriptions and digital license keys with automated vault delivery and 14-day warranty guarantee.' },
      keywords: { type: [String], default: ['buy software licenses', 'cheap subscriptions', 'digital license keys'] },
    },
    productTitlePattern: {
      type: String,
      default: '{product_name} Subscription & Digital Key | BundleByte',
    },
    categoryTitlePattern: {
      type: String,
      default: '{category_name} Software & Subscriptions | BundleByte',
    },
    openGraph: {
      title: { type: String, default: 'BundleByte – Authentic Software Licenses & Subscriptions' },
      description: { type: String, default: 'Verified perpetual software keys and digital subscriptions delivered directly to your customer vault in seconds.' },
      image: { type: String, default: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=1200&auto=format&fit=crop&q=80' },
      siteName: { type: String, default: 'BundleByte' },
      type: { type: String, default: 'website' },
    },
    twitterCard: {
      cardType: { type: String, default: 'summary_large_image' },
      siteHandle: { type: String, default: '@BundleByte' },
      creatorHandle: { type: String, default: '@BundleByte' },
    },
    canonicalBaseUrl: {
      type: String,
      default: 'https://bundlebyte.com',
      trim: true,
    },
    robots: {
      allowIndexing: { type: Boolean, default: true },
      disallowAdmin: { type: Boolean, default: true },
      disallowPrivate: { type: Boolean, default: true },
      disallowApi: { type: Boolean, default: true },
      customRobotsTxt: {
        type: String,
        default: 'User-agent: *\nAllow: /\nDisallow: /dashboard/\nDisallow: /admin/\nDisallow: /api/\nDisallow: /checkout/\n\nSitemap: https://bundlebyte.com/sitemap.xml',
      },
    },
    sitemap: {
      autoGenerate: { type: Boolean, default: true },
      includeProducts: { type: Boolean, default: true },
      includeCategories: { type: Boolean, default: true },
      includePages: { type: Boolean, default: true },
      changeFrequency: { type: String, default: 'daily' },
    },
    webmaster: {
      googleAnalyticsId: { type: String, default: '', trim: true },
      googleSearchConsoleVerification: { type: String, default: '', trim: true },
      bingWebmasterVerification: { type: String, default: '', trim: true },
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

export default mongoose.model('SEOSettings', seoSettingsSchema);

