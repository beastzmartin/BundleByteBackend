import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { ENV } from './config/environment.js';
import { connectDB } from './config/db.js';
import { initMailer } from './config/mailer.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { seedDatabase } from './seeds/seed.js';
import User from './models/User.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import deliveryRoutes from './routes/deliveryRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import couponRoutes from './routes/couponRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import wishlistRoutes from './routes/wishlistRoutes.js';
import ticketRoutes from './routes/ticketRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import walletRoutes from './routes/walletRoutes.js';
import adminWalletRoutes from './routes/adminWalletRoutes.js';
import adminLicenseRoutes from './routes/adminLicenseRoutes.js';
import adminDeliveryRoutes from './routes/adminDeliveryRoutes.js';
import adminAccountRoutes from './routes/adminAccountRoutes.js';
import adminInventoryRoutes from './routes/adminInventoryRoutes.js';
import whatsappDeliveryRoutes from './routes/whatsappDeliveryRoutes.js';
import adminBinanceRoutes from './routes/adminBinanceRoutes.js';
import adminEmailRoutes from './routes/adminEmailRoutes.js';
import adminLinkRoutes from './routes/adminLinkRoutes.js';
import adminUserRoutes from './routes/adminUserRoutes.js';
import paytmRoutes from './routes/paytmRoutes.js';
import adminPaytmRoutes from './routes/adminPaytmRoutes.js';
import currencyRoutes from './routes/currencyRoutes.js';
import adminCurrencyRoutes from './routes/adminCurrencyRoutes.js';
import websiteRoutes from './routes/websiteRoutes.js';
import adminWebsiteRoutes from './routes/adminWebsiteRoutes.js';
import adminPopupRoutes from './routes/adminPopupRoutes.js';
import adminAnnouncementRoutes from './routes/adminAnnouncementRoutes.js';
import adminBannerRoutes from './routes/adminBannerRoutes.js';
import teamRoutes from './routes/teamRoutes.js';
import teamRoleRoutes from './routes/teamRoleRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import invitationRoutes from './routes/invitationRoutes.js';
import approvalRoutes from './routes/approvalRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import supportAnalyticsRoutes from './routes/supportAnalyticsRoutes.js';
import { initSocket } from './services/socketHandler.js';
import slaService from './services/slaService.js';
import rbacService from './services/rbacService.js';
import { startPaytmCronWorker } from './services/payment/paytmCronService.js';
import { ensureDefaultTemplates } from './services/emailTemplateDefaults.js';
import { ensureDefaultEmailProviders } from './services/providerManagerService.js';
import { ensureCurrencySystemDefaults } from './services/currency/currencySeedService.js';
import { ensureWebsiteSystemDefaults } from './services/website/websiteDefaultsService.js';
import path from 'path';

const app = express();

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Serve uploaded website assets (logos, banners, popup media)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'backend/uploads')));

// Logging
if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// CORS setup for frontend communications
const allowedOrigins = [ENV.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, postman)
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/preview
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput);

// Apply rate limiting to all standard API routes
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: ENV.NODE_ENV,
    uptime: process.uptime(),
  });
});

// SEO & Crawler endpoints (Section 12)
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Disallow: /dashboard/
Disallow: /admin/
Disallow: /api/

Sitemap: ${ENV.CLIENT_URL}/sitemap.xml
`);
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const Product = (await import('./models/Product.js')).default;
    const Category = (await import('./models/Category.js')).default;
    const products = await Product.find({ status: 'active' }).select('slug updatedAt');
    const categories = await Category.find({ isActive: true }).select('slug updatedAt');

    const baseUrl = ENV.CLIENT_URL;
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/products</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
`;

    categories.forEach((cat) => {
      xml += `  <url>
    <loc>${baseUrl}/category/${cat.slug}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
    });

    products.forEach((prod) => {
      xml += `  <url>
    <loc>${baseUrl}/product/${prod.slug}</loc>
    <lastmod>${prod.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
    });

    const WebsitePage = (await import('./models/WebsitePage.js')).default;
    const pages = await WebsitePage.find({ status: 'published', 'seo.noIndex': false }).select('slug updatedAt');
    pages.forEach((pg) => {
      xml += `  <url>
    <loc>${baseUrl}/page/${pg.slug}</loc>
    <lastmod>${pg.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>\n`;
    });

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    res.status(500).end();
  }
});

// Root Health & API Info
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BundleByte Marketplace API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments/paytm', paytmRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/admin/wallets', adminWalletRoutes);
app.use('/api/admin/licenses', adminLicenseRoutes);
app.use('/api/admin/deliveries', adminDeliveryRoutes);
app.use('/api/admin/accounts', adminAccountRoutes);
app.use('/api/admin/inventory', adminInventoryRoutes);
app.use('/api/whatsapp-deliveries', whatsappDeliveryRoutes);
app.use('/api/admin/binance', adminBinanceRoutes);
app.use('/api/admin/paytm', adminPaytmRoutes);
app.use('/api/admin/email', adminEmailRoutes);
app.use('/api/admin/links', adminLinkRoutes);
app.use('/api/admin/inventory/links', adminLinkRoutes);
app.use('/api/admin/users', adminUserRoutes);
app.use('/api/currencies', currencyRoutes);
app.use('/api/admin/currencies', adminCurrencyRoutes);

// Website Control Center & Popup Management Routes
app.use('/api/website', websiteRoutes);
app.use('/api/admin/website', adminWebsiteRoutes);
app.use('/api/admin/popups', adminPopupRoutes);
app.use('/api/admin/announcements', adminAnnouncementRoutes);
app.use('/api/admin/banners', adminBannerRoutes);

// Enterprise RBAC & Team Management Routes
app.use('/api/admin/team', teamRoutes);
app.use('/api/admin/roles', teamRoleRoutes);
app.use('/api/admin/departments', departmentRoutes);
app.use('/api/admin/invitations', invitationRoutes);
app.use('/api/admin/approvals', approvalRoutes);

// Invoices & Email Notification Routes
app.use('/api/invoices', invoiceRoutes);
app.use('/api/email', emailRoutes);

// Support Desk & Live Chat Routes
app.use('/api/chat', chatRoutes);
app.use('/api/admin/support', supportAnalyticsRoutes);

app.use('/api/admin', adminRoutes);

// Fallback 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.originalUrl} not found` });
});

// Global Error Handler
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    await connectDB();
    await initMailer();
    await ensureDefaultTemplates();
    await ensureDefaultEmailProviders();
    await ensureCurrencySystemDefaults();
    await ensureWebsiteSystemDefaults();
    await rbacService.seedSystemRolesAndDepartments();

    // Auto-seed if database is brand new (e.g. embedded memory server or empty DB)
    const adminCount = await User.countDocuments({ role: { $in: ['admin', 'super_admin'] } });
    if (adminCount === 0) {
      console.log('🔄 First boot detected: running initial seed data...');
      await seedDatabase();
    } else {
      // Ensure WhatsApp Concierge product is available even if database was previously initialized
      const Product = (await import('./models/Product.js')).default;
      const Category = (await import('./models/Category.js')).default;
      const WebsiteSetting = (await import('./models/WebsiteSetting.js')).default;

      // Ensure Binance & UPI gateways initialized
      const settings = await WebsiteSetting.findOne();
      if (settings) {
        let modified = false;
        if (!settings.gateways) {
          settings.gateways = {};
          modified = true;
        }
        if (!settings.gateways.binance) {
          settings.gateways.binance = {
            enabled: true,
            name: 'Binance USDT (TRC20 / BEP20)',
            apiKey: '',
            apiSecret: '',
            depositAddress: 'TLR7Vw3G1uK4K4U5w6q7N9x8yZ2A1B3C4D',
            network: 'TRX',
            autoVerifyEnabled: true,
            minDepositUsdt: 1,
            usdtToUsdRate: 1.0,
            usdtToInrRate: 86.5,
          };
          modified = true;
        }
        if (!settings.gateways.upi) {
          settings.gateways.upi = {
            enabled: true,
            name: 'UPI / QR Code Transfer',
            vpa: 'bundlebyte@upi',
            upiId: 'bundlebyte@upi',
            merchantName: 'BundleByte Technologies Inc.',
            qrCodeUrl: '',
            autoApproveTrusted: true,
          };
          modified = true;
        } else if (!settings.gateways.upi.vpa) {
          settings.gateways.upi.vpa = settings.gateways.upi.upiId || 'bundlebyte@upi';
          modified = true;
        }
        if (modified) {
          settings.markModified('gateways');
          await settings.save();
        }
      }
      // Ensure Paytm merchants exist
      const PaytmMerchant = (await import('./models/PaytmMerchant.js')).default;
      const MerchantRoutingConfig = (await import('./models/MerchantRoutingConfig.js')).default;
      const { encryptCredential } = await import('./utils/credentialEncryption.js');

      const merchantCount = await PaytmMerchant.countDocuments({ isDeleted: false });
      if (merchantCount === 0) {
        console.log('💳 Initializing default Paytm merchant accounts & routing...');
        const merchantA = await PaytmMerchant.create({
          merchantName: 'BundleByte Payments Ltd.',
          mid: 'BUNDLEBYTEPROD01',
          merchantKey: encryptCredential('SamplePaytmMerchantSecretKey2026A'),
          upiId: 'bundlebyte@paytm',
          websiteName: 'DEFAULT',
          industryType: 'Retail',
          channelId: 'WEB',
          environment: 'production',
          status: 'active',
          priority: 1,
          minAmount: 1,
          maxAmount: 100000,
          dailyLimit: 200000,
          currentDailyVolume: 0,
          notes: 'Primary High-Volume Merchant Account',
        });

        const merchantB = await PaytmMerchant.create({
          merchantName: 'ByteTech Digital Solutions',
          mid: 'BYTETECHDIGITAL02',
          merchantKey: encryptCredential('SamplePaytmMerchantSecretKey2026B'),
          upiId: 'bytetech@icici',
          websiteName: 'DEFAULT',
          industryType: 'Retail',
          channelId: 'WEB',
          environment: 'production',
          status: 'active',
          priority: 2,
          minAmount: 1,
          maxAmount: 50000,
          dailyLimit: 100000,
          currentDailyVolume: 0,
          notes: 'Secondary / Tier-2 Failover Merchant Account',
        });

        await MerchantRoutingConfig.create({
          routingStrategy: 'round_robin',
          manualMerchant: merchantA._id,
          enableAutomaticFailover: true,
          amountBrackets: [
            { min: 1, max: 2000, merchant: merchantA._id, label: 'Standard Orders (<₹2,000)' },
            { min: 2001, max: 100000, merchant: merchantB._id, label: 'High-Value Orders (₹2,000+)' },
          ],
          failoverOrder: [merchantA._id, merchantB._id],
        });
      }

      if (settings && !settings.gateways?.paytm) {
        if (!settings.gateways) settings.gateways = {};
        settings.gateways.paytm = {
          enabled: true,
          name: 'Paytm Merchant Dynamic QR',
          defaultMid: 'BUNDLEBYTEPROD01',
          autoVerifyEnabled: true,
          pollingIntervalSeconds: 2,
          timeoutMinutes: 5,
        };
        settings.markModified('gateways');
        await settings.save();
      }

      const waExists = await Product.findOne({
        $or: [
          { slug: 'whatsapp-concierge-vip-tool' },
          { slug: 'whatsapp-concierge-vip-tool-1793971843231' },
          { title: 'WhatsApp Concierge VIP Tool' },
        ],
      });

      if (!waExists) {
        console.log('🔄 Seeding missing WhatsApp Concierge VIP Tool products...');
        const catAccounts = (await Category.findOne({ name: 'Digital Accounts' })) || (await Category.findOne());
        if (catAccounts) {
          await Product.create([
            {
              title: 'WhatsApp Concierge VIP Tool',
              slug: 'whatsapp-concierge-vip-tool',
              category: catAccounts._id,
              subCategory: 'VIP Concierge Software',
              summary: 'Exclusive software delivered manually via WhatsApp concierge with verified access credentials and dedicated VIP support.',
              description: 'Experience hands-on fulfillment with our WhatsApp Concierge VIP Tool. After checkout, connect directly with our dedicated concierge support on WhatsApp. Our team will verify and provision your custom VIP access credentials, setup keys, and enterprise environment in real-time.',
              logo: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=200&auto=format&fit=crop&q=80',
              images: [
                'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
                'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1000&auto=format&fit=crop&q=80',
              ],
              tags: ['whatsapp', 'concierge', 'vip', 'software', 'manual-delivery'],
              isFeatured: true,
              isTrending: true,
              isPopular: true,
              isSpecialOffer: true,
              badge: 'WHATSAPP VIP',
              deliveryType: 'whatsapp_manual',
              deliveryMethod: 'whatsapp_manual',
              whatsappConfig: {
                businessPhone: '+91 98765 43210',
                messageTemplate: 'Hello Concierge! I purchased Order #{orderId} for {productTitle}. Please deliver credentials.',
                instructions: 'Click the button below to message our concierge team directly on WhatsApp.',
                buttonText: 'Contact Concierge on WhatsApp',
                expectedDeliveryTime: '15-30 minutes',
              },
              deliveryInstructions: 'Click the Contact Concierge button in your dashboard or order receipt to open a secure WhatsApp chat with our fulfillment team.',
              pricing: {
                monthly: { enabled: true, price: 19.99, originalPrice: 39.99 },
                quarterly: { enabled: true, price: 49.99, originalPrice: 89.99 },
                half_yearly: { enabled: true, price: 79.99, originalPrice: 149.99 },
                annual: { enabled: true, price: 99.00, originalPrice: 199.00 },
                lifetime: { enabled: true, price: 249.99, originalPrice: 499.00 },
              },
              defaultDuration: 'annual',
              status: 'active',
              averageRating: 5.0,
              totalReviews: 18,
              salesCount: 65,
            },
            {
              title: 'WhatsApp Concierge VIP Tool 1793971843231',
              slug: 'whatsapp-concierge-vip-tool-1793971843231',
              category: catAccounts._id,
              subCategory: 'VIP Concierge Software',
              summary: 'Exclusive software delivered manually via WhatsApp concierge with verified access credentials and dedicated VIP support.',
              description: 'Full description of VIP concierge tool with instant WhatsApp fulfillment and verified access credentials.',
              logo: 'https://images.unsplash.com/photo-1618401471353-b98aedd04e11?w=200&auto=format&fit=crop&q=80',
              images: [
                'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80',
              ],
              tags: ['whatsapp', 'concierge', 'vip', 'software', 'manual-delivery'],
              isFeatured: false,
              isTrending: false,
              isPopular: true,
              badge: 'WHATSAPP VIP',
              deliveryType: 'whatsapp_manual',
              deliveryMethod: 'whatsapp_manual',
              whatsappConfig: {
                businessPhone: '+91 98765 43210',
                messageTemplate: 'Hello Concierge! I purchased Order #{orderId} for {productTitle}. Please deliver credentials.',
                instructions: 'Click the button below to message our concierge team directly on WhatsApp.',
                buttonText: 'Contact Concierge on WhatsApp',
                expectedDeliveryTime: '15-30 minutes',
              },
              deliveryInstructions: 'Click the Contact Concierge button in your dashboard or order receipt to open a secure WhatsApp chat with our fulfillment team.',
              pricing: {
                monthly: { enabled: true, price: 19.99, originalPrice: 39.99 },
                quarterly: { enabled: true, price: 49.99, originalPrice: 89.99 },
                half_yearly: { enabled: true, price: 79.99, originalPrice: 149.99 },
                annual: { enabled: true, price: 99.00, originalPrice: 199.00 },
                lifetime: { enabled: true, price: 249.99, originalPrice: 499.00 },
              },
              defaultDuration: 'annual',
              status: 'active',
              averageRating: 5.0,
              totalReviews: 12,
              salesCount: 42,
            },
          ]);
        }
      }
      // Ensure all products have activation instructions, order notes, and structured steps
      const allProducts = await Product.find();
      for (const prod of allProducts) {
        if (!prod.activationProcess || prod.activationProcess.trim() === '') {
          if (prod.slug?.includes('jetbrains')) {
            prod.setupGuideUrl = prod.setupGuideUrl || 'https://www.jetbrains.com/help/idea/register.html';
            prod.defaultAccessLink = prod.defaultAccessLink || 'https://account.jetbrains.com';
            prod.activationProcess = `### Step-by-Step JetBrains All Products Pack Activation:\n1. **Download & Install:** Download the official JetBrains Toolbox App or standalone IDE from https://www.jetbrains.com/products.\n2. **Launch IDE:** Open your installed IDE and navigate to the top menu: **Help -> Register...**\n3. **Select Activation Method:** Choose **Activation Code**.\n4. **Enter Your License Key:** Copy your allocated license code directly from your BundleByte Vault and paste it into the activation text box.\n5. **Confirm Activation:** Click **Activate** to unlock your software!`;
            prod.orderNote = `⚠️ **Important Post-Purchase Guidelines:**\n- Authorized for commercial development across up to 2 workstations used by you.\n- Do NOT share or distribute this license ticket publicly on forums or GitHub.\n- 14-day warranty replacement guarantee included.`;
            prod.activationSteps = [
              { stepNumber: 1, title: 'Download JetBrains IDE or Toolbox', instruction: 'Download the official installer for your OS directly from jetbrains.com/products.' },
              { stepNumber: 2, title: 'Navigate to Registration Dialog', instruction: 'Launch the application and select Help -> Register from the top menu.' },
              { stepNumber: 3, title: 'Paste License Activation Code', instruction: 'Select "Activation Code", copy your key from your vault above, paste it into the code area, and click "Activate".' },
              { stepNumber: 4, title: 'Verify Subscription Status', instruction: 'Confirm the green checkmark appears showing valid commercial entitlement.' },
            ];
          } else if (prod.slug?.includes('adobe')) {
            prod.setupGuideUrl = prod.setupGuideUrl || 'https://helpx.adobe.com/creative-cloud/help/download-install-app.html';
            prod.defaultAccessLink = prod.defaultAccessLink || 'https://creativecloud.adobe.com';
            prod.activationProcess = `### Step-by-Step Adobe Creative Cloud All Apps Activation:\n1. **Redeem Voucher:** Visit the official Adobe redemption portal at https://redeem.adobe.com.\n2. **Sign In / Create Adobe ID:** Sign in with your existing personal Adobe ID or create a new free Adobe account.\n3. **Input Redemption Code:** Copy your 24-character alphanumeric redemption key from your BundleByte Vault and paste it into the code field.\n4. **Confirm Plan:** Click 'Redeem Code'. Your account will immediately be upgraded with 100GB Cloud Storage and Firefly AI credits.\n5. **Download Apps:** Download the Adobe Creative Cloud Desktop client from https://creativecloud.adobe.com/apps.`;
            prod.orderNote = `⚠️ **Adobe Licensing & Warranty Rules:**\n- The redemption code must be redeemed within 30 days of purchase.\n- Install and activate applications on up to 2 machines simultaneously.\n- Full 14-day replacement warranty in case of any issues.`;
            prod.activationSteps = [
              { stepNumber: 1, title: 'Open Adobe Redemption Portal', instruction: 'Navigate to redeem.adobe.com in your web browser and sign in with your Adobe ID.' },
              { stepNumber: 2, title: 'Enter 24-Digit Voucher Code', instruction: 'Copy your product redemption key from the vault above and paste it into the prompt.' },
              { stepNumber: 3, title: 'Download Desktop Suite', instruction: 'Install Creative Cloud desktop client and download Photoshop, Premiere, Illustrator, etc.' },
            ];
          } else if (prod.slug?.includes('microsoft') || prod.slug?.includes('office')) {
            prod.setupGuideUrl = prod.setupGuideUrl || 'https://support.microsoft.com/en-us/office';
            prod.defaultAccessLink = prod.defaultAccessLink || 'https://portal.office.com';
            prod.activationProcess = `### Step-by-Step Microsoft 365 Business Standard Activation:\n1. **Access Microsoft Setup:** Visit https://setup.office.com or https://microsoft365.com/setup.\n2. **Sign In:** Sign in with your Microsoft account.\n3. **Enter Product Key:** Copy your 25-character Microsoft Product Key from your vault and paste it.\n4. **Select Region:** Confirm your country/region and preferred interface language.\n5. **Install Desktop Apps:** Download the official installer for Word, Excel, PowerPoint, Outlook, and Teams.\n6. **Activate:** Open Word, sign in with your Microsoft account, and your software is automatically activated.`;
            prod.orderNote = `⚠️ **Warranty & Support Guidelines:**\n- Valid for up to 5 PCs/Macs + 5 Tablets + 5 Mobile devices simultaneously.\n- 1 TB OneDrive storage is automatically linked to your registered Microsoft ID.\n- Includes 14-day money-back/replacement warranty for non-activating keys.`;
            prod.activationSteps = [
              { stepNumber: 1, title: 'Go to setup.office.com', instruction: 'Open setup.office.com and log in with your primary Microsoft account.' },
              { stepNumber: 2, title: 'Redeem 25-Digit License Key', instruction: 'Paste the 25-character license key displayed in your vault and click Next.' },
              { stepNumber: 3, title: 'Run Desktop Installer', instruction: 'Download the installer and follow on-screen instructions.' },
              { stepNumber: 4, title: 'Sign In to Word/Excel', instruction: 'Launch any Office app and sign in with the same Microsoft account.' },
            ];
          } else if (prod.deliveryType === 'account_credentials' || prod.category?.name === 'Digital Accounts') {
            prod.activationProcess = `### Step-by-Step Account Sign-in Guide:\n1. **Open Official Portal:** Navigate to the official service portal in an Incognito / Private browser window.\n2. **Enter Username:** Copy your delivered username/email from your vault above.\n3. **Enter Password:** Copy your password from your vault and paste it.\n4. **Update Password:** For your personal security, change the password upon initial login if permitted.\n5. **Enjoy:** You have full authorized access to all premium tier features!`;
            prod.orderNote = `⚠️ **Account Usage Guidelines:**\n- Do not share these credentials publicly or attempt to resell access.\n- Full 14-day replacement warranty if initial authentication encounters issues.`;
            prod.activationSteps = [
              { stepNumber: 1, title: 'Open Portal in Incognito', instruction: 'Open a private window and go to the official vendor login page.' },
              { stepNumber: 2, title: 'Input Account Credentials', instruction: 'Paste the username and password revealed in your vault above.' },
              { stepNumber: 3, title: 'Secure & Access', instruction: 'Sign in, configure any optional 2FA recovery, and access your unlocked software.' },
            ];
          } else {
            prod.activationProcess = `### Step-by-Step Software Activation Guide:\n1. **Download:** Download the latest official software build from the vendor portal.\n2. **Install:** Run the installer following default system prompts.\n3. **Activate:** Open the software, navigate to Help / Settings / License, and input your allocated digital key.\n4. **Enjoy:** Your license is now fully unlocked and operational!`;
            prod.orderNote = `⚠️ **Post-Purchase Terms & Warranty:**\n- 14-day replacement guarantee included if you encounter any authentication or key validation issues.\n- Please retain your Order ID for any customer support communications.`;
            prod.activationSteps = [
              { stepNumber: 1, title: 'Download Vendor Software', instruction: 'Download the official installer for your computer or device.' },
              { stepNumber: 2, title: 'Enter Digital License', instruction: 'Copy your license key from your vault and paste it into the application activation box.' },
              { stepNumber: 3, title: 'Verify & Use', instruction: 'Confirm activation succeeded and enjoy full unlocked features.' },
            ];
          }
          await prod.save();
        }
      }
    }

    await slaService.seedDefaultSLAs();

    startPaytmCronWorker();

    // Periodic SLA check every 60 seconds
    setInterval(() => {
      slaService.checkAndEscalateTickets().catch((err) => {
        console.error('Error running automated SLA escalation check:', err);
      });
    }, 60000);

    const server = http.createServer(app);

    const io = new SocketIOServer(server, {
      cors: {
        origin: (origin, callback) => {
          callback(null, true);
        },
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    initSocket(io);

    server.listen(ENV.PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚀 BundleByte Backend API running on port ${ENV.PORT}`);
      console.log(`💬 Socket.IO Real-time Support Server online`);
      console.log(`🌐 Environment: ${ENV.NODE_ENV}`);
      console.log(`📡 Client URL: ${ENV.CLIENT_URL}`);
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

