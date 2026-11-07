import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'top_bar',
        'promotional_banner',
        'important_notice',
        'maintenance_announcement',
        'delivery_alert',
        'payment_announcement',
      ],
      default: 'top_bar',
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    badge: {
      type: String,
      default: 'FLASH PROMO',
      trim: true,
    },
    icon: {
      type: String,
      default: 'Tag', // Lucide icon name
    },
    backgroundColor: {
      type: String,
      default: 'from-indigo-900 via-indigo-800 to-violet-900', // Tailwind gradient or hex
    },
    textColor: {
      type: String,
      default: '#ffffff',
    },
    ctaButton: {
      enabled: { type: Boolean, default: true },
      text: { type: String, default: 'Shop Now' },
      url: { type: String, default: '/products' },
      openInNewTab: { type: Boolean, default: false },
    },
    targetPages: {
      type: [String],
      default: ['*'], // '*' means all pages, or specific paths like ['/', '/products']
    },
    priority: {
      type: Number,
      default: 1, // Higher priority displayed first
      index: true,
    },
    isDismissible: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'published',
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Check if announcement is currently active
announcementSchema.methods.isActive = function (path = '/') {
  if (this.status !== 'published') return false;
  const now = new Date();
  if (this.startDate && now < this.startDate) return false;
  if (this.endDate && now > this.endDate) return false;

  if (this.targetPages.includes('*')) return true;
  return this.targetPages.some((p) => path.startsWith(p));
};

export default mongoose.model('Announcement', announcementSchema);

