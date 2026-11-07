import BrandingSettings from '../../models/BrandingSettings.js';
import ThemeSettings from '../../models/ThemeSettings.js';
import HomepageSection from '../../models/HomepageSection.js';
import NavigationMenu from '../../models/NavigationMenu.js';
import FooterSettings from '../../models/FooterSettings.js';
import WebsitePage from '../../models/WebsitePage.js';
import Popup from '../../models/Popup.js';
import Announcement from '../../models/Announcement.js';
import Banner from '../../models/Banner.js';
import SEOSettings from '../../models/SEOSettings.js';
import WebsiteSettings from '../../models/WebsiteSettings.js';
import WebsiteVersion from '../../models/WebsiteVersion.js';

export const ensureWebsiteSystemDefaults = async () => {
  try {
    // 1. Branding Settings
    let branding = await BrandingSettings.findOne();
    if (!branding) {
      branding = await BrandingSettings.create({
        websiteName: 'BundleByte',
        websiteTagline: 'Premium Software Subscriptions & Digital Licenses',
        websiteDescription:
          'The premier marketplace for software subscriptions, digital developer tools, authorized accounts, and genuine perpetual license keys.',
        companyName: 'BundleByte Technologies Inc.',
        copyrightText: '© 2026 BundleByte Marketplace. All rights reserved. Authorized distribution.',
        websiteUrl: 'https://bundlebyte.com',
        contactEmail: 'contact@bundlebyte.com',
        supportEmail: 'support@bundlebyte.com',
        contactPhone: '+1 (555) 019-2834',
        businessAddress: {
          street: '100 Silicon Way, Suite 400',
          city: 'San Francisco',
          state: 'CA',
          zipCode: '94107',
          country: 'United States',
        },
        logos: {
          main: '',
          light: '',
          dark: '',
          mobile: '',
          favicon: '',
          login: '',
          email: '',
          admin: '',
        },
        identity: {
          primaryColor: '#4f46e5',
          secondaryColor: '#7c3aed',
          accentColor: '#06b6d4',
          backgroundColorLight: '#ffffff',
          backgroundColorDark: '#0b0f19',
          textColorLight: '#0f172a',
          textColorDark: '#f8fafc',
          buttonPrimaryBg: '#4f46e5',
          buttonPrimaryText: '#ffffff',
          buttonSecondaryBg: '#f1f5f9',
          buttonSecondaryText: '#0f172a',
          borderRadius: '0.75rem',
          headingFont: 'Plus Jakarta Sans, sans-serif',
          bodyFont: 'Inter, sans-serif',
        },
        isPublished: true,
        version: 1,
      });
    }

    // 2. Theme Settings
    let theme = await ThemeSettings.findOne();
    if (!theme) {
      theme = await ThemeSettings.create({
        mode: 'system',
        palette: {
          primary: '#4f46e5',
          primaryHover: '#4338ca',
          secondary: '#7c3aed',
          secondaryHover: '#6d28d9',
          accent: '#06b6d4',
          neutral: '#64748b',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          info: '#3b82f6',
          backgroundLight: '#ffffff',
          surfaceLight: '#f8fafc',
          borderLight: '#e2e8f0',
          textPrimaryLight: '#0f172a',
          textSecondaryLight: '#64748b',
          backgroundDark: '#0b0f19',
          surfaceDark: '#111827',
          borderDark: '#1f2937',
          textPrimaryDark: '#f9fafb',
          textSecondaryDark: '#9ca3af',
        },
        typography: {
          headingFont: 'Plus Jakarta Sans, sans-serif',
          bodyFont: 'Inter, sans-serif',
          baseFontSize: '16px',
          headingWeight: '700',
          lineHeight: '1.6',
        },
        buttonStyles: {
          borderRadius: '0.75rem',
          fontWeight: '600',
          textTransform: 'none',
          shadow: 'sm',
        },
        cardStyles: {
          borderRadius: '1rem',
          shadow: 'md',
          borderWidth: '1px',
          borderStyle: 'solid',
        },
        inputStyles: {
          borderRadius: '0.75rem',
          borderWidth: '1px',
          focusRingColor: '#6366f1',
          backgroundLight: '#ffffff',
          backgroundDark: '#0f172a',
        },
        layout: {
          containerMaxWidth: '1280px',
          contentPadding: '1.5rem',
          sectionSpacing: '4rem',
        },
        isPublished: true,
        version: 1,
      });
    }

    // 3. Homepage Sections
    const sectionCount = await HomepageSection.countDocuments();
    if (sectionCount === 0) {
      await HomepageSection.create([
        {
          sectionKey: 'hero',
          sectionType: 'hero',
          title: 'Premium Software Subscriptions & Genuine Perpetual Licenses',
          subtitle:
            'Unlock instant enterprise-tier developer tools, creative suites, and perpetual licenses at unmatched wholesale prices. Fully verified with instant vault dispatch.',
          order: 0,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
          content: {
            badgeText: 'VERIFIED DIGITAL MARKETPLACE',
            primaryButtonText: 'Browse Catalog',
            primaryButtonUrl: '/products',
            secondaryButtonText: 'Explore Categories',
            secondaryButtonUrl: '/products',
            heroImage: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1200&auto=format&fit=crop&q=80',
            stats: [
              { label: 'Active Users', value: '45,000+' },
              { label: 'Verified Software', value: '1,200+' },
              { label: 'Avg Delivery Time', value: '3.2s' },
              { label: 'Guarantee', value: '14-Day' },
            ],
          },
        },
        {
          sectionKey: 'popular_categories',
          sectionType: 'popular_categories',
          title: 'Browse by Product Category',
          subtitle: 'Explore specialized licenses, software suites, and cloud credentials.',
          order: 1,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
        },
        {
          sectionKey: 'featured_products',
          sectionType: 'featured_products',
          title: 'Featured Software & Deals',
          subtitle: 'Hand-picked digital tools trusted by top engineering and design teams.',
          order: 2,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
        },
        {
          sectionKey: 'trending_products',
          sectionType: 'trending_products',
          title: 'Trending Software Subscriptions',
          subtitle: 'Most popular monthly and annual software access plans.',
          order: 3,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
        },
        {
          sectionKey: 'popular_software',
          sectionType: 'popular_software',
          title: 'Popular Perpetual Software',
          subtitle: 'One-time investment, perpetual developer and creative tools.',
          order: 4,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
        },
        {
          sectionKey: 'special_offers',
          sectionType: 'special_offers',
          title: 'Limited-Time Flash Discounts',
          subtitle: 'Deeply discounted license keys available while limited allocations last.',
          order: 5,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
        },
        {
          sectionKey: 'trust_badges',
          sectionType: 'trust_badges',
          title: 'Why Buy From BundleByte?',
          subtitle: 'Our ironclad reliability guarantee and security standards.',
          order: 6,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
        },
        {
          sectionKey: 'testimonials',
          sectionType: 'testimonials',
          title: 'What Developers & Founders Say',
          subtitle: 'Real customer feedback from software teams across the globe.',
          order: 7,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
        },
        {
          sectionKey: 'faq',
          sectionType: 'faq',
          title: 'Frequently Asked Questions',
          subtitle: 'Everything you need to know about licensing, dispatch, and warranties.',
          order: 8,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
        },
        {
          sectionKey: 'newsletter',
          sectionType: 'newsletter',
          title: 'Join the BundleByte Developer Club',
          subtitle: 'Get notified about limited flash drops, coupon codes, and new tool releases.',
          order: 9,
          isEnabled: true,
          visibility: { devices: 'all', audience: 'all' },
        },
      ]);
    }

    // 4. Navigation Menu
    let nav = await NavigationMenu.findOne();
    if (!nav) {
      nav = await NavigationMenu.create({
        headerLogo: {
          useCustomLogo: false,
          customLogoUrl: '',
          logoText: 'BundleByte',
          showTextWithLogo: true,
          heightPx: 36,
        },
        desktopItems: [
          {
            label: 'All Products',
            url: '/products',
            badge: '',
            icon: 'Box',
            order: 0,
            isEnabled: true,
            dropdownItems: [],
          },
          {
            label: 'Subscriptions',
            url: '/products?category=software-subscriptions',
            badge: 'HOT',
            icon: 'Zap',
            order: 1,
            isEnabled: true,
            dropdownItems: [],
          },
          {
            label: 'Digital Accounts',
            url: '/products?category=digital-accounts',
            badge: '',
            icon: 'Lock',
            order: 2,
            isEnabled: true,
            dropdownItems: [],
          },
          {
            label: 'Perpetual Licenses',
            url: '/products?category=digital-licenses',
            badge: '',
            icon: 'KeyRound',
            order: 3,
            isEnabled: true,
            dropdownItems: [],
          },
          {
            label: 'About',
            url: '/page/about',
            badge: '',
            icon: '',
            order: 4,
            isEnabled: true,
            dropdownItems: [],
          },
        ],
        mobileItems: [
          { label: 'Storefront', url: '/', icon: 'Layers', order: 0, isEnabled: true },
          { label: 'All Products', url: '/products', icon: 'Box', order: 1, isEnabled: true },
          { label: 'Customer Vault', url: '/dashboard/vault', icon: 'KeyRound', order: 2, isEnabled: true },
          { label: 'Support Helpdesk', url: '/dashboard/tickets', icon: 'HelpCircle', order: 3, isEnabled: true },
        ],
        controls: {
          showAnnouncementBar: true,
          showSearchBar: true,
          showCurrencySelector: true,
          showAuthButtons: true,
          showCartIcon: true,
          showWalletIcon: true,
          showThemeToggle: true,
          stickyHeader: true,
        },
        isPublished: true,
        version: 1,
      });
    }

    // 5. Footer Settings
    let footer = await FooterSettings.findOne();
    if (!footer) {
      footer = await FooterSettings.create({
        logo: {
          useCustomLogo: false,
          customLogoUrl: '',
          logoText: 'BundleByte',
          showTextWithLogo: true,
        },
        description:
          'The premier marketplace for software subscriptions, digital developer tools, authorized accounts, and genuine perpetual license keys.',
        guaranteeBanner: {
          isEnabled: true,
          badges: [
            {
              icon: 'Zap',
              title: 'Instant Automated Delivery',
              description: 'Keys dispatched to your vault in 3 seconds',
              color: 'indigo',
            },
            {
              icon: 'ShieldCheck',
              title: '100% Genuine & Verified',
              description: 'Authorized digital software distribution',
              color: 'emerald',
            },
            {
              icon: 'RefreshCw',
              title: '14-Day Guarantee',
              description: 'Full replacement if activation fails',
              color: 'violet',
            },
            {
              icon: 'Headphones',
              title: '24/7 Expert Support',
              description: 'Dedicated ticketing & setup guidance',
              color: 'blue',
            },
          ],
        },
        columns: [
          {
            title: 'Categories',
            order: 0,
            isEnabled: true,
            links: [
              { label: 'Software Subscriptions', url: '/products?category=software-subscriptions' },
              { label: 'Digital Accounts', url: '/products?category=digital-accounts' },
              { label: 'Software Access Links', url: '/products?category=software-access-links' },
              { label: 'Digital Licenses', url: '/products?category=digital-licenses' },
              { label: 'All Products →', url: '/products' },
            ],
          },
          {
            title: 'Customer Portal',
            order: 1,
            isEnabled: true,
            links: [
              { label: 'My License Vault', url: '/dashboard/vault' },
              { label: 'My Subscriptions', url: '/dashboard/subscriptions' },
              { label: 'Orders & Invoices', url: '/dashboard/orders' },
              { label: 'Support Tickets', url: '/dashboard/tickets' },
              { label: 'Shopping Cart', url: '/cart' },
            ],
          },
          {
            title: 'Legal & Trust',
            order: 2,
            isEnabled: true,
            links: [
              { label: 'Terms of Service', url: '/terms' },
              { label: 'Privacy Policy', url: '/privacy' },
              { label: 'Refund & Guarantee', url: '/refund-policy' },
              { label: 'Distribution Compliance', url: '/compliance' },
              { label: 'Shipping & Delivery', url: '/page/shipping' },
            ],
          },
        ],
        socialLinks: [
          { platform: 'Twitter / X', url: 'https://twitter.com/BundleByte', icon: 'Twitter', isEnabled: true },
          { platform: 'Discord', url: 'https://discord.gg/bundlebyte', icon: 'MessageCircle', isEnabled: true },
          { platform: 'Telegram', url: 'https://t.me/bundlebyte_announcements', icon: 'Send', isEnabled: true },
          { platform: 'GitHub', url: 'https://github.com/bundlebyte', icon: 'Github', isEnabled: true },
        ],
        contactInfo: {
          showInFooter: true,
          email: 'support@bundlebyte.com',
          phone: '+1 (555) 019-2834',
          address: '100 Silicon Way, Suite 400, San Francisco, CA',
          hours: '24/7 Digital Fulfillment & Support',
        },
        paymentMethods: [
          { name: 'Visa', code: 'visa', isEnabled: true },
          { name: 'Mastercard', code: 'mastercard', isEnabled: true },
          { name: 'American Express', code: 'amex', isEnabled: true },
          { name: 'Stripe', code: 'stripe', isEnabled: true },
          { name: 'PayPal', code: 'paypal', isEnabled: true },
          { name: 'Binance Pay (Crypto)', code: 'binance', isEnabled: true },
          { name: 'UPI Dynamic QR', code: 'upi', isEnabled: true },
        ],
        legalLinks: [
          { label: 'Terms of Service', url: '/terms' },
          { label: 'Privacy Policy', url: '/privacy' },
          { label: 'Refund Policy', url: '/refund-policy' },
        ],
        copyrightText: 'BundleByte Marketplace. All rights reserved. Authorized distribution.',
        newsletter: {
          isEnabled: true,
          title: 'Subscribe to Secret Deals & Releases',
          subtitle: 'Get notified about exclusive software drops, flash sales, and early-bird licensing discounts.',
          placeholder: 'Enter your business email...',
          buttonText: 'Subscribe',
        },
        isPublished: true,
        version: 1,
      });
    }

    // 6. System Pages (About, FAQ, Terms, Privacy, Refund, Shipping)
    const pages = [
      {
        slug: 'about',
        title: 'About BundleByte',
        pageType: 'about',
        isSystemPage: true,
        status: 'published',
        excerpt: 'Learn more about BundleByte, our mission, and our verified software distribution network.',
        blocks: [
          {
            blockType: 'hero',
            order: 0,
            title: 'Empowering Builders With Genuine Software',
            subtitle:
              'BundleByte bridges developers, creators, and enterprises with authenticated, discounted digital subscriptions and perpetual tools.',
          },
          {
            blockType: 'rich_text',
            order: 1,
            title: 'Our Story & Vision',
            content: `### Welcome to BundleByte

Founded in 2024, **BundleByte** is built on a simple premise: software tools should be accessible, genuine, and delivered immediately. 

Modern software development requires dozens of subscriptions—from IDEs and database managers to design suites, cloud services, and AI APIs. Small teams and individual engineers often face exorbitant retail pricing. BundleByte aggregates bulk enterprise licensing volume to bring top-tier software licenses to developers worldwide at a fraction of the cost.

#### Why Choose Us?
- **100% Genuine Licenses:** Every product key, subscription voucher, and verified credential in our catalog originates directly from authorized channels.
- **Automated Vault Dispatch:** Our proprietary fulfillment engine automatically allocates and dispatches your credentials to your encrypted private vault in under 3 seconds.
- **14-Day Warranty Replacement:** If any key fails to activate, our 24/7 engineering helpdesk replaces it or issues an immediate store credit refund.`,
          },
        ],
        seo: {
          metaTitle: 'About Us | BundleByte Marketplace',
          metaDescription: 'Learn about BundleByte mission, authentic digital software licensing, and automated vault delivery.',
        },
      },
      {
        slug: 'faq',
        title: 'Frequently Asked Questions',
        pageType: 'faq',
        isSystemPage: true,
        status: 'published',
        excerpt: 'Common questions regarding license activation, delivery, warranty, and payment methods.',
        blocks: [
          {
            blockType: 'hero',
            order: 0,
            title: 'Frequently Asked Questions',
            subtitle: 'Got questions? We have answers. Find quick help below or reach out to our 24/7 support desk.',
          },
          {
            blockType: 'faq_accordion',
            order: 1,
            title: 'Licensing & Activation',
            data: {
              items: [
                {
                  question: 'How quickly do I receive my software license or account?',
                  answer:
                    'Instantly! All digital licenses, software access links, and automated accounts are dispatched to your Customer Vault within 3 seconds of payment confirmation.',
                },
                {
                  question: 'Are these perpetual licenses or recurring subscriptions?',
                  answer:
                    'We offer both! The product card clearly states whether an item is a monthly subscription, annual subscription, or lifetime perpetual license.',
                },
                {
                  question: 'What is the 14-day warranty policy?',
                  answer:
                    'Every purchase is backed by our 14-Day Ironclad Guarantee. If your key or access credentials encounter any activation roadblock, our concierge team will troubleshoot, replace the key, or issue an immediate refund.',
                },
                {
                  question: 'Which payment methods do you accept?',
                  answer:
                    'We accept Credit/Debit cards via Stripe, PayPal, Binance USDT (Crypto with automated TXID verification), and UPI/QR code transfers with instant payment matching.',
                },
              ],
            },
          },
        ],
        seo: {
          metaTitle: 'FAQ | BundleByte Marketplace Help',
          metaDescription: 'Find answers about software licenses, activation, warranties, and payment methods.',
        },
      },
      {
        slug: 'shipping',
        title: 'Instant Delivery Policy',
        pageType: 'shipping',
        isSystemPage: true,
        status: 'published',
        excerpt: 'How digital fulfillment, instant vault dispatch, and manual concierge works.',
        blocks: [
          {
            blockType: 'hero',
            order: 0,
            title: 'Zero Physical Shipping – 100% Instant Digital Dispatch',
            subtitle: 'Learn how your purchased licenses and digital assets are delivered safely to your private vault.',
          },
          {
            blockType: 'rich_text',
            order: 1,
            title: 'Delivery Methodology',
            content: `### 100% Digital Delivery Notice

BundleByte sells **intangible digital goods**. No physical boxes, DVDs, or packages are shipped to your physical address.

#### Instant Vault Delivery (3 Seconds)
For digital licenses, software activation links, and automated account credentials, our automated backend assigns a unique inventory item from our encrypted pool and unlocks it inside your **Customer Dashboard > License Vault** immediately after payment is verified.

#### WhatsApp VIP Concierge Delivery (15-30 Minutes)
For VIP Concierge software items, you will receive an invitation to connect directly with our fulfillment operator via WhatsApp with your Order ID for personalized environment setup.`,
          },
        ],
        seo: {
          metaTitle: 'Delivery & Shipping Policy | BundleByte',
          metaDescription: 'Instant digital license delivery policy and customer vault access details.',
        },
      },
      {
        slug: 'contact',
        title: 'Contact Support',
        pageType: 'contact',
        isSystemPage: true,
        status: 'published',
        excerpt: 'Get in touch with our customer success and developer support teams.',
        blocks: [
          {
            blockType: 'hero',
            order: 0,
            title: 'We’re Here to Help 24/7',
            subtitle: 'Have a pre-purchase question or need assistance activating your software? Our engineering team is always ready.',
          },
          {
            blockType: 'contact_card',
            order: 1,
            title: 'Direct Channels',
            data: {
              email: 'support@bundlebyte.com',
              phone: '+1 (555) 019-2834',
              address: '100 Silicon Way, Suite 400, San Francisco, CA 94107',
              supportHours: '24 Hours a day, 7 Days a week',
              ticketUrl: '/dashboard/tickets',
            },
          },
        ],
        seo: {
          metaTitle: 'Contact Us | BundleByte Support Desk',
          metaDescription: 'Get 24/7 customer support for all software orders, licensing questions, and invoices.',
        },
      },
    ];

    for (const pageData of pages) {
      const existingPage = await WebsitePage.findOne({ slug: pageData.slug });
      if (!existingPage) {
        await WebsitePage.create(pageData);
      }
    }

    // 7. SEO Settings
    let seo = await SEOSettings.findOne();
    if (!seo) {
      seo = await SEOSettings.create({
        defaultTitle: 'BundleByte | Software Subscriptions & Digital Licenses Marketplace',
        titleTemplate: '%s | BundleByte',
        defaultDescription:
          'Premier digital software license marketplace. Instant automated delivery for developer tools, IDEs, creative suites, and perpetual enterprise licenses.',
        defaultKeywords: ['software licenses', 'digital keys', 'subscriptions', 'developer tools', 'IDE licenses', 'instant delivery'],
        homepage: {
          title: 'BundleByte – Genuine Software Subscriptions & Digital Licenses',
          description: 'Buy authentic software subscriptions and digital license keys with automated vault delivery and 14-day warranty guarantee.',
          keywords: ['buy software licenses', 'cheap subscriptions', 'digital license keys'],
        },
        openGraph: {
          title: 'BundleByte – Authentic Software Licenses & Subscriptions',
          description: 'Verified perpetual software keys and digital subscriptions delivered directly to your customer vault in seconds.',
          image: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=1200&auto=format&fit=crop&q=80',
          siteName: 'BundleByte',
          type: 'website',
        },
        twitterCard: {
          cardType: 'summary_large_image',
          siteHandle: '@BundleByte',
          creatorHandle: '@BundleByte',
        },
        canonicalBaseUrl: 'https://bundlebyte.com',
        isPublished: true,
        version: 1,
      });
    }

    // 8. Announcement Sample
    const announcementCount = await Announcement.countDocuments();
    if (announcementCount === 0) {
      await Announcement.create({
        title: 'Welcome 20% Discount Announcement',
        type: 'top_bar',
        text: '🚀 Flash Sale: Use code WELCOME20 for 20% off all software subscriptions & digital licenses!',
        badge: 'LIMITED OFFER',
        icon: 'Tag',
        backgroundColor: 'from-indigo-900 via-indigo-800 to-violet-900',
        textColor: '#ffffff',
        ctaButton: {
          enabled: true,
          text: 'Shop Now',
          url: '/products',
          openInNewTab: false,
        },
        targetPages: ['*'],
        priority: 10,
        isDismissible: true,
        status: 'published',
      });
    }

    // 9. Popup Sample (Welcome / Discount Coupon Popup)
    const popupCount = await Popup.countDocuments();
    if (popupCount === 0) {
      await Popup.create({
        name: 'New Visitor Welcome 20% Discount',
        popupType: 'discount_coupon',
        status: 'published',
        priority: 5,
        design: {
          title: 'Get 20% Off Your First Software Key!',
          subtitle: 'Welcome to BundleByte Enterprise Marketplace',
          description:
            'Unlock instant access to verified developer tools, creative suites, and perpetual licenses with our exclusive new visitor promo code.',
          badge: 'EXCLUSIVE DISCOUNT',
          image: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=600&auto=format&fit=crop&q=80',
          backgroundColor: '#ffffff',
          textColor: '#0f172a',
          primaryButtonText: 'Claim 20% Off & Shop',
          primaryButtonUrl: '/products',
          primaryButtonColor: '#4f46e5',
          primaryButtonTextColor: '#ffffff',
          couponCode: 'WELCOME20',
          discountAmount: '20% OFF',
          showCloseButton: true,
          width: 'max-w-lg',
          borderRadius: 'rounded-3xl',
          animation: 'zoom',
          overlayOpacity: '50',
        },
        displayRules: {
          showOnHomepage: true,
          showOnProductPages: true,
          showOnCheckout: false,
          showOnLoginPage: false,
          showOnRegisterPage: false,
          selectedPages: [],
          showToLoggedIn: true,
          showToGuests: true,
          selectedCustomerGroups: ['all'],
        },
        triggerRules: {
          triggerType: 'delay',
          delaySeconds: 3,
          scrollPercent: 40,
          frequencyCap: 'once_per_session',
        },
        scheduling: {
          isScheduled: false,
        },
      });
    }

    // 10. Sample Promotional Banner
    const bannerCount = await Banner.countDocuments();
    if (bannerCount === 0) {
      await Banner.create({
        title: 'JetBrains All Products Pack Mega Discount',
        bannerType: 'promotional',
        placement: 'homepage_mid',
        desktopImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1200&auto=format&fit=crop&q=80',
        mobileImage: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=600&auto=format&fit=crop&q=80',
        targetUrl: '/products?category=software-subscriptions',
        headline: 'Supercharge Your Developer Workflow',
        subheadline: 'JetBrains, GitHub Copilot, Adobe CC, and Microsoft 365 available at wholesale licensing tiers.',
        badgeText: 'HOT DEAL',
        ctaButton: {
          enabled: true,
          text: 'Browse Developer Tools',
          style: 'primary',
        },
        status: 'published',
        priority: 5,
      });
    }

    // 11. Master WebsiteSettings coordinator
    let masterSettings = await WebsiteSettings.findOne();
    if (!masterSettings) {
      masterSettings = await WebsiteSettings.create({
        masterKey: 'PRIMARY_WEBSITE_CONFIG',
        maintenanceMode: {
          enabled: false,
          title: 'Scheduled System Maintenance',
          message:
            'We are currently performing routine upgrades on our licensing vault servers. We will be back online shortly!',
          allowedIps: [],
        },
        currentLiveVersion: 1,
        hasUnpublishedDrafts: false,
        lastPublishedAt: new Date(),
      });
    }

    // 12. Create initial Version snapshot (v1)
    const versionCount = await WebsiteVersion.countDocuments();
    if (versionCount === 0) {
      const allSections = await HomepageSection.find().sort({ order: 1 });
      await WebsiteVersion.create({
        versionNumber: 1,
        versionName: 'Initial Baseline Production Release',
        notes: 'System default initialized configuration for BundleByte Website Control Center.',
        isLive: true,
        snapshotData: {
          branding: branding?.toObject(),
          theme: theme?.toObject(),
          homepageSections: allSections.map((s) => s.toObject()),
          navigation: nav?.toObject(),
          footer: footer?.toObject(),
          seo: seo?.toObject(),
        },
      });
    }

    console.log('🌐 Website Control Center system defaults initialized successfully.');
  } catch (error) {
    console.error('Error ensuring website system defaults:', error);
  }
};

