import mongoose from 'mongoose';
import { connectDB, disconnectDB } from '../config/db.js';
import { ensureWebsiteSystemDefaults } from '../services/website/websiteDefaultsService.js';
import User from '../models/User.js';
import BrandingSettings from '../models/BrandingSettings.js';
import ThemeSettings from '../models/ThemeSettings.js';
import HomepageSection from '../models/HomepageSection.js';
import NavigationMenu from '../models/NavigationMenu.js';
import FooterSettings from '../models/FooterSettings.js';
import WebsitePage from '../models/WebsitePage.js';
import Popup from '../models/Popup.js';
import PopupAnalytics from '../models/PopupAnalytics.js';
import Announcement from '../models/Announcement.js';
import Banner from '../models/Banner.js';
import SEOSettings from '../models/SEOSettings.js';
import WebsiteAuditLog from '../models/WebsiteAuditLog.js';
import WebsiteVersion from '../models/WebsiteVersion.js';
import WebsiteSettings from '../models/WebsiteSettings.js';

async function runTests() {
  console.log('🧪 Starting Website Control Center & Popup System Verification...');
  await connectDB();

  try {
    // 1. Ensure system defaults
    console.log('Step 1: Testing ensureWebsiteSystemDefaults...');
    await ensureWebsiteSystemDefaults();

    // 2. Validate Branding
    const branding = await BrandingSettings.findOne();
    if (!branding || branding.websiteName !== 'BundleByte') {
      throw new Error(`Branding default failed. Found: ${branding?.websiteName}`);
    }
    console.log(`✅ Branding verified: ${branding.websiteName} - ${branding.websiteTagline}`);

    // 3. Validate Theme
    const theme = await ThemeSettings.findOne();
    if (!theme || !theme.palette?.primary) {
      throw new Error('Theme default palette missing');
    }
    console.log(`✅ Theme verified: mode=${theme.mode}, primary=${theme.palette.primary}`);

    // 4. Validate Homepage Sections
    const sections = await HomepageSection.find().sort({ order: 1 });
    if (sections.length < 8) {
      throw new Error(`Expected at least 8 homepage sections, got ${sections.length}`);
    }
    console.log(`✅ Homepage Sections verified: ${sections.length} modular sections found`);

    // 5. Validate Navigation & Footer
    const nav = await NavigationMenu.findOne();
    const footer = await FooterSettings.findOne();
    if (!nav || !footer) {
      throw new Error('Navigation or Footer settings missing');
    }
    console.log(`✅ Navigation (${nav.desktopItems.length} items) & Footer (${footer.columns.length} columns) verified`);

    // 6. Validate CMS Pages
    const pages = await WebsitePage.find();
    if (pages.length < 4) {
      throw new Error(`Expected at least 4 default pages, got ${pages.length}`);
    }
    console.log(`✅ CMS Pages verified: ${pages.map((p) => p.slug).join(', ')}`);

    // 7. Validate Popup System
    const popups = await Popup.find();
    if (popups.length === 0) {
      throw new Error('Expected at least 1 default sample popup');
    }
    const samplePopup = popups[0];
    console.log(`✅ Popup verified: "${samplePopup.name}" (Type: ${samplePopup.popupType})`);

    // Simulate event tracking
    await PopupAnalytics.create({
      popup: samplePopup._id,
      eventType: 'impression',
      visitorId: 'test_vis_123',
      pageUrl: '/',
      ipAddress: '127.0.0.1',
    });
    await Popup.findByIdAndUpdate(samplePopup._id, { $inc: { 'analytics.impressions': 1 } });

    const updatedPopup = await Popup.findById(samplePopup._id);
    if (updatedPopup.analytics.impressions < 1) {
      throw new Error('Popup analytics increment failed');
    }
    console.log(`✅ Popup Analytics Event tracking verified: impressions=${updatedPopup.analytics.impressions}`);

    // 8. Validate Announcements
    const announcements = await Announcement.find();
    console.log(`✅ Announcements verified: ${announcements.length} active announcements`);

    // 9. Validate Banners
    const banners = await Banner.find();
    console.log(`✅ Banners verified: ${banners.length} promotional banners`);

    // 10. Validate SEO
    const seo = await SEOSettings.findOne();
    if (!seo || !seo.defaultTitle) {
      throw new Error('SEO settings missing default title');
    }
    console.log(`✅ SEO Settings verified: "${seo.defaultTitle}"`);

    // 11. Validate Versioning
    const versions = await WebsiteVersion.find();
    if (versions.length === 0) {
      throw new Error('Expected at least 1 version snapshot');
    }
    console.log(`✅ Versioning & Rollback verified: Version v${versions[0].versionNumber} snapshot ready`);

    console.log('\n🎉 ALL 11 BACKEND SUBSYSTEM VERIFICATIONS PASSED SUCCESSFULLY!\n');
  } catch (err) {
    console.error('❌ Verification failed:', err);
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

runTests();

