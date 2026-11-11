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
import { protect } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = express.Router();

router.use(protect);

// Configuration & Providers
router.get('/config', requirePermission('email_notifications.view'), getEmailConfig);
router.put('/config', requirePermission('email_notifications.configure'), updateEmailConfig);
router.post('/test', requirePermission('email_notifications.configure'), sendTestEmail);
router.get('/providers', requirePermission('email_notifications.view'), getEmailProviders);
router.post('/providers', requirePermission('email_notifications.configure'), saveEmailProvider);
router.post('/providers/:id/test', requirePermission('email_notifications.configure'), testEmailProvider);
router.delete('/providers/:id', requirePermission('email_notifications.configure'), deleteEmailProvider);

// Templates & Draft/Publish Workflow
router.get('/templates', requirePermission('email_notifications.view'), getEmailTemplates);
router.get('/templates/:id', requirePermission('email_notifications.view'), getEmailTemplateById);
router.put('/templates/:id', requirePermission('email_notifications.update'), updateEmailTemplate);
router.post('/templates/:id/draft', requirePermission('email_notifications.update'), saveTemplateDraft);
router.post('/templates/:id/publish', requirePermission('email_notifications.manage'), publishTemplate);
router.post('/templates/:id/revert', requirePermission('email_notifications.manage'), revertTemplateVersion);
router.post('/templates/:id/send-test', requirePermission('email_notifications.update'), sendTestTemplateEmail);
router.post('/templates/:id/reset', requirePermission('email_notifications.configure'), resetTemplateToDefault);

// Analytics
router.get('/analytics', requirePermission('email_notifications.view'), getEmailAnalytics);

// Delivery notifications resend
router.post('/delivery-notifications/:notificationId/resend', requirePermission('email_notifications.manage'), resendDeliveryNotificationAdmin);

// Delivery logs & queue
router.get('/logs', requirePermission('email_notifications.view'), getEmailLogs);
router.post('/logs/:id/retry', requirePermission('email_notifications.manage'), retryEmailLog);

// Bulk Announcements
router.post('/announcements/send', requirePermission('email_notifications.manage'), sendBulkAnnouncement);

export default router;
