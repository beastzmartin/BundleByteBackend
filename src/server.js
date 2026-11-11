import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app.js';
import { ENV } from './config/environment.js';
import { connectDB } from './config/db.js';
import { initMailer } from './config/mailer.js';
import { seedDatabase } from './seeds/seed.js';
import User from './models/User.js';
import { initSocket } from './services/socketHandler.js';
import slaService from './services/slaService.js';
import rbacService from './services/rbacService.js';
import { startPaytmCronWorker } from './services/payment/paytmCronService.js';
import { ensureDefaultTemplates } from './services/emailTemplateDefaults.js';
import { ensureDefaultEmailProviders } from './services/providerManagerService.js';
import { ensureCurrencySystemDefaults } from './services/currency/currencySeedService.js';
import { ensureWebsiteSystemDefaults } from './services/website/websiteDefaultsService.js';
import { initVapidKeys } from './services/pushNotificationService.js';

// Start server (for Standalone / Local / Docker / VPS deployments)
const startServer = async () => {
  try {
    await connectDB();
    await initMailer();
    await ensureDefaultTemplates();
    await ensureDefaultEmailProviders();
    await ensureCurrencySystemDefaults();
    await ensureWebsiteSystemDefaults();
    await initVapidKeys();
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
    }

    await slaService.seedDefaultSLAs();

    // Start background background processes if not on Vercel
    if (process.env.VERCEL !== '1') {
      startPaytmCronWorker();

      // Periodic SLA check every 60 seconds
      setInterval(() => {
        slaService.checkAndEscalateTickets().catch((err) => {
          console.error('Error running automated SLA escalation check:', err);
        });
      }, 60000);
    }

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

    // Graceful Shutdown Handler (Docker, Kubernetes, and Process Managers)
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}. Initiating graceful container shutdown...`);
      server.close(() => {
        console.log('HTTP and WebSocket servers closed.');
      });

      try {
        const mongoose = (await import('mongoose')).default;
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close(false);
          console.log('MongoDB connection closed.');
        }
      } catch (e) {
        console.error('Error closing MongoDB connection:', e.message);
      }

      console.log('👋 Process exiting cleanly.');
      process.exit(0);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
