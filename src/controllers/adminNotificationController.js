import PushSubscription from '../models/PushSubscription.js';
import PushBroadcastLog from '../models/PushBroadcastLog.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import User from '../models/User.js';
import {
  broadcastPushNotification,
  getVapidPublicKey,
  regenerateVapidKeys,
  registerPushSubscription,
  sendNotificationToUser,
  sendToPushSubscription,
} from '../services/pushNotificationService.js';

/**
 * GET /api/admin/notifications/stats
 * Telemetry on active subscribers, device breakdown, browser share, and delivery logs
 */
export const getPushStats = async (req, res, next) => {
  try {
    const [
      totalSubscriptions,
      activeSubscriptions,
      deviceCounts,
      browserCounts,
      recentBroadcasts,
      totalUsers,
    ] = await Promise.all([
      PushSubscription.countDocuments(),
      PushSubscription.countDocuments({ isActive: true }),
      PushSubscription.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$deviceType', count: { $sum: 1 } } },
      ]),
      PushSubscription.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$browser', count: { $sum: 1 } } },
      ]),
      PushBroadcastLog.find().sort({ createdAt: -1 }).limit(5).populate('createdBy', 'name email'),
      User.countDocuments({ isActive: true }),
    ]);

    const deviceMap = { desktop: 0, mobile: 0, tablet: 0 };
    deviceCounts.forEach((d) => {
      if (d._id) deviceMap[d._id] = d.count;
    });

    const browserMap = {};
    browserCounts.forEach((b) => {
      if (b._id) browserMap[b._id] = b.count;
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalSubscriptions,
        activeSubscriptions,
        totalUsers,
        reachPercentage: totalUsers > 0 ? Math.round((activeSubscriptions / totalUsers) * 100) : 0,
        deviceBreakdown: deviceMap,
        browserBreakdown: browserMap,
        recentBroadcasts,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/notifications/subscribers
 * Paginated list of registered browser push subscribers
 */
export const getSubscribersList = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const query = {};
    if (req.query.deviceType && req.query.deviceType !== 'all') {
      query.deviceType = req.query.deviceType;
    }
    if (req.query.browser && req.query.browser !== 'all') {
      query.browser = new RegExp(req.query.browser, 'i');
    }

    const [subscribers, total] = await Promise.all([
      PushSubscription.find(query)
        .populate('user', 'name email role avatar')
        .sort({ lastActiveAt: -1 })
        .skip(skip)
        .limit(limit),
      PushSubscription.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      subscribers,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/notifications/broadcast
 * Broadcast a live push notification to users
 */
export const broadcastPushHandler = async (req, res, next) => {
  try {
    const {
      title,
      body,
      link = '/',
      imageUrl = '',
      iconUrl = '',
      actions = [],
      category = 'promo',
      targetAudience = 'all_users',
      targetUserId = null,
    } = req.body;

    if (!title || !body) {
      return res.status(400).json({
        success: false,
        message: 'Notification title and body are required',
      });
    }

    const result = await broadcastPushNotification({
      title,
      body,
      link,
      imageUrl,
      iconUrl,
      actions,
      category,
      targetAudience,
      targetUserId,
      createdBy: req.user._id,
    });

    return res.status(200).json({
      success: true,
      message: `Broadcast dispatched successfully to ${result.successfulCount} active device(s)`,
      result,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/notifications/broadcasts
 * Past broadcast history and delivery logs
 */
export const getBroadcastLogs = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const [broadcasts, total] = await Promise.all([
      PushBroadcastLog.find()
        .populate('createdBy', 'name email')
        .populate('targetUserId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      PushBroadcastLog.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      broadcasts,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/admin/notifications/settings
 * Fetch VAPID and push configuration
 */
export const getPushSettings = async (req, res, next) => {
  try {
    const settings = await WebsiteSetting.findOne();
    const config = settings?.pushNotificationConfig || {};
    const publicKey = await getVapidPublicKey();

    return res.status(200).json({
      success: true,
      config: {
        enabled: config.enabled !== false,
        vapidPublicKey: publicKey,
        vapidSubject: config.vapidSubject || 'mailto:notifications@bundlebyte.com',
        defaultIcon: config.defaultIcon || '/favicon.ico',
        defaultBadge: config.defaultBadge || '/favicon.ico',
        soundEnabled: config.soundEnabled !== false,
        welcomeNotificationEnabled: config.welcomeNotificationEnabled !== false,
        welcomeTitle: config.welcomeTitle || '🎉 Welcome to BundleByte!',
        welcomeBody: config.welcomeBody || 'Browser alerts are enabled.',
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/admin/notifications/settings
 * Update push and VAPID settings
 */
export const updatePushSettings = async (req, res, next) => {
  try {
    const { config } = req.body;
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Settings config object is required',
      });
    }

    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = await WebsiteSetting.create({});
    }

    if (!settings.pushNotificationConfig) {
      settings.pushNotificationConfig = {};
    }

    settings.pushNotificationConfig = {
      ...settings.pushNotificationConfig,
      ...config,
    };

    settings.markModified('pushNotificationConfig');
    await settings.save();

    return res.status(200).json({
      success: true,
      message: 'Push notification settings saved successfully',
      config: settings.pushNotificationConfig,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/notifications/regenerate-keys
 * Regenerate fresh VAPID Key pair
 */
export const regenerateKeysHandler = async (req, res, next) => {
  try {
    const keys = await regenerateVapidKeys();

    return res.status(200).json({
      success: true,
      message: 'New VAPID keypair generated successfully. Subscriptions will re-sync with new applicationServerKey.',
      keys,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/admin/notifications/send-test
 * Dispatch live test push to admin's current browser or specific subscription
 */
export const sendAdminTestPush = async (req, res, next) => {
  try {
    const { title, body, link, subscriptionId, endpoint, subscription } = req.body;

    let sub = null;

    // 1. If client provided fresh subscription payload, upsert it immediately for this admin
    if (subscription && subscription.endpoint && subscription.keys) {
      const userAgent = req.headers['user-agent'] || '';
      const ip = req.ip || req.connection.remoteAddress || '';
      sub = await registerPushSubscription(req.user._id, subscription, userAgent, ip);
    }

    // 2. Lookup by subscriptionId if provided
    if (!sub && subscriptionId) {
      sub = await PushSubscription.findById(subscriptionId);
    }

    // 3. Lookup by endpoint if provided
    if (!sub && endpoint) {
      sub = await PushSubscription.findOne({ endpoint, isActive: true });
      if (sub && !sub.user) {
        sub.user = req.user._id;
        await sub.save();
      }
    }

    // 4. Find admin's most recent active subscription
    if (!sub) {
      sub = await PushSubscription.findOne({ user: req.user._id, isActive: true }).sort({ lastActiveAt: -1 });
    }

    // 5. Fallback: If no subscription bound to this admin yet, check if there is any active subscription in DB
    if (!sub) {
      const latestSub = await PushSubscription.findOne({ isActive: true }).sort({ lastActiveAt: -1 });
      if (latestSub) {
        sub = latestSub;
      }
    }

    if (!sub) {
      return res.status(400).json({
        success: false,
        message: 'No active push subscription found for your browser. Click "Enable Push on This Device" to allow notifications first.',
      });
    }

    const payload = {
      title: title || '⚡ Admin Push Dispatcher Verified',
      body: body || 'Real-time Web Push notification delivered instantly to your device notification bar via VAPID engine.',
      link: link || '/admin/notifications',
      type: 'system',
      priority: 'high',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      requireInteraction: true,
      actions: [
        { action: 'open_studio', title: 'Open Studio' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    };

    const pushResult = await sendToPushSubscription(sub, payload);

    return res.status(200).json({
      success: true,
      message: pushResult.success
        ? 'Test push dispatched successfully! Check your device notification bar / Action Center.'
        : `Failed to deliver push: ${pushResult.error || 'Unknown error'}`,
      pushResult,
      device: {
        browser: sub.browser,
        os: sub.os,
        deviceType: sub.deviceType,
      },
    });
  } catch (err) {
    next(err);
  }
};

