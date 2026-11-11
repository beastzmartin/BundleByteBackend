import express from 'express';
import { protect, optionalProtect } from '../middleware/auth.js';
import {
  getVapidPublicKeyHandler,
  subscribePushHandler,
  unsubscribePushHandler,
  getMySubscriptionsHandler,
  revokeSubscriptionHandler,
  getMyNotificationsHandler,
  getUnreadCountHandler,
  markAsReadHandler,
  markAllAsReadHandler,
  deleteNotificationHandler,
  clearReadNotificationsHandler,
  getPreferencesHandler,
  updatePreferencesHandler,
  sendTestPushHandler,
} from '../controllers/notificationController.js';

const router = express.Router();

// Public: Get VAPID public key
router.get('/vapid-public-key', getVapidPublicKeyHandler);

// Public / Semi-Public: Push Subscriptions (supports guests & authenticated users)
router.post('/subscribe', optionalProtect, subscribePushHandler);
router.post('/unsubscribe', optionalProtect, unsubscribePushHandler);

// Authenticated Routes
router.use(protect);

router.get('/subscriptions', getMySubscriptionsHandler);
router.delete('/subscriptions/:id', revokeSubscriptionHandler);

// In-App Notifications
router.get('/', getMyNotificationsHandler);
router.get('/unread-count', getUnreadCountHandler);
router.put('/read-all', markAllAsReadHandler);
router.put('/:id/read', markAsReadHandler);
router.delete('/clear-all', clearReadNotificationsHandler);
router.delete('/:id', deleteNotificationHandler);

// Preferences & Test
router.get('/preferences', getPreferencesHandler);
router.put('/preferences', updatePreferencesHandler);
router.post('/test', sendTestPushHandler);

export default router;

