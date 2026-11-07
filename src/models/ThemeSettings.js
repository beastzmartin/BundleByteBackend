import mongoose from 'mongoose';

const themeSettingsSchema = new mongoose.Schema(
  {
    mode: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system',
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
    layout: {
      containerMaxWidth: { type: String, default: '1280px' },
      contentPadding: { type: String, default: '1.5rem' },
      sectionSpacing: { type: String, default: '4rem' },
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

