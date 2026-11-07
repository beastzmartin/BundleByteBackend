import mongoose from 'mongoose';

const themeSettingsSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'light',
    },
    presetName: {
      type: String,
      default: 'clean_white', // 'modern', 'minimal', 'premium_dark', 'clean_white', 'custom'
    },
    palette: {
      primary: { type: String, default: '#4f46e5' },
      primaryHover: { type: String, default: '#4338ca' },
      secondary: { type: String, default: '#7c3aed' },
      secondaryHover: { type: String, default: '#6d28d9' },
      accent: { type: String, default: '#06b6d4' },
      neutral: { type: String, default: '#64748b' },
      success: { type: String, default: '#10b981' },
      warning: { type: String, default: '#f59e0b' },
      danger: { type: String, default: '#ef4444' },
      info: { type: String, default: '#3b82f6' },
      backgroundLight: { type: String, default: '#ffffff' },
      surfaceLight: { type: String, default: '#f8fafc' },
      borderLight: { type: String, default: '#e2e8f0' },
      textPrimaryLight: { type: String, default: '#0f172a' },
      textSecondaryLight: { type: String, default: '#64748b' },
      backgroundDark: { type: String, default: '#0b0f19' },
      surfaceDark: { type: String, default: '#111827' },
      borderDark: { type: String, default: '#1f2937' },
      textPrimaryDark: { type: String, default: '#f9fafb' },
      textSecondaryDark: { type: String, default: '#9ca3af' },
    },
    typography: {
      headingFont: { type: String, default: 'Plus Jakarta Sans, sans-serif' },
      bodyFont: { type: String, default: 'Inter, sans-serif' },
      baseFontSize: { type: String, default: '16px' },
      headingWeight: { type: String, default: '700' },
      lineHeight: { type: String, default: '1.6' },
    },
    buttonStyles: {
      borderRadius: { type: String, default: '0.75rem' },
      fontWeight: { type: String, default: '600' },
      textTransform: { type: String, default: 'none' }, // none, uppercase, capitalize
      shadow: { type: String, default: 'sm' }, // none, sm, md, lg
    },
    cardStyles: {
      borderRadius: { type: String, default: '1rem' },
      shadow: { type: String, default: 'md' },
      borderWidth: { type: String, default: '1px' },
      borderStyle: { type: String, default: 'solid' },
    },
    inputStyles: {
      borderRadius: { type: String, default: '0.75rem' },
      borderWidth: { type: String, default: '1px' },
      focusRingColor: { type: String, default: '#6366f1' },
      backgroundLight: { type: String, default: '#ffffff' },
      backgroundDark: { type: String, default: '#0f172a' },
    },
    headerStyles: {
      backgroundColor: { type: String, default: '#ffffff' },
      textColor: { type: String, default: '#0f172a' },
      borderColor: { type: String, default: '#e2e8f0' },
      isSticky: { type: Boolean, default: true },
    },
    footerStyles: {
      backgroundColor: { type: String, default: '#ffffff' },
      textColor: { type: String, default: '#475569' },
      borderColor: { type: String, default: '#e2e8f0' },
    },
    layout: {
      containerMaxWidth: { type: String, default: '1280px' },
      contentPadding: { type: String, default: '1.5rem' },
      sectionSpacing: { type: String, default: '4rem' },
    },
    // Festival Theme System
    festivalTheme: {
      activeFestival: {
        type: String,
        default: null, // 'diwali', 'eid', 'christmas', 'new_year', 'holi', 'durga_puja', 'navratri', 'bihu', 'valentines', 'independence_day' or null
      },
      isScheduled: {
        type: Boolean,
        default: false,
      },
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
      autoReturn: {
        type: Boolean,
        default: true,
      },
      effectEnabled: {
        type: Boolean,
        default: true,
      },
      effectType: {
        type: String,
        default: 'diyas', // 'diyas', 'lanterns', 'snowfall', 'confetti', 'colors', 'patterns', 'sparkles', 'hearts', 'tricolor'
      },
      effectIntensity: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium',
      },
      banner: {
        enabled: { type: Boolean, default: true },
        badge: { type: String, default: '' },
        text: { type: String, default: '' },
        bgGradient: { type: String, default: '' },
        textColor: { type: String, default: '#ffffff' },
        ctaText: { type: String, default: 'Shop Festive Deals' },
        ctaUrl: { type: String, default: '/products' },
      },
      colors: {
        primary: { type: String, default: '' },
        secondary: { type: String, default: '' },
        accent: { type: String, default: '' },
        background: { type: String, default: '' },
        surface: { type: String, default: '' },
      },
    },
    customCss: {
      type: String,
      default: '',
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

export default mongoose.model('ThemeSettings', themeSettingsSchema);
