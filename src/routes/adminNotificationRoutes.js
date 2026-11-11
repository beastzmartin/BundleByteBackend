import express from 'express';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  getPushStats,
  getSubscribersList,
  broadcastPushHandler,
  getBroadcastLogs,
  getPushSettings,
  updatePushSettings,
  regenerateKeysHandler,
  sendAdminTestPush,
} from '../controllers/adminNotificationController.js';

const router = express.Router();

router.use(protect);
router.use(adminOnly);

router.get('/stats', getPushStats);
router.get('/subscribers', getSubscribersList);
router.post('/broadcast', broadcastPushHandler);
router.get('/broadcasts', getBroadcastLogs);
router.get('/settings', getPushSettings);
router.put('/settings', updatePushSettings);
router.post('/regenerate-keys', regenerateKeysHandler);
router.post('/send-test', sendAdminTestPush);

export default router;

