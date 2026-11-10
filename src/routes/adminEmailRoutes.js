import express from 'express';
import {
  getEmailConfig,
  updateEmailConfig,
  sendTestEmail,
  getEmailTemplates,
  getEmailTemplateById,
  updateEmailTemplate,
  saveTemplateDraft,
  publishTemplate,
  revertTemplateVersion,
  sendTestTemplateEmail,
  resetTemplateToDefault,
  getEmailProviders,
  saveEmailProvider,
  testEmailProvider,
  deleteEmailProvider,
  getEmailAnalytics,
  resendDeliveryNotificationAdmin,
  getEmailLogs,
  retryEmailLog,
  sendBulkAnnouncement,
} from '../controllers/adminEmailController.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(adminOnly);

// Configuration & Providers
router.get('/config', getEmailConfig);
router.put('/config', updateEmailConfig);
router.post('/test', sendTestEmail);
router.get('/providers', getEmailProviders);
router.post('/providers', saveEmailProvider);
router.post('/providers/:id/test', testEmailProvider);
router.delete('/providers/:id', deleteEmailProvider);

// Templates & Draft/Publish Workflow
router.get('/templates', getEmailTemplates);
router.get('/templates/:id', getEmailTemplateById);
router.put('/templates/:id', updateEmailTemplate);
router.post('/templates/:id/draft', saveTemplateDraft);
router.post('/templates/:id/publish', publishTemplate);
router.post('/templates/:id/revert', revertTemplateVersion);
router.post('/templates/:id/send-test', sendTestTemplateEmail);
router.post('/templates/:id/reset', resetTemplateToDefault);

// Analytics
router.get('/analytics', getEmailAnalytics);

// Delivery notifications resend
router.post('/delivery-notifications/:notificationId/resend', resendDeliveryNotificationAdmin);

// Delivery logs & queue
router.get('/logs', getEmailLogs);
router.post('/logs/:id/retry', retryEmailLog);

// Bulk Announcements
router.post('/announcements/send', sendBulkAnnouncement);

export default router;
