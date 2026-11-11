import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';
import PushBroadcastLog from '../models/PushBroadcastLog.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import {
  initVapidKeys,
  getVapidPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
  sendNotificationToUser,
  broadcastPushNotification,
  notifyOrderConfirmed,
  notifyDigitalDeliveryReady,
  notifyWalletTransaction,
  regenerateVapidKeys,
  parseUserAgent,
} from '../services/pushNotificationService.js';

async function runPushSystemTest() {
  console.log('🚀 Starting Superb Advanced Push Notification System Test...\n');

  let mongod = null;
  try {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log('✅ Connected to in-memory test database');

    // 1. Test User Agent Parser
    console.log('\n--- 1. Testing Device & Browser Detection ---');
    const uaMac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    const parsedMac = parseUserAgent(uaMac);
    console.log(`Desktop UA Result: Browser=${parsedMac.browser}, OS=${parsedMac.os}, Device=${parsedMac.deviceType}`);
    if (parsedMac.browser !== 'Google Chrome' || parsedMac.os !== 'macOS' || parsedMac.deviceType !== 'desktop') {
      throw new Error('User-Agent parser failed for Desktop Chrome');
    }

    const uaMobile = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
    const parsedMobile = parseUserAgent(uaMobile);
    console.log(`Mobile UA Result: Browser=${parsedMobile.browser}, OS=${parsedMobile.os}, Device=${parsedMobile.deviceType}`);
    if (parsedMobile.os !== 'iOS' || parsedMobile.deviceType !== 'mobile') {
      throw new Error('User-Agent parser failed for Mobile Safari');
    }
    console.log('✅ User-Agent device detection passed perfectly');

    // 2. Test VAPID Key Initialization & Auto-Generation
    console.log('\n--- 2. Testing VAPID Key Auto-Generation & Persistence ---');
    const vapidConfig = await initVapidKeys();
    console.log(`✅ VAPID Keys initialized: Public Key length=${vapidConfig.publicKey.length}, Subject=${vapidConfig.subject}`);
    if (!vapidConfig.publicKey || vapidConfig.publicKey.length < 50) {
      throw new Error('Invalid VAPID public key generated');
    }

    const cachedKey = await getVapidPublicKey();
    if (cachedKey !== vapidConfig.publicKey) {
      throw new Error('VAPID public key caching failed');
    }
    console.log('✅ VAPID public key cached & verified');

    // 3. Create Sample Test Users (Customer & Admin)
    console.log('\n--- 3. Setting Up Test Users ---');
    const customer = await User.create({
      name: 'Sarah Jenkins',
      email: 'sarah.jenkins@example.com',
      password: 'password123',
      role: 'customer',
      pushNotifications: {
        enabled: true,
        orderUpdates: true,
        deliveryAlerts: true,
        walletAlerts: true,
      },
    });

    const admin = await User.create({
      name: 'Super Admin',
      email: 'admin@bundlebyte.com',
      password: 'password123',
      role: 'super_admin',
    });
    console.log(`✅ Created test customer (${customer.email}) and admin (${admin.email})`);

    // 4. Test Browser Push Subscription Registration
    console.log('\n--- 4. Registering Simulated Device Push Subscriptions ---');
    const mockEndpoint = 'https://fcm.googleapis.com/fcm/send/sample-token-abc-123';
    const mockKeys = {
      p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QT9AcUbVYOISx444b6nO8P60o91444jO4aN4_sample',
      auth: 't-auth-token-sample',
    };

    const registeredDevice = await registerPushSubscription(
      customer._id,
      { endpoint: mockEndpoint, keys: mockKeys },
      uaMac,
      '192.168.1.100'
    );
    console.log(`✅ Device registered: ${registeredDevice.browser} on ${registeredDevice.os} (DeviceType: ${registeredDevice.deviceType})`);

    const count = await PushSubscription.countDocuments({ user: customer._id, isActive: true });
    if (count !== 1) throw new Error('Subscription count mismatch');

    // 5. Test In-App & Dual-Dispatch Notification
    console.log('\n--- 5. Testing Dual-Channel User Notification Dispatch ---');
    const notifRes = await sendNotificationToUser({
      userId: customer._id,
      title: '🎉 Welcome to BundleByte!',
      message: 'Your high-speed digital delivery platform is ready.',
      type: 'system',
      link: '/dashboard',
      priority: 'high',
    });

    if (!notifRes.success) throw new Error('sendNotificationToUser returned unsuccessful');
    console.log(`✅ Notification created in database with ID: ${notifRes.notification._id}`);

    const dbNotif = await Notification.findById(notifRes.notification._id);
    if (!dbNotif || dbNotif.isRead !== false) throw new Error('Notification record validation failed');
    console.log(`✅ Database record verified: Type=${dbNotif.type}, Title="${dbNotif.title}", Read=${dbNotif.isRead}`);

    // 6. Test Business Event Triggers
    console.log('\n--- 6. Testing High-Level Business Triggers ---');

    // Order Confirmation
    const dummyProductId = new mongoose.Types.ObjectId();
    const mockOrder = await Order.create({
      orderNumber: 'BB-98765',
      user: customer._id,
      customerName: customer.name,
      customerEmail: customer.email,
      totalAmount: 1499,
      subtotal: 1499,
      items: [{
        product: dummyProductId,
        productTitle: 'JetBrains All Products Pack',
        quantity: 1,
        unitPrice: 1499,
        totalPrice: 1499,
        deliveryType: 'account_credentials',
        duration: 'annual',
      }],
      paymentStatus: 'paid',
      deliveryStatus: 'delivered',
      currency: 'INR',
    });

    await notifyOrderConfirmed({ order: mockOrder, user: customer });
    console.log('✅ notifyOrderConfirmed executed');

    // Digital Delivery Ready
    await notifyDigitalDeliveryReady({
      order: mockOrder,
      user: customer,
      productTitle: 'JetBrains All Products Pack (1-Year VIP)',
    });
    console.log('✅ notifyDigitalDeliveryReady executed');

    // Wallet Transaction
    await notifyWalletTransaction({
      user: customer,
      type: 'credit',
      amount: '500.00',
      balance: '1250.00',
      description: 'Promotional Cashback',
    });
    console.log('✅ notifyWalletTransaction executed');

    const customerNotifs = await Notification.find({ user: customer._id });
    console.log(`✅ Total in-app notifications generated for customer: ${customerNotifs.length}`);
    if (customerNotifs.length < 4) throw new Error('Expected at least 4 notifications in customer feed');

    // 7. Test Mass Push Broadcast & Telemetry Log
    console.log('\n--- 7. Testing Push Broadcast Dispatch & Telemetry ---');
    const broadcastResult = await broadcastPushNotification({
      title: '⚡ Weekend Flash Sale: 40% Off Cloud Workspaces!',
      body: 'Special developer discount active for the next 48 hours.',
      link: '/products',
      category: 'promo',
      targetAudience: 'all_users',
      createdBy: admin._id,
    });

    console.log(`✅ Broadcast completed in ${broadcastResult.executionTimeMs}ms:`);
    console.log(`   - Subscribers Targeted: ${broadcastResult.totalSubscribersTargeted}`);
    console.log(`   - Dispatched: ${broadcastResult.successfulCount + broadcastResult.failedCount}`);

    const broadcastLog = await PushBroadcastLog.findById(broadcastResult.log._id);
    if (!broadcastLog) throw new Error('Broadcast telemetry log not found');
    console.log(`✅ Telemetry log verified: Title="${broadcastLog.title}", Status=${broadcastLog.status}`);

    // 8. Test VAPID Key Rotation
    console.log('\n--- 8. Testing VAPID Key Regeneration ---');
    const rotated = await regenerateVapidKeys();
    console.log(`✅ VAPID keys regenerated. New key prefix: ${rotated.publicKey.substring(0, 15)}...`);
    if (rotated.publicKey === vapidConfig.publicKey) {
      throw new Error('Key rotation failed to produce new keys');
    }

    // 9. Unsubscribe Cleanup
    console.log('\n--- 9. Testing Push Unsubscription ---');
    await unregisterPushSubscription(mockEndpoint, customer._id);
    const remainingCount = await PushSubscription.countDocuments({ user: customer._id });
    if (remainingCount !== 0) throw new Error('Unsubscribe failed to remove subscription');
    console.log('✅ Push unsubscription and device cleanup verified');

    console.log('\n======================================================');
    console.log('🎉 ALL PUSH NOTIFICATION SYSTEM TESTS PASSED 100%! 🎉');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n❌ Push notification test failed:', err);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPushSystemTest();
