import * as webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';
import Notification from '../models/Notification.js';
import PushBroadcastLog from '../models/PushBroadcastLog.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import User from '../models/User.js';
import { getIO } from './socketHandler.js';

let isVapidConfigured = false;
let cachedPublicKey = '';

/**
 * Detect client browser, OS, and device type from User-Agent string
 */
export const parseUserAgent = (uaString = '') => {
  const ua = uaString.toLowerCase();
  let browser = 'Unknown Browser';
  let os = 'Unknown OS';
  let deviceType = 'desktop';

  // Device Type
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
    deviceType = 'mobile';
  }

  // OS
  if (ua.includes('win')) os = 'Windows';
  else if (ua.includes('mac') && !ua.includes('iphone') && !ua.includes('ipad')) os = 'macOS';
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('linux')) os = 'Linux';

  // Browser
  if (ua.includes('edg/')) browser = 'Microsoft Edge';
  else if (ua.includes('chrome/') && !ua.includes('edg/')) browser = 'Google Chrome';
  else if (ua.includes('safari/') && !ua.includes('chrome/')) browser = 'Apple Safari';
  else if (ua.includes('firefox/')) browser = 'Mozilla Firefox';
  else if (ua.includes('opr/') || ua.includes('opera/')) browser = 'Opera';

  return { browser, os, deviceType };
};

/**
 * Ensure VAPID keys are initialized and set in webpush
 */
export const initVapidKeys = async () => {
  try {
    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = await WebsiteSetting.create({});
    }

    if (!settings.pushNotificationConfig) {
      settings.pushNotificationConfig = {};
    }

    let { vapidPublicKey, vapidPrivateKey, vapidSubject } = settings.pushNotificationConfig;

    // Fallback to process.env if available
    if (!vapidPublicKey && process.env.VAPID_PUBLIC_KEY) {
      vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
      vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
    }

    // Auto-generate if still empty
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log('🔑 Generating new VAPID keys for Web Push Notifications...');
      const keys = webpush.generateVAPIDKeys();
      vapidPublicKey = keys.publicKey;
      vapidPrivateKey = keys.privateKey;
      settings.pushNotificationConfig.vapidPublicKey = vapidPublicKey;
      settings.pushNotificationConfig.vapidPrivateKey = vapidPrivateKey;
      if (!settings.pushNotificationConfig.vapidSubject) {
        settings.pushNotificationConfig.vapidSubject = 'mailto:notifications@bundlebyte.com';
      }
      settings.markModified('pushNotificationConfig');
      await settings.save();
    }

    const subject = vapidSubject || settings.pushNotificationConfig?.vapidSubject || 'mailto:notifications@bundlebyte.com';

    webpush.setVapidDetails(subject, vapidPublicKey, vapidPrivateKey);
    cachedPublicKey = vapidPublicKey;
    isVapidConfigured = true;

    return {
      publicKey: vapidPublicKey,
      subject,
      enabled: settings.pushNotificationConfig.enabled !== false,
    };
  } catch (err) {
    console.error('Failed to initialize VAPID keys for Web Push:', err.message);
    return null;
  }
};

/**
 * Get active VAPID public key
 */
export const getVapidPublicKey = async () => {
  if (cachedPublicKey) return cachedPublicKey;
  const config = await initVapidKeys();
  return config?.publicKey || '';
};

/**
 * Regenerate VAPID keys (Admin only)
 */
export const regenerateVapidKeys = async () => {
  const keys = webpush.generateVAPIDKeys();
  let settings = await WebsiteSetting.findOne();
  if (!settings) {
    settings = await WebsiteSetting.create({});
  }

  if (!settings.pushNotificationConfig) {
    settings.pushNotificationConfig = {};
  }

  settings.pushNotificationConfig.vapidPublicKey = keys.publicKey;
  settings.pushNotificationConfig.vapidPrivateKey = keys.privateKey;
  settings.markModified('pushNotificationConfig');
  await settings.save();

  cachedPublicKey = keys.publicKey;
  const subject = settings.pushNotificationConfig.vapidSubject || 'mailto:notifications@bundlebyte.com';
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
  isVapidConfigured = true;

  return { publicKey: keys.publicKey, subject };
};

/**
 * Register or update a browser push subscription for a user
 */
export const registerPushSubscription = async (userId, subscriptionData, userAgent = '', ip = '') => {
  const { endpoint, keys } = subscriptionData;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    throw new Error('Invalid push subscription structure');
  }

  const { browser, os, deviceType } = parseUserAgent(userAgent);

  const subscription = await PushSubscription.findOneAndUpdate(
    { endpoint },
    {
      user: userId,
      endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
      userAgent,
      browser,
      os,
      deviceType,
      ip,
      isActive: true,
      lastActiveAt: new Date(),
      failureCount: 0,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return subscription;
};

/**
 * Unregister a browser push subscription
 */
export const unregisterPushSubscription = async (endpoint, userId = null) => {
  const query = { endpoint };
  if (userId) query.user = userId;
  return await PushSubscription.findOneAndDelete(query);
};

/**
 * Send push notification to a single PushSubscription record
 */
export const sendToPushSubscription = async (subscription, payload) => {
  if (!isVapidConfigured) {
    await initVapidKeys();
  }

  const pushPayload = JSON.stringify({
    title: payload.title || 'BundleByte Notification',
    body: payload.body || payload.message || '',
    icon: payload.icon || '/favicon.ico',
    badge: payload.badge || '/favicon.ico',
    image: payload.imageUrl || payload.image || undefined,
    data: {
      url: payload.link || payload.actionUrl || '/',
      id: payload._id ? payload._id.toString() : undefined,
      type: payload.type || 'system',
      timestamp: Date.now(),
      ...payload.data,
    },
    actions: payload.actions || [
      { action: 'open', title: 'Open', icon: '/favicon.ico' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
    tag: payload.tag || `bundlebyte-${payload.type || 'alert'}-${Date.now()}`,
    renotify: true,
    requireInteraction: payload.priority === 'urgent' || payload.priority === 'high',
  });

  try {
    const res = await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      pushPayload,
      {
        TTL: 24 * 60 * 60, // 24 hours in seconds
        urgency: payload.priority === 'urgent' || payload.priority === 'high' ? 'high' : 'normal',
      }
    );

    // Update last active
    await PushSubscription.updateOne({ _id: subscription._id }, { $set: { lastActiveAt: new Date(), failureCount: 0 } });
    return { success: true, statusCode: res?.statusCode || 201 };
  } catch (err) {
    const statusCode = err.statusCode;
    // 404 Not Found or 410 Gone means the subscription has expired or unsubscribed
    if (statusCode === 404 || statusCode === 410) {
      console.log(`🧹 Push subscription expired/gone (${statusCode}). Deactivating: ${subscription.endpoint.substring(0, 40)}...`);
      await PushSubscription.deleteOne({ _id: subscription._id });
      return { success: false, expired: true, error: 'Subscription expired' };
    }

    // Increment failure count
    await PushSubscription.updateOne(
      { _id: subscription._id },
      {
        $inc: { failureCount: 1 },
        $set: { lastFailureReason: err.message || 'Push dispatch failed' },
      }
    );

    return { success: false, error: err.message };
  }
};

/**
 * Universal Dual-Dispatch: Send in-app notification + WebSocket + Web Push to a user
 */
export const sendNotificationToUser = async ({
  userId,
  title,
  message,
  subtitle = '',
  type = 'system',
  link = '/',
  icon = '',
  badge = '',
  imageUrl = '',
  actions = [],
  priority = 'normal',
  data = {},
  createInAppRecord = true,
}) => {
  try {
    const user = await User.findById(userId);
    if (!user) return { success: false, error: 'User not found' };

    // Check user preferences for push
    const prefs = user.pushNotifications || {};
    if (prefs.enabled === false) {
      // Push disabled by user, but still create in-app notification if needed
    }

    // Map category to preference flag
    const categoryPrefMap = {
      order: prefs.orderUpdates !== false,
      delivery: prefs.deliveryAlerts !== false,
      wallet: prefs.walletAlerts !== false,
      subscription: prefs.subscriptionAlerts !== false,
      ticket: prefs.ticketUpdates !== false,
      promo: prefs.promoAlerts !== false,
      security: prefs.securityAlerts !== false,
      system: true,
      account: true,
    };

    const isCategoryAllowed = categoryPrefMap[type] ?? true;

    let inAppNotification = null;
    if (createInAppRecord) {
      inAppNotification = await Notification.create({
        user: userId,
        title,
        message,
        subtitle,
        type,
        link,
        icon,
        badge,
        imageUrl,
        actions,
        priority,
        data,
        isRead: false,
        isPushSent: false,
      });
    }

    // 1. Dispatch WebSocket real-time event to active user rooms
    const io = getIO();
    if (io) {
      const socketPayload = inAppNotification ? inAppNotification.toObject() : {
        title,
        message,
        subtitle,
        type,
        link,
        icon,
        imageUrl,
        priority,
        createdAt: new Date(),
        data,
      };
      io.to(`user:${userId}`).emit('notification:new', socketPayload);
    }

    // 2. Dispatch W3C Web Push to all registered devices for this user
    if (prefs.enabled !== false && isCategoryAllowed) {
      const subscriptions = await PushSubscription.find({ user: userId, isActive: true });
      if (subscriptions.length > 0) {
        const payload = {
          _id: inAppNotification?._id,
          title,
          body: message,
          message,
          link,
          icon,
          badge,
          imageUrl,
          actions,
          type,
          priority,
          data,
        };

        const results = await Promise.allSettled(
          subscriptions.map((sub) => sendToPushSubscription(sub, payload))
        );

        const successfulCount = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;

        if (inAppNotification && successfulCount > 0) {
          inAppNotification.isPushSent = true;
          inAppNotification.pushDeliveryStatus = 'sent';
          await inAppNotification.save();
        }
      }
    }

    return { success: true, notification: inAppNotification };
  } catch (err) {
    console.error('sendNotificationToUser error:', err);
    return { success: false, error: err.message };
  }
};

/**
 * Broadcast a Push Notification to targeted user segments
 */
export const broadcastPushNotification = async ({
  title,
  body,
  link = '/',
  imageUrl = '',
  iconUrl = '',
  actions = [],
  category = 'promo',
  targetAudience = 'all_users',
  targetUserId = null,
  createdBy,
}) => {
  const startTime = Date.now();

  let userQuery = { isActive: true };
  if (targetAudience === 'customers_only') {
    userQuery.role = 'customer';
  } else if (targetAudience === 'admins_only') {
    userQuery.role = { $in: ['admin', 'super_admin'] };
  } else if (targetAudience === 'specific_user' && targetUserId) {
    userQuery._id = targetUserId;
  }

  const targetUsers = await User.find(userQuery).select('_id pushNotifications role name email');
  const userIds = targetUsers.map((u) => u._id);

  // Fetch all active push subscriptions for these users
  const subscriptions = await PushSubscription.find({
    user: { $in: userIds },
    isActive: true,
  });

  let successfulCount = 0;
  let failedCount = 0;
  let expiredCleanedCount = 0;

  const payload = {
    title,
    body,
    message: body,
    link,
    imageUrl,
    icon: iconUrl || '/favicon.ico',
    actions: actions.length > 0 ? actions : [
      { action: 'open', title: 'Open Link' },
      { action: 'close', title: 'Close' },
    ],
    type: category,
    priority: 'normal',
    data: { broadcast: true, category },
  };

  // Dispatch parallel batches of 25
  const batchSize = 25;
  for (let i = 0; i < subscriptions.length; i += batchSize) {
    const batch = subscriptions.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((sub) => sendToPushSubscription(sub, payload))
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value.success) successfulCount++;
        else {
          failedCount++;
          if (r.value.expired) expiredCleanedCount++;
        }
      } else {
        failedCount++;
      }
    }
  }

  // Also broadcast via Socket.io
  const io = getIO();
  if (io) {
    io.emit('notification:broadcast', {
      title,
      message: body,
      link,
      category,
      imageUrl,
      createdAt: new Date(),
    });
  }

  // Also create in-app notifications for targeted users
  const inAppDocs = targetUsers.map((u) => ({
    user: u._id,
    title,
    message: body,
    type: category,
    link,
    imageUrl,
    priority: 'normal',
    isRead: false,
    isPushSent: true,
    pushDeliveryStatus: 'sent',
    data: { broadcast: true },
  }));

  if (inAppDocs.length > 0) {
    try {
      await Notification.insertMany(inAppDocs, { ordered: false });
    } catch (insertErr) {
      // Ignore partial duplicates
    }
  }

  const executionTimeMs = Date.now() - startTime;

  // Log broadcast
  const log = await PushBroadcastLog.create({
    title,
    body,
    targetAudience,
    targetUserId: targetUserId || null,
    category,
    link,
    imageUrl,
    iconUrl,
    actions,
    totalSubscribersTargeted: subscriptions.length,
    successfulCount,
    failedCount,
    expiredCleanedCount,
    createdBy,
    status: failedCount === 0 ? 'completed' : successfulCount > 0 ? 'partial' : 'failed',
    executionTimeMs,
  });

  return {
    success: true,
    log,
    totalSubscribersTargeted: subscriptions.length,
    successfulCount,
    failedCount,
    expiredCleanedCount,
    executionTimeMs,
  };
};

/**
 * High-Level Business Triggers
 */

// 1. Order Placed / Confirmed
export const notifyOrderConfirmed = async ({ order, user }) => {
  const customerId = user?._id || order.user;
  const orderNum = order.orderNumber || order._id.toString().substring(0, 8);
  const total = order.totalAmount ? `₹${order.totalAmount}` : '';

  // Notify customer
  await sendNotificationToUser({
    userId: customerId,
    title: `✅ Order #${orderNum} Confirmed!`,
    message: `Your payment was verified successfully. Total: ${total}. Digital licenses & delivery in progress.`,
    subtitle: `Order #${orderNum}`,
    type: 'order',
    link: `/dashboard/orders`,
    icon: '/favicon.ico',
    priority: 'high',
    data: { orderId: order._id, orderNumber: orderNum },
  });

  // Notify admins
  const admins = await User.find({ role: { $in: ['admin', 'super_admin'] } }).select('_id');
  for (const admin of admins) {
    await sendNotificationToUser({
      userId: admin._id,
      title: `🛍️ New Order #${orderNum} Placed!`,
      message: `${user?.name || 'Customer'} placed an order of ${total}. Check fulfillment status.`,
      subtitle: `New Sale`,
      type: 'order',
      link: `/admin/orders`,
      priority: 'normal',
      data: { orderId: order._id, orderNumber: orderNum },
    });
  }
};

// 2. Digital Product Delivery Ready
export const notifyDigitalDeliveryReady = async ({ order, user, productTitle = 'Software License' }) => {
  const customerId = user?._id || order.user;
  const orderNum = order?.orderNumber || 'Digital Goods';

  await sendNotificationToUser({
    userId: customerId,
    title: `🚀 Product Ready: ${productTitle}!`,
    message: `Your digital license keys, account credentials, and access links are waiting in your encrypted vault.`,
    subtitle: `Vault Access Ready`,
    type: 'delivery',
    link: `/dashboard/purchased-products`,
    priority: 'high',
    actions: [
      { action: 'open_vault', title: 'Open Vault' },
      { action: 'my_orders', title: 'View Order' },
    ],
    data: { orderId: order?._id, orderNumber: orderNum },
  });
};

// 3. Wallet Transaction (Credit / Debit)
export const notifyWalletTransaction = async ({ user, type, amount, balance, description = '' }) => {
  const isCredit = type === 'credit';
  const title = isCredit ? `💰 Wallet Credited: +₹${amount}` : `💳 Wallet Debited: -₹${amount}`;
  const message = `${description || (isCredit ? 'Funds deposited to your wallet.' : 'Payment processed from wallet.')} Current balance: ₹${balance}`;

  await sendNotificationToUser({
    userId: user._id || user,
    title,
    message,
    type: 'wallet',
    link: `/dashboard/wallet`,
    priority: 'normal',
    data: { type, amount, balance },
  });
};

// 4. Support Ticket Reply
export const notifyTicketReply = async ({ ticket, recipientUser, authorName = 'Support Agent' }) => {
  await sendNotificationToUser({
    userId: recipientUser._id || recipientUser,
    title: `💬 Support Reply on Ticket #${ticket.ticketNumber || ticket._id.toString().substring(0, 6)}`,
    message: `${authorName} posted a response: "${(ticket.lastMessage || 'Click to view update').substring(0, 80)}..."`,
    type: 'ticket',
    link: `/dashboard/tickets`,
    priority: 'high',
    data: { ticketId: ticket._id },
  });
};

// 5. Account Security Alert
export const notifySecurityAlert = async ({ user, eventName = 'Security Notice', details = '' }) => {
  await sendNotificationToUser({
    userId: user._id || user,
    title: `🔒 Security Alert: ${eventName}`,
    message: details || 'A new sign-in or security modification was detected on your BundleByte account.',
    type: 'security',
    link: `/dashboard/profile`,
    priority: 'urgent',
    data: { event: eventName },
  });
};
