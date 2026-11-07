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
import WebsiteSettings from '../models/WebsiteSettings.js';
import WebsiteAuditLog from '../models/WebsiteAuditLog.js';
import WebsiteVersion from '../models/WebsiteVersion.js';
import { websiteCache } from '../services/website/websiteCacheService.js';
import { logWebsiteChange } from '../middleware/websitePermissions.js';
import { sanitizeHtmlContent } from '../services/website/websiteSecurityService.js';

// ==========================================
// 1. BRANDING CONTROLLERS
// ==========================================

export const getBranding = async (req, res, next) => {
  try {
    const isPreview = req.query.preview === 'true' && req.user;
    const cacheKey = isPreview ? 'branding_preview' : 'branding_published';

    if (!isPreview) {
      const cached = websiteCache.get(cacheKey);
      if (cached) return res.status(200).json({ success: true, branding: cached });
    }

    let branding = await BrandingSettings.findOne();
    if (!branding) {
      branding = await BrandingSettings.create({});
    }

    let result = branding.toObject();
    if (isPreview && branding.draftData) {
      result = { ...result, ...branding.draftData };
    }

    if (!isPreview) {
      websiteCache.set(cacheKey, result);
    }

    res.status(200).json({ success: true, branding: result });
  } catch (error) {
    next(error);
  }
};

export const updateBranding = async (req, res, next) => {
  try {
    const { isDraft = false, ...brandingData } = req.body;
    let branding = await BrandingSettings.findOne();
    if (!branding) {
      branding = await BrandingSettings.create({});
    }

    const previousState = branding.toObject();

    if (isDraft) {
      branding.draftData = brandingData;
      await WebsiteSettings.findOneAndUpdate(
        {},
        { hasUnpublishedDrafts: true },
        { upsert: true }
      );
    } else {
      // Direct live update
      Object.assign(branding, brandingData);
      branding.draftData = null;
      branding.version = (branding.version || 1) + 1;
      branding.lastPublishedAt = new Date();
      branding.lastModifiedBy = req.user._id;
    }

    await branding.save();
    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: isDraft ? 'BRANDING_DRAFT_SAVED' : 'BRANDING_PUBLISHED',
      module: 'branding',
      entityId: branding._id,
      description: isDraft ? 'Saved branding modifications as draft' : 'Updated and published website branding',
      changes: { before: previousState, after: branding.toObject() },
    });

    res.status(200).json({
      success: true,
      message: isDraft ? 'Branding draft saved successfully' : 'Branding updated and published live',
      branding,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. THEME CONTROLLERS
// ==========================================

export const getTheme = async (req, res, next) => {
  try {
    const isPreview = req.query.preview === 'true' && req.user;
    const cacheKey = isPreview ? 'theme_preview' : 'theme_published';

    if (!isPreview) {
      const cached = websiteCache.get(cacheKey);
      if (cached) return res.status(200).json({ success: true, theme: cached });
    }

    let theme = await ThemeSettings.findOne();
    if (!theme) {
      theme = await ThemeSettings.create({});
    }

    let result = theme.toObject();
    if (isPreview && theme.draftData) {
      result = { ...result, ...theme.draftData };
    }

    if (!isPreview) {
      websiteCache.set(cacheKey, result);
    }

    res.status(200).json({ success: true, theme: result });
  } catch (error) {
    next(error);
  }
};

export const updateTheme = async (req, res, next) => {
  try {
    const { isDraft = false, ...themeData } = req.body;
    let theme = await ThemeSettings.findOne();
    if (!theme) {
      theme = await ThemeSettings.create({});
    }

    const previousState = theme.toObject();

    if (isDraft) {
      theme.draftData = themeData;
      await WebsiteSettings.findOneAndUpdate({}, { hasUnpublishedDrafts: true }, { upsert: true });
    } else {
      Object.assign(theme, themeData);
      theme.draftData = null;
      theme.version = (theme.version || 1) + 1;
    }

    await theme.save();
    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: isDraft ? 'THEME_DRAFT_SAVED' : 'THEME_PUBLISHED',
      module: 'theme',
      entityId: theme._id,
      description: isDraft ? 'Saved theme settings as draft' : 'Published updated theme and design tokens',
      changes: { before: previousState, after: theme.toObject() },
    });

    res.status(200).json({
      success: true,
      message: isDraft ? 'Theme draft saved successfully' : 'Theme settings updated and applied',
      theme,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 3. HOMEPAGE CONTROLLERS
// ==========================================

export const getHomepage = async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role));
    const filter = isAdmin ? {} : { isEnabled: true };

    const sections = await HomepageSection.find(filter).sort({ order: 1 });
    res.status(200).json({ success: true, sections });
  } catch (error) {
    next(error);
  }
};

export const updateHomepage = async (req, res, next) => {
  try {
    const { sections } = req.body;

    if (Array.isArray(sections)) {
      for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        if (sec._id) {
          await HomepageSection.findByIdAndUpdate(sec._id, {
            ...sec,
            order: i,
          });
        }
      }
    }

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'HOMEPAGE_SECTIONS_UPDATED',
      module: 'homepage',
      description: 'Updated homepage sections order and configuration',
    });

    const updatedSections = await HomepageSection.find().sort({ order: 1 });
    res.status(200).json({
      success: true,
      message: 'Homepage layout and sections saved successfully',
      sections: updatedSections,
    });
  } catch (error) {
    next(error);
  }
};

export const createHomepageSection = async (req, res, next) => {
  try {
    const count = await HomepageSection.countDocuments();
    const newSection = await HomepageSection.create({
      ...req.body,
      order: count,
    });

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'HOMEPAGE_SECTION_CREATED',
      module: 'homepage',
      entityId: newSection._id,
      description: `Created new homepage section: ${newSection.title || newSection.sectionKey}`,
    });

    res.status(201).json({ success: true, section: newSection });
  } catch (error) {
    next(error);
  }
};

export const updateHomepageSection = async (req, res, next) => {
  try {
    const section = await HomepageSection.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'HOMEPAGE_SECTION_UPDATED',
      module: 'homepage',
      entityId: section._id,
      description: `Updated section: ${section.title || section.sectionKey}`,
    });

    res.status(200).json({ success: true, section });
  } catch (error) {
    next(error);
  }
};

export const deleteHomepageSection = async (req, res, next) => {
  try {
    const section = await HomepageSection.findByIdAndDelete(req.params.id);
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'HOMEPAGE_SECTION_DELETED',
      module: 'homepage',
      entityId: section._id,
      description: `Deleted section: ${section.sectionKey}`,
    });

    res.status(200).json({ success: true, message: 'Section deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 4. NAVIGATION CONTROLLERS
// ==========================================

export const getNavigation = async (req, res, next) => {
  try {
    let nav = await NavigationMenu.findOne();
    if (!nav) {
      nav = await NavigationMenu.create({});
    }

    res.status(200).json({ success: true, navigation: nav });
  } catch (error) {
    next(error);
  }
};

export const updateNavigation = async (req, res, next) => {
  try {
    let nav = await NavigationMenu.findOne();
    if (!nav) {
      nav = await NavigationMenu.create({});
    }

    const previousState = nav.toObject();
    Object.assign(nav, req.body);
    nav.version = (nav.version || 1) + 1;
    await nav.save();

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'NAVIGATION_UPDATED',
      module: 'navigation',
      entityId: nav._id,
      description: 'Updated navigation menus, links and header visibility toggles',
      changes: { before: previousState, after: nav.toObject() },
    });

    res.status(200).json({ success: true, message: 'Navigation updated successfully', navigation: nav });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 5. FOOTER CONTROLLERS
// ==========================================

export const getFooter = async (req, res, next) => {
  try {
    let footer = await FooterSettings.findOne();
    if (!footer) {
      footer = await FooterSettings.create({});
    }

    res.status(200).json({ success: true, footer });
  } catch (error) {
    next(error);
  }
};

export const updateFooter = async (req, res, next) => {
  try {
    let footer = await FooterSettings.findOne();
    if (!footer) {
      footer = await FooterSettings.create({});
    }

    const previousState = footer.toObject();
    Object.assign(footer, req.body);
    footer.version = (footer.version || 1) + 1;
    await footer.save();

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'FOOTER_UPDATED',
      module: 'footer',
      entityId: footer._id,
      description: 'Updated footer settings, columns, and payment trust badges',
      changes: { before: previousState, after: footer.toObject() },
    });

    res.status(200).json({ success: true, message: 'Footer updated successfully', footer });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 6. CMS PAGES CONTROLLERS
// ==========================================

export const getPages = async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role));
    const filter = isAdmin ? {} : { status: 'published' };

    const pages = await WebsitePage.find(filter).sort({ title: 1 });
    res.status(200).json({ success: true, pages });
  } catch (error) {
    next(error);
  }
};

export const getPageBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const isAdmin = Boolean(req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role));
    const filter = isAdmin ? { slug } : { slug, status: 'published' };

    const page = await WebsitePage.findOne(filter);
    if (!page) {
      return res.status(404).json({ success: false, message: `Page '${slug}' not found` });
    }

    res.status(200).json({ success: true, page });
  } catch (error) {
    next(error);
  }
};

export const createPage = async (req, res, next) => {
  try {
    const pageData = { ...req.body };
    if (pageData.htmlContent) {
      pageData.htmlContent = sanitizeHtmlContent(pageData.htmlContent);
    }
    if (Array.isArray(pageData.blocks)) {
      pageData.blocks = pageData.blocks.map((b) => ({
        ...b,
        content: sanitizeHtmlContent(b.content),
      }));
    }

    pageData.lastModifiedBy = req.user._id;

    const page = await WebsitePage.create(pageData);

    await logWebsiteChange({
      req,
      action: 'PAGE_CREATED',
      module: 'page',
      entityId: page._id,
      description: `Created new CMS page: ${page.title} (/${page.slug})`,
    });

    res.status(201).json({ success: true, message: 'Page created successfully', page });
  } catch (error) {
    next(error);
  }
};

export const updatePage = async (req, res, next) => {
  try {
    const pageData = { ...req.body };
    if (pageData.htmlContent) {
      pageData.htmlContent = sanitizeHtmlContent(pageData.htmlContent);
    }
    if (Array.isArray(pageData.blocks)) {
      pageData.blocks = pageData.blocks.map((b) => ({
        ...b,
        content: sanitizeHtmlContent(b.content),
      }));
    }

    pageData.lastModifiedBy = req.user._id;

    const page = await WebsitePage.findByIdAndUpdate(req.params.id, pageData, {
      new: true,
      runValidators: true,
    });

    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    await logWebsiteChange({
      req,
      action: 'PAGE_UPDATED',
      module: 'page',
      entityId: page._id,
      description: `Updated CMS page: ${page.title} (/${page.slug})`,
    });

    res.status(200).json({ success: true, message: 'Page updated successfully', page });
  } catch (error) {
    next(error);
  }
};

export const deletePage = async (req, res, next) => {
  try {
    const page = await WebsitePage.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ success: false, message: 'Page not found' });
    }

    if (page.isSystemPage) {
      return res.status(400).json({
        success: false,
        message: 'System policy pages (e.g. Terms, Privacy, FAQ) cannot be deleted. You may set them to draft if needed.',
      });
    }

    await page.deleteOne();

    await logWebsiteChange({
      req,
      action: 'PAGE_DELETED',
      module: 'page',
      entityId: page._id,
      description: `Deleted custom page: ${page.title}`,
    });

    res.status(200).json({ success: true, message: 'Page deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. POPUP CONTROLLERS
// ==========================================

export const getActivePopups = async (req, res, next) => {
  try {
    const { path = '/', customerRole = 'guest' } = req.query;
    const now = new Date();

    const popups = await Popup.find({
      status: 'published',
      $or: [{ 'scheduling.isScheduled': false }, { 'scheduling.startDate': { $lte: now } }],
    }).sort({ priority: -1 });

    // Filter by dates & path rules
    const active = popups.filter((p) => {
      if (p.scheduling.isScheduled && p.scheduling.endDate && p.scheduling.endDate < now) {
        return false;
      }

      // Check page rules
      const r = p.displayRules;
      const isHome = path === '/' || path === '';
      const isProduct = path.startsWith('/product');
      const isCheckout = path.startsWith('/checkout') || path.startsWith('/cart');
      const isLogin = path.startsWith('/login');
      const isRegister = path.startsWith('/register');

      if (isHome && !r.showOnHomepage) return false;
      if (isProduct && !r.showOnProductPages) return false;
      if (isCheckout && !r.showOnCheckout) return false;
      if (isLogin && !r.showOnLoginPage) return false;
      if (isRegister && !r.showOnRegisterPage) return false;

      // Custom pages list
      if (Array.isArray(r.selectedPages) && r.selectedPages.length > 0) {
        const matches = r.selectedPages.some((pattern) => path.startsWith(pattern));
        if (!matches && !isHome) return false;
      }

      // User status rules
      const isLoggedIn = customerRole !== 'guest';
      if (isLoggedIn && !r.showToLoggedIn) return false;
      if (!isLoggedIn && !r.showToGuests) return false;

      return true;
    });

    res.status(200).json({ success: true, popups: active });
  } catch (error) {
    next(error);
  }
};

export const getAdminPopups = async (req, res, next) => {
  try {
    const popups = await Popup.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, popups });
  } catch (error) {
    next(error);
  }
};

export const getPopupById = async (req, res, next) => {
  try {
    const popup = await Popup.findById(req.params.id);
    if (!popup) {
      return res.status(404).json({ success: false, message: 'Popup not found' });
    }
    res.status(200).json({ success: true, popup });
  } catch (error) {
    next(error);
  }
};

export const createPopup = async (req, res, next) => {
  try {
    const popupData = { ...req.body };
    if (popupData.design?.customHtml) {
      popupData.design.customHtml = sanitizeHtmlContent(popupData.design.customHtml);
    }
    popupData.createdBy = req.user._id;

    const popup = await Popup.create(popupData);

    await logWebsiteChange({
      req,
      action: 'POPUP_CREATED',
      module: 'popup',
      entityId: popup._id,
      description: `Created popup: ${popup.name} (${popup.popupType})`,
    });

    res.status(201).json({ success: true, message: 'Popup created successfully', popup });
  } catch (error) {
    next(error);
  }
};

export const updatePopup = async (req, res, next) => {
  try {
    const popupData = { ...req.body };
    if (popupData.design?.customHtml) {
      popupData.design.customHtml = sanitizeHtmlContent(popupData.design.customHtml);
    }

    const popup = await Popup.findByIdAndUpdate(req.params.id, popupData, {
      new: true,
      runValidators: true,
    });

    if (!popup) {
      return res.status(404).json({ success: false, message: 'Popup not found' });
    }

    await logWebsiteChange({
      req,
      action: 'POPUP_UPDATED',
      module: 'popup',
      entityId: popup._id,
      description: `Updated popup: ${popup.name}`,
    });

    res.status(200).json({ success: true, message: 'Popup updated successfully', popup });
  } catch (error) {
    next(error);
  }
};

export const deletePopup = async (req, res, next) => {
  try {
    const popup = await Popup.findByIdAndDelete(req.params.id);
    if (!popup) {
      return res.status(404).json({ success: false, message: 'Popup not found' });
    }

    // Clean up associated analytics events
    await PopupAnalytics.deleteMany({ popup: popup._id });

    await logWebsiteChange({
      req,
      action: 'POPUP_DELETED',
      module: 'popup',
      entityId: popup._id,
      description: `Deleted popup: ${popup.name}`,
    });

    res.status(200).json({ success: true, message: 'Popup deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const trackPopupEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { eventType, visitorId = '', pageUrl = '', metadata = {} } = req.body;

    const validEvents = ['impression', 'unique_impression', 'click', 'close', 'conversion', 'coupon_copy'];
    if (!validEvents.includes(eventType)) {
      return res.status(400).json({ success: false, message: 'Invalid event type' });
    }

    const popup = await Popup.findById(id);
    if (!popup) {
      return res.status(404).json({ success: false, message: 'Popup not found' });
    }

    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
    const userAgent = req.headers['user-agent'] || '';

    // Create detailed analytics entry
    await PopupAnalytics.create({
      popup: id,
      eventType,
      user: req.user?._id || null,
      visitorId,
      pageUrl,
      ipAddress,
      userAgent,
      metadata,
    });

    // Increment aggregated counters on popup model
    const incMap = {
      impression: { 'analytics.impressions': 1 },
      unique_impression: { 'analytics.uniqueImpressions': 1 },
      click: { 'analytics.clicks': 1 },
      close: { 'analytics.closeEvents': 1 },
      conversion: { 'analytics.conversions': 1 },
      coupon_copy: { 'analytics.couponCopies': 1 },
    };

    if (incMap[eventType]) {
      await Popup.findByIdAndUpdate(id, { $inc: incMap[eventType] });
    }

    res.status(200).json({ success: true, message: 'Event tracked' });
  } catch (error) {
    next(error);
  }
};

export const getPopupAnalytics = async (req, res, next) => {
  try {
    const { id } = req.params;
    const popup = await Popup.findById(id);
    if (!popup) {
      return res.status(404).json({ success: false, message: 'Popup not found' });
    }

    const events = await PopupAnalytics.find({ popup: id })
      .sort({ createdAt: -1 })
      .limit(200);

    const stats = popup.analytics || {
      impressions: 0,
      uniqueImpressions: 0,
      clicks: 0,
      closeEvents: 0,
      conversions: 0,
      couponCopies: 0,
    };

    const impressions = stats.impressions || 0;
    const clicks = stats.clicks || 0;
    const conversions = stats.conversions || 0;

    const clickThroughRate = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '0.0';
    const conversionRate = impressions > 0 ? ((conversions / impressions) * 100).toFixed(1) : '0.0';

    res.status(200).json({
      success: true,
      analytics: {
        ...stats,
        clickThroughRate: `${clickThroughRate}%`,
        conversionRate: `${conversionRate}%`,
      },
      recentEvents: events,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 8. ANNOUNCEMENT CONTROLLERS
// ==========================================

export const getAnnouncements = async (req, res, next) => {
  try {
    const isAdmin = Boolean(req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role));
    const now = new Date();

    const filter = isAdmin
      ? {}
      : {
          status: 'published',
          $or: [{ startDate: null }, { startDate: { $lte: now } }],
          $and: [{ $or: [{ endDate: null }, { endDate: { $gte: now } }] }],
        };

    const announcements = await Announcement.find(filter).sort({ priority: -1, createdAt: -1 });
    res.status(200).json({ success: true, announcements });
  } catch (error) {
    next(error);
  }
};

export const createAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.create({
      ...req.body,
      createdBy: req.user._id,
    });

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'ANNOUNCEMENT_CREATED',
      module: 'announcement',
      entityId: announcement._id,
      description: `Created announcement: ${announcement.title}`,
    });

    res.status(201).json({ success: true, message: 'Announcement created', announcement });
  } catch (error) {
    next(error);
  }
};

export const updateAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'ANNOUNCEMENT_UPDATED',
      module: 'announcement',
      entityId: announcement._id,
      description: `Updated announcement: ${announcement.title}`,
    });

    res.status(200).json({ success: true, message: 'Announcement updated', announcement });
  } catch (error) {
    next(error);
  }
};

export const deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'ANNOUNCEMENT_DELETED',
      module: 'announcement',
      entityId: announcement._id,
      description: `Deleted announcement: ${announcement.title}`,
    });

    res.status(200).json({ success: true, message: 'Announcement deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 9. BANNER CONTROLLERS
// ==========================================

export const getBanners = async (req, res, next) => {
  try {
    const { placement } = req.query;
    const isAdmin = Boolean(req.user && ['super_admin', 'admin', 'manager'].includes(req.user.role));
    const now = new Date();

    const query = {};
    if (!isAdmin) {
      query.status = 'published';
      query.$or = [{ startDate: null }, { startDate: { $lte: now } }];
      query.$and = [{ $or: [{ endDate: null }, { endDate: { $gte: now } }] }];
    }
    if (placement) {
      query.placement = placement;
    }

    const banners = await Banner.find(query).sort({ priority: -1, createdAt: -1 });
    res.status(200).json({ success: true, banners });
  } catch (error) {
    next(error);
  }
};

export const createBanner = async (req, res, next) => {
  try {
    const banner = await Banner.create({
      ...req.body,
      createdBy: req.user._id,
    });

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'BANNER_CREATED',
      module: 'banner',
      entityId: banner._id,
      description: `Created banner: ${banner.title} (${banner.placement})`,
    });

    res.status(201).json({ success: true, message: 'Banner created successfully', banner });
  } catch (error) {
    next(error);
  }
};

export const updateBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'BANNER_UPDATED',
      module: 'banner',
      entityId: banner._id,
      description: `Updated banner: ${banner.title}`,
    });

    res.status(200).json({ success: true, message: 'Banner updated successfully', banner });
  } catch (error) {
    next(error);
  }
};

export const deleteBanner = async (req, res, next) => {
  try {
    const banner = await Banner.findByIdAndDelete(req.params.id);
    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'BANNER_DELETED',
      module: 'banner',
      entityId: banner._id,
      description: `Deleted banner: ${banner.title}`,
    });

    res.status(200).json({ success: true, message: 'Banner deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const trackBannerEvent = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { event = 'impression' } = req.body;

    const incField = event === 'click' ? 'analytics.clicks' : 'analytics.impressions';
    await Banner.findByIdAndUpdate(id, { $inc: { [incField]: 1 } });

    res.status(200).json({ success: true, message: 'Banner event logged' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 10. SEO & METADATA CONTROLLERS
// ==========================================

export const getSEO = async (req, res, next) => {
  try {
    let seo = await SEOSettings.findOne();
    if (!seo) {
      seo = await SEOSettings.create({});
    }

    res.status(200).json({ success: true, seo });
  } catch (error) {
    next(error);
  }
};

export const updateSEO = async (req, res, next) => {
  try {
    let seo = await SEOSettings.findOne();
    if (!seo) {
      seo = await SEOSettings.create({});
    }

    const previousState = seo.toObject();
    Object.assign(seo, req.body);
    seo.version = (seo.version || 1) + 1;
    await seo.save();

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'SEO_UPDATED',
      module: 'seo',
      entityId: seo._id,
      description: 'Updated global SEO titles, Open Graph cards, and Webmaster IDs',
      changes: { before: previousState, after: seo.toObject() },
    });

    res.status(200).json({ success: true, message: 'SEO configuration updated successfully', seo });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 11. FILE UPLOAD CONTROLLER
// ==========================================

export const uploadAsset = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No image file uploaded' });
  }

  // Construct accessible asset URL
  const fileUrl = `/uploads/website/${req.file.filename}`;

  res.status(200).json({
    success: true,
    message: 'Asset uploaded successfully',
    url: fileUrl,
    filename: req.file.filename,
    size: req.file.size,
    mimetype: req.file.mimetype,
  });
};

// ==========================================
// 12. PUBLISHING WORKFLOW & ROLLBACK CONTROLLERS
// ==========================================

export const publishAllChanges = async (req, res, next) => {
  try {
    const { versionName = '', notes = '' } = req.body;

    // 1. Gather all active entities
    const [branding, theme, sections, nav, footer, seo] = await Promise.all([
      BrandingSettings.findOne(),
      ThemeSettings.findOne(),
      HomepageSection.find().sort({ order: 1 }),
      NavigationMenu.findOne(),
      FooterSettings.findOne(),
      SEOSettings.findOne(),
    ]);

    // Commit any drafts to live state
    if (branding && branding.draftData) {
      Object.assign(branding, branding.draftData);
      branding.draftData = null;
      branding.version = (branding.version || 1) + 1;
      branding.lastPublishedAt = new Date();
      branding.lastModifiedBy = req.user._id;
      await branding.save();
    }

    if (theme && theme.draftData) {
      Object.assign(theme, theme.draftData);
      theme.draftData = null;
      theme.version = (theme.version || 1) + 1;
      await theme.save();
    }

    // Determine new version number
    const lastVersion = await WebsiteVersion.findOne().sort({ versionNumber: -1 });
    const nextVersionNum = (lastVersion?.versionNumber || 1) + 1;

    // Deactivate previous live version flags
    await WebsiteVersion.updateMany({ isLive: true }, { isLive: false });

    // Create snapshot
    const newVersion = await WebsiteVersion.create({
      versionNumber: nextVersionNum,
      versionName: versionName || `Release v${nextVersionNum}`,
      notes: notes || 'Published from Website Control Center',
      isLive: true,
      snapshotData: {
        branding: branding?.toObject(),
        theme: theme?.toObject(),
        homepageSections: sections.map((s) => s.toObject()),
        navigation: nav?.toObject(),
        footer: footer?.toObject(),
        seo: seo?.toObject(),
      },
      publishedBy: req.user._id,
      publishedByEmail: req.user.email,
    });

    // Update master settings
    await WebsiteSettings.findOneAndUpdate(
      {},
      {
        currentLiveVersion: nextVersionNum,
        hasUnpublishedDrafts: false,
        lastPublishedAt: new Date(),
        lastPublishedBy: req.user._id,
      },
      { upsert: true }
    );

    // Invalidate full website cache
    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'WEBSITE_PUBLISHED',
      module: 'publishing',
      entityId: newVersion._id,
      description: `Published new site release: v${nextVersionNum} (${newVersion.versionName})`,
    });

    res.status(200).json({
      success: true,
      message: `Website configuration v${nextVersionNum} published live successfully!`,
      version: newVersion,
    });
  } catch (error) {
    next(error);
  }
};

export const getVersionHistory = async (req, res, next) => {
  try {
    const versions = await WebsiteVersion.find()
      .select('-snapshotData')
      .sort({ versionNumber: -1 })
      .limit(30);

    res.status(200).json({ success: true, versions });
  } catch (error) {
    next(error);
  }
};

export const rollbackToVersion = async (req, res, next) => {
  try {
    const { versionId } = req.params;
    const targetVersion = await WebsiteVersion.findById(versionId);

    if (!targetVersion || !targetVersion.snapshotData) {
      return res.status(404).json({ success: false, message: 'Target version snapshot not found' });
    }

    const snap = targetVersion.snapshotData;

    // Restore Branding
    if (snap.branding) {
      const { _id, ...brandingRestored } = snap.branding;
      await BrandingSettings.findOneAndUpdate({}, brandingRestored, { upsert: true });
    }

    // Restore Theme
    if (snap.theme) {
      const { _id, ...themeRestored } = snap.theme;
      await ThemeSettings.findOneAndUpdate({}, themeRestored, { upsert: true });
    }

    // Restore Homepage sections
    if (Array.isArray(snap.homepageSections) && snap.homepageSections.length > 0) {
      await HomepageSection.deleteMany();
      const sanitizedSections = snap.homepageSections.map(({ _id, ...sec }) => sec);
      await HomepageSection.insertMany(sanitizedSections);
    }

    // Restore Navigation
    if (snap.navigation) {
      const { _id, ...navRestored } = snap.navigation;
      await NavigationMenu.findOneAndUpdate({}, navRestored, { upsert: true });
    }

    // Restore Footer
    if (snap.footer) {
      const { _id, ...footerRestored } = snap.footer;
      await FooterSettings.findOneAndUpdate({}, footerRestored, { upsert: true });
    }

    // Restore SEO
    if (snap.seo) {
      const { _id, ...seoRestored } = snap.seo;
      await SEOSettings.findOneAndUpdate({}, seoRestored, { upsert: true });
    }

    // Mark live flag
    await WebsiteVersion.updateMany({ isLive: true }, { isLive: false });
    targetVersion.isLive = true;
    await targetVersion.save();

    await WebsiteSettings.findOneAndUpdate(
      {},
      {
        currentLiveVersion: targetVersion.versionNumber,
        hasUnpublishedDrafts: false,
        lastPublishedAt: new Date(),
        lastPublishedBy: req.user._id,
      },
      { upsert: true }
    );

    websiteCache.clearAll();

    await logWebsiteChange({
      req,
      action: 'WEBSITE_ROLLBACK',
      module: 'publishing',
      entityId: targetVersion._id,
      description: `Rolled back website configuration to v${targetVersion.versionNumber} (${targetVersion.versionName})`,
    });

    res.status(200).json({
      success: true,
      message: `Successfully rolled back to version ${targetVersion.versionNumber}!`,
      versionNumber: targetVersion.versionNumber,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 13. AUDIT LOGS CONTROLLER
// ==========================================

export const getWebsiteAuditLogs = async (req, res, next) => {
  try {
    const { module, limit = 100 } = req.query;
    const filter = module ? { module } : {};

    const logs = await WebsiteAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.status(200).json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 14. COMBINED MASTER STOREFRONT HYDRATION
// ==========================================

export const getMasterStorefrontConfig = async (req, res, next) => {
  try {
    const cacheKey = 'master_storefront_config';
    const cached = websiteCache.get(cacheKey);
    if (cached) {
      return res.status(200).json({ success: true, config: cached });
    }

    const [branding, theme, sections, nav, footer, seo, announcements, popups, banners] =
      await Promise.all([
        BrandingSettings.findOne(),
        ThemeSettings.findOne(),
        HomepageSection.find({ isEnabled: true }).sort({ order: 1 }),
        NavigationMenu.findOne(),
        FooterSettings.findOne(),
        SEOSettings.findOne(),
        Announcement.find({ status: 'published' }).sort({ priority: -1 }),
        Popup.find({ status: 'published' }).sort({ priority: -1 }),
        Banner.find({ status: 'published' }).sort({ priority: -1 }),
      ]);

    const config = {
      branding: branding || {},
      theme: theme || {},
      sections: sections || [],
      navigation: nav || {},
      footer: footer || {},
      seo: seo || {},
      announcements: announcements || [],
      popups: popups || [],
      banners: banners || [],
    };

    websiteCache.set(cacheKey, config, 10 * 60 * 1000); // 10 minutes cache
    res.status(200).json({ success: true, config });
  } catch (error) {
    next(error);
  }
};

