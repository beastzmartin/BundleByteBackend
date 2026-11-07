import express from 'express';
import {
  updateBranding,
  updateTheme,
  getHomepage,
  updateHomepage,
  createHomepageSection,
  updateHomepageSection,
  deleteHomepageSection,
  getNavigation,
  updateNavigation,
  getFooter,
  updateFooter,
  getPages,
  createPage,
  updatePage,
  deletePage,
  getAdminPopups,
  getPopupById,
  createPopup,
  updatePopup,
  deletePopup,
  getPopupAnalytics,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  getBanners,
  createBanner,
  updateBanner,
  deleteBanner,
  getSEO,
  updateSEO,
  uploadAsset,
  publishAllChanges,
  getVersionHistory,
  rollbackToVersion,
  getWebsiteAuditLogs,
} from '../controllers/websiteController.js';
import { protect } from '../middleware/auth.js';
import { requireWebsitePermission } from '../middleware/websitePermissions.js';
import { websiteAssetUpload } from '../services/website/websiteSecurityService.js';

const router = express.Router();

// Apply auth protection to all administrative website control routes
router.use(protect);

// Branding Management
router.put('/branding', requireWebsitePermission('branding_manager'), updateBranding);

// Theme & Appearance Management
router.put('/theme', requireWebsitePermission('branding_manager'), updateTheme);

// Homepage Visual Management
router.get('/homepage', requireWebsitePermission('website_manager'), getHomepage);
router.put('/homepage', requireWebsitePermission('website_manager'), updateHomepage);
router.post('/homepage/sections', requireWebsitePermission('website_manager'), createHomepageSection);
router.put('/homepage/sections/:id', requireWebsitePermission('website_manager'), updateHomepageSection);
router.delete('/homepage/sections/:id', requireWebsitePermission('website_manager'), deleteHomepageSection);

// Header & Navigation Management
router.get('/navigation', requireWebsitePermission('website_manager'), getNavigation);
router.put('/navigation', requireWebsitePermission('website_manager'), updateNavigation);

// Footer Management
router.get('/footer', requireWebsitePermission('website_manager'), getFooter);
router.put('/footer', requireWebsitePermission('website_manager'), updateFooter);

// CMS Pages
router.get('/pages', requireWebsitePermission('website_manager'), getPages);
router.post('/pages', requireWebsitePermission('website_manager'), createPage);
router.put('/pages/:id', requireWebsitePermission('website_manager'), updatePage);
router.delete('/pages/:id', requireWebsitePermission('website_manager'), deletePage);

// SEO & Webmaster
router.get('/seo', requireWebsitePermission('seo_manager'), getSEO);
router.put('/seo', requireWebsitePermission('seo_manager'), updateSEO);

// Asset Upload (Logos, Banners, Popup Images)
router.post(
  '/upload',
  requireWebsitePermission('website_manager'),
  websiteAssetUpload.single('image'),
  uploadAsset
);

// Publishing Workflow & Rollback
router.post('/publish', requireWebsitePermission('website_manager'), publishAllChanges);
router.get('/versions', requireWebsitePermission('website_manager'), getVersionHistory);
router.post('/rollback/:versionId', requireWebsitePermission('website_manager'), rollbackToVersion);

// Audit Logs
router.get('/audit-logs', requireWebsitePermission('website_manager'), getWebsiteAuditLogs);

export default router;

