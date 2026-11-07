import express from 'express';
import {
  getBranding,
  getTheme,
  getFestivalThemes,
  getThemePresets,
  getHomepage,
  getNavigation,
  getFooter,
  getPages,
  getPageBySlug,
  getActivePopups,
  trackPopupEvent,
  getAnnouncements,
  getBanners,
  trackBannerEvent,
  getSEO,
  getMasterStorefrontConfig,
} from '../controllers/websiteController.js';
import { optionalAuth } from '../middleware/auth.js';

const router = express.Router();

// Master storefront hydration
router.get('/master-config', getMasterStorefrontConfig);

// Branding & Theme
router.get('/branding', optionalAuth, getBranding);
router.get('/theme', optionalAuth, getTheme);
router.get('/theme/festivals', getFestivalThemes);
router.get('/theme/presets', getThemePresets);

// Homepage Sections
router.get('/homepage', optionalAuth, getHomepage);

// Navigation & Footer
router.get('/navigation', getNavigation);
router.get('/footer', getFooter);

// CMS Pages
router.get('/pages', optionalAuth, getPages);
router.get('/pages/:slug', optionalAuth, getPageBySlug);

// Popups
router.get('/popups/active', getActivePopups);
router.post('/popups/:id/event', optionalAuth, trackPopupEvent);

// Announcements & Banners
router.get('/announcements', optionalAuth, getAnnouncements);
router.get('/banners', optionalAuth, getBanners);
router.post('/banners/:id/event', trackBannerEvent);

// SEO
router.get('/seo', getSEO);

export default router;

