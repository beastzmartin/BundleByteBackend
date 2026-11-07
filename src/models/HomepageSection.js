import mongoose from 'mongoose';

const homepageSectionSchema = new mongoose.Schema(
  {
    sectionKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    sectionType: {
      type: String,
      enum: [
        'hero',
        'popular_categories',
        'featured_products',
        'trending_products',
        'popular_software',
        'special_offers',
        'promotional_banners',
        'product_collections',
        'trust_badges',
        'testimonials',
        'faq',
        'newsletter',
        'custom_block',
      ],
      required: true,
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    subtitle: {
      type: String,
      default: '',
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
      index: true,
    },
    isEnabled: {
      type: Boolean,
      default: true,
      index: true,
    },
    visibility: {
      devices: {
        type: String,
        enum: ['all', 'desktop_only', 'mobile_only'],
        default: 'all',
      },
      audience: {
        type: String,
        enum: ['all', 'logged_in', 'guest_only'],
        default: 'all',
      },
    },
    styling: {
      backgroundColor: { type: String, default: '' },
      textColor: { type: String, default: '' },
      paddingTop: { type: String, default: 'py-12' },
      paddingBottom: { type: String, default: 'py-12' },
      backgroundImage: { type: String, default: '' },
      customClass: { type: String, default: '' },
    },
    // Configurable parameters tailored for each section type
    content: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('HomepageSection', homepageSectionSchema);

