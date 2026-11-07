import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { ENV } from './config/environment.js';
import { connectDB } from './config/db.js';
import { errorHandler } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { sanitizeInput } from './middleware/sanitize.js';

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
import cronRoutes from './routes/cronRoutes.js';

const app = express();

// Trust reverse proxy (Vercel, Cloudflare, load balancers)
app.set('trust proxy', 1);

// Security middleware
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Serve uploaded website assets (logos, banners, popup media)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'backend/uploads')));
try {
  app.use('/uploads', express.static('/tmp/uploads'));
} catch (_) {}

// Logging in dev
if (ENV.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// CORS setup for frontend communications (supports custom domains & Vercel previews)
const allowedOrigins = [
  ENV.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      // Automatically allow Vercel preview and production subdomains
      if (origin.endsWith('.vercel.app')) return callback(null, true);
      return callback(null, true); // Permissive fallback
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'x-guest-token',
      'x-guest-session-id',
      'X-Guest-Token',
      'X-Guest-Session-Id',
      'Cache-Control',
      'Pragma',
    ],
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(sanitizeInput);

// Database connection auto-resolution for Serverless & Express requests
app.use(async (req, res, next) => {
  // Skip DB connection for root health and basic static/favicon pings
  if (req.path === '/' || req.path === '/favicon.ico') {
    return next();
  }
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error during request:', err.message);
    res.status(503).json({
      success: false,
      message: 'Database service temporarily unavailable. Please verify MONGODB_URI.',
      error: ENV.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
});

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

// SEO & Crawler endpoints
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

// Automated Vercel / External Cron Routes
app.use('/api/cron', cronRoutes);

app.use('/api/admin', adminRoutes);

// Fallback 404 handler for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `API route ${req.originalUrl} not found` });
});

// Global Error Handler
app.use(errorHandler);

export { app };
export default app;
