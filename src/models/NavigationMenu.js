import mongoose from 'mongoose';

const dropdownItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    badge: { type: String, default: '', trim: true },
    icon: { type: String, default: '', trim: true },
    openInNewTab: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isEnabled: { type: Boolean, default: true },
  },
  { _id: true }
);

const navItemSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    badge: { type: String, default: '', trim: true },
    icon: { type: String, default: '', trim: true },
    openInNewTab: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    isEnabled: { type: Boolean, default: true },
    dropdownItems: [dropdownItemSchema],
  },
  { _id: true }
);

const navigationMenuSchema = new mongoose.Schema(
  {
    headerLogo: {
      useCustomLogo: { type: Boolean, default: false },
      customLogoUrl: { type: String, default: '' },
      logoText: { type: String, default: 'BundleByte' },
      showTextWithLogo: { type: Boolean, default: true },
      heightPx: { type: Number, default: 36 },
    },
    desktopItems: [navItemSchema],
    mobileItems: [navItemSchema],
    controls: {
      showAnnouncementBar: { type: Boolean, default: true },
      showSearchBar: { type: Boolean, default: true },
      showCurrencySelector: { type: Boolean, default: true },
      showAuthButtons: { type: Boolean, default: true },
      showCartIcon: { type: Boolean, default: true },
      showWalletIcon: { type: Boolean, default: true },
      showThemeToggle: { type: Boolean, default: true },
      stickyHeader: { type: Boolean, default: true },
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

export default mongoose.model('NavigationMenu', navigationMenuSchema);

