import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';
import User from '../models/User.js';
import {
  getVapidPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
  sendNotificationToUser,
  sendToPushSubscription,
} from '../services/pushNotificationService.js';

/**
 * GET /api/notifications/vapid-public-key
 * Returns active VAPID public key for frontend push subscription
 */
export const getVapidPublicKeyHandler = async (req, res, next) => {
  try {
    const key = await getVapidPublicKey();
    return res.status(200).json({
      success: true,
      publicKey: key,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/subscribe
 * Register or update browser push subscription
 */
export const subscribePushHandler = async (req, res, next) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({
        success: false,
        message: 'Valid push subscription object is required',
      });
    }

    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';

    const registered = await registerPushSubscription(req.user._id, subscription, userAgent, ip);

    // Optional welcome notification on first device registration
    const existingCount = await PushSubscription.countDocuments({ user: req.user._id });
    if (existingCount <= 1) {
      sendNotificationToUser({
        userId: req.user._id,
        title: '🎉 Push Notifications Activated!',
        message: 'You will receive real-time alerts for orders, genuine license keys, and security updates directly on this device.',
        type: 'system',
        link: '/dashboard',
        priority: 'normal',
      }).catch((e) => console.log('Welcome push skipped:', e.message));
    }

    return res.status(201).json({
      success: true,
      message: 'Push subscription registered successfully',
      device: {
        _id: registered._id,
        browser: registered.browser,
        os: registered.os,
        deviceType: registered.deviceType,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/unsubscribe
 * Remove browser push subscription
 */
export const unsubscribePushHandler = async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({
        success: false,
        message: 'Push endpoint is required',
      });
    }

    await unregisterPushSubscription(endpoint, req.user._id);

    return res.status(200).json({
      success: true,
      message: 'Unsubscribed from push notifications successfully',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/subscriptions
 * Fetch user's active push registered devices
 */
export const getMySubscriptionsHandler = async (req, res, next) => {
  try {
    const devices = await PushSubscription.find({ user: req.user._id, isActive: true })
      .select('browser os deviceType ip lastActiveAt createdAt')
      .sort({ lastActiveAt: -1 });

    return res.status(200).json({
      success: true,
      devices,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications/subscriptions/:id
 * Revoke specific device push subscription
 */
export const revokeSubscriptionHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    await PushSubscription.findOneAndDelete({ _id: id, user: req.user._id });

    return res.status(200).json({
      success: true,
      message: 'Device push access revoked',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications
 * Paginated list of in-app notifications
 */
export const getMyNotificationsHandler = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 15));
    const skip = (page - 1) * limit;

    const query = { user: req.user._id };

    if (req.query.type && req.query.type !== 'all') {
      query.type = req.query.type;
    }

    if (req.query.unreadOnly === 'true') {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({ user: req.user._id, isRead: false }),
    ]);

    return res.status(200).json({
      success: true,
      notifications,
      total,
      unreadCount,
      page,
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/unread-count
 * Returns total unread notification count
 */
export const getUnreadCountHandler = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user._id,
      isRead: false,
    });

    return res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/:id/read
 * Mark single notification as read
 */
export const markAsReadHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    return res.status(200).json({
      success: true,
      notification,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/read-all
 * Mark all user's notifications as read
 */
export const markAllAsReadHandler = async (req, res, next) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications/:id
 * Delete a single notification
 */
export const deleteNotificationHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    await Notification.findOneAndDelete({ _id: id, user: req.user._id });

    return res.status(200).json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/notifications/clear-all
 * Delete all read notifications for user
 */
export const clearReadNotificationsHandler = async (req, res, next) => {
  try {
    await Notification.deleteMany({ user: req.user._id, isRead: true });

    return res.status(200).json({
      success: true,
      message: 'Read notifications cleared',
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/notifications/preferences
 * Fetch user's notification preferences
 */
export const getPreferencesHandler = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select('pushNotifications telegramNotifications');

    const defaults = {
      enabled: true,
      orderUpdates: true,
      deliveryAlerts: true,
      walletAlerts: true,
      subscriptionAlerts: true,
      ticketUpdates: true,
      promoAlerts: true,
      securityAlerts: true,
      soundEnabled: true,
    };

    return res.status(200).json({
      success: true,
      preferences: {
        ...defaults,
        ...(user?.pushNotifications || {}),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/notifications/preferences
 * Update user's notification preferences
 */
export const updatePreferencesHandler = async (req, res, next) => {
  try {
    const { preferences } = req.body;
    if (!preferences) {
      return res.status(400).json({
        success: false,
        message: 'Preferences object is required',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.pushNotifications = {
      ...user.pushNotifications,
      ...preferences,
    };

    user.markModified('pushNotifications');
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Notification preferences updated successfully',
      preferences: user.pushNotifications,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/notifications/test
 * Send immediate test push notification to caller
 */
export const sendTestPushHandler = async (req, res, next) => {
  try {
    const result = await sendNotificationToUser({
      userId: req.user._id,
      title: '🔔 Test Push Notification',
      message: 'Your push notification channel is active, verified, and operational!',
      type: 'system',
      link: '/dashboard',
      priority: 'high',
      actions: [
        { action: 'open_dashboard', title: 'Open Dashboard' },
        { action: 'close', title: 'Dismiss' },
      ],
    });

    return res.status(200).json({
      success: true,
      message: 'Test notification dispatched',
      result,
    });
  } catch (err) {
    next(err);
  }
};

