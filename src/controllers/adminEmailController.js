import WebsiteSetting from '../models/WebsiteSetting.js';
import EmailTemplate from '../models/EmailTemplate.js';
import EmailLog from '../models/EmailLog.js';
import EmailPreference from '../models/EmailPreference.js';
import EmailProvider from '../models/EmailProvider.js';
import User from '../models/User.js';
import { executeEmailSend, queueEmail, getActiveEmailConfig } from '../services/emailService.js';
import { logAudit } from '../middleware/audit.js';
import { getAllProvidersSanitized, testProviderConnectivity } from '../services/providerManagerService.js';
import { getEmailAnalyticsData } from '../services/emailAnalyticsService.js';
import { resendDeliveryNotification } from '../services/fulfillmentNotificationService.js';
import { encryptCredential } from '../utils/credentialEncryption.js';

/**
 * GET /api/admin/email/config
 * Retrieve current email configuration (with secrets masked)
 */
export const getEmailConfig = async (req, res, next) => {
  try {
    const settings = await WebsiteSetting.findOne();
    const config = settings?.emailConfig || {};

    res.status(200).json({
      success: true,
      config: {
        provider: config.provider || 'smtp',
        fromName: config.fromName || 'BundleByte',
        fromEmail: config.fromEmail || 'support@bundlebyte.com',
        smtp: {
          host: config.smtp?.host || '',
          port: config.smtp?.port || 587,
          user: config.smtp?.user || '',
          hasPassword: !!config.smtp?.pass,
          secure: config.smtp?.secure || false,
        },
        resend: {
          hasApiKey: !!config.resend?.apiKey,
          apiKeyMasked: config.resend?.apiKey ? `${config.resend.apiKey.slice(0, 4)}••••${config.resend.apiKey.slice(-4)}` : '',
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/email/config
 * Update email provider credentials and sender info
 */
export const updateEmailConfig = async (req, res, next) => {
  try {
    const { provider, fromName, fromEmail, smtp, resend } = req.body;

    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = new WebsiteSetting();
    }

    if (!settings.emailConfig) {
      settings.emailConfig = {};
    }

    if (provider) settings.emailConfig.provider = provider;
    if (fromName) settings.emailConfig.fromName = fromName.trim();
    if (fromEmail) settings.emailConfig.fromEmail = fromEmail.trim().toLowerCase();

    if (smtp) {
      if (!settings.emailConfig.smtp) settings.emailConfig.smtp = {};
      if (smtp.host !== undefined) settings.emailConfig.smtp.host = smtp.host.trim();
      if (smtp.port !== undefined) settings.emailConfig.smtp.port = Number(smtp.port);
      if (smtp.user !== undefined) settings.emailConfig.smtp.user = smtp.user.trim();
      if (smtp.pass && !smtp.pass.includes('••••')) {
        settings.emailConfig.smtp.pass = smtp.pass.trim();
      }
      if (smtp.secure !== undefined) settings.emailConfig.smtp.secure = Boolean(smtp.secure);
    }

    if (resend) {
      if (!settings.emailConfig.resend) settings.emailConfig.resend = {};
      if (resend.apiKey && !resend.apiKey.includes('••••')) {
        settings.emailConfig.resend.apiKey = resend.apiKey.trim();
      }
    }

    settings.markModified('emailConfig');
    await settings.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'EMAIL_CONFIG_UPDATED',
      entity: 'WebsiteSetting',
      details: { provider: settings.emailConfig.provider, fromEmail: settings.emailConfig.fromEmail },
      req,
    });

    res.status(200).json({
      success: true,
      message: 'Email delivery provider configuration saved successfully!',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/email/test
 * Send a live test email to verify credentials
 */
export const sendTestEmail = async (req, res, next) => {
  try {
    const { recipient } = req.body;
    const targetEmail = recipient || req.user.email;

    if (!targetEmail) {
      return res.status(400).json({ success: false, message: 'Recipient email is required' });
    }

    const testSubject = `[BundleByte] Test Email Delivery Check`;
    const testHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
        <h2 style="color: #4f46e5;">Email System Test Succeeded!</h2>
        <p>This is a verification email sent from your BundleByte Admin Suite.</p>
        <p>Timestamp: <strong>${new Date().toISOString()}</strong></p>
        <p>Your configured provider is operating normally and ready to dispatch customer notifications.</p>
      </div>
    `;

    const result = await executeEmailSend({
      to: targetEmail,
      subject: testSubject,
      html: testHtml,
      text: 'Email system test succeeded from BundleByte Admin Suite.',
    });

    res.status(200).json({
      success: true,
      message: `Test email dispatched successfully via ${result.provider.toUpperCase()} (ID: ${result.messageId})!`,
      result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: `Test email delivery failed: ${error.message}`,
    });
  }
};

/**
 * GET /api/admin/email/templates
 * Retrieve all email templates
 */
export const getEmailTemplates = async (req, res, next) => {
  try {
    const templates = await EmailTemplate.find().sort({ category: 1, name: 1 });
    res.status(200).json({
      success: true,
      templates,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/email/templates/:id
 */
export const getEmailTemplateById = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Email template not found' });
    }
    res.status(200).json({ success: true, template });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/admin/email/templates/:id
 * Update template content and subject
 */
export const updateEmailTemplate = async (req, res, next) => {
  try {
    const { subject, htmlBody, textBody, isActive, name } = req.body;
    const template = await EmailTemplate.findById(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'Email template not found' });
    }

    if (subject !== undefined) template.subject = subject.trim();
    if (htmlBody !== undefined) template.htmlBody = htmlBody;
    if (textBody !== undefined) template.textBody = textBody;
    if (isActive !== undefined) template.isActive = isActive;
    if (name !== undefined) template.name = name.trim();

    await template.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'EMAIL_TEMPLATE_UPDATED',
      entity: 'EmailTemplate',
      entityId: template._id.toString(),
      details: { templateKey: template.key },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Template "${template.name}" updated successfully!`,
      template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/email/logs
 * Retrieve paginated email delivery logs
 */
export const getEmailLogs = async (req, res, next) => {
  try {
    const { status, search, page = 1, limit = 25 } = req.query;
    const query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (search && search.trim()) {
      query.$or = [
        { recipient: { $regex: search.trim(), $options: 'i' } },
        { subject: { $regex: search.trim(), $options: 'i' } },
        { templateKey: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 25;
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      EmailLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      EmailLog.countDocuments(query),
    ]);

    const stats = {
      totalQueued: await EmailLog.countDocuments({ status: 'queued' }),
      totalSent: await EmailLog.countDocuments({ status: 'sent' }),
      totalFailed: await EmailLog.countDocuments({ status: 'failed' }),
    };

    res.status(200).json({
      success: true,
      logs,
      stats,
      meta: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/email/logs/:id/retry
 * Manually retry delivering a failed email
 */
export const retryEmailLog = async (req, res, next) => {
  try {
    const log = await EmailLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, message: 'Email log not found' });
    }

    log.status = 'sending';
    log.attempts += 1;
    await log.save();

    try {
      const result = await executeEmailSend({
        to: log.recipient,
        subject: log.subject,
        html: log.htmlContent,
        text: log.textContent,
      });

      log.status = 'sent';
      log.provider = result.provider;
      log.messageId = result.messageId;
      log.sentAt = new Date();
      await log.save();

      res.status(200).json({
        success: true,
        message: `Email re-sent successfully via ${result.provider}!`,
        log,
      });
    } catch (err) {
      log.status = 'failed';
      log.lastError = err.message;
      log.failedAt = new Date();
      await log.save();

      res.status(400).json({
        success: false,
        message: `Retry failed: ${err.message}`,
        log,
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/email/announcements/send
 * Dispatch broadcast announcements to all opted-in customers
 */
export const sendBulkAnnouncement = async (req, res, next) => {
  try {
    const { subject, htmlContent, textContent, targetAudience = 'opted_in' } = req.body;

    if (!subject || !htmlContent) {
      return res.status(400).json({
        success: false,
        message: 'Subject and HTML body are required for announcements',
      });
    }

    const query = { isActive: true };
    if (targetAudience === 'opted_in') {
      query.optInAnnouncements = { $ne: false };
    }

    const recipients = await User.find(query).select('name email');

    let queuedCount = 0;
    for (const user of recipients) {
      await queueEmail({
        recipient: user.email,
        recipientName: user.name,
        templateKey: 'announcement',
        subject,
        htmlOverride: htmlContent,
        textOverride: textContent,
        variables: {
          customerName: user.name,
        },
        metadata: { announcement: true, sentBy: req.user._id.toString() },
      });
      queuedCount++;
    }

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'BULK_ANNOUNCEMENT_QUEUED',
      entity: 'Email',
      details: { subject, recipientCount: queuedCount },
      req,
    });

    res.status(200).json({
      success: true,
      message: `Announcement queued successfully for ${queuedCount} recipient(s)!`,
      queuedCount,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/email/templates/:id/draft
 * Save an uncommitted draft of an email template
 */
export const saveTemplateDraft = async (req, res, next) => {
  try {
    const { draftSubject, draftHtmlBody, draftTextBody } = req.body;
    const template = await EmailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    template.draftSubject = draftSubject || template.subject;
    template.draftHtmlBody = draftHtmlBody || template.htmlBody;
    template.draftTextBody = draftTextBody !== undefined ? draftTextBody : template.textBody;
    template.hasDraft = true;
    await template.save();

    res.status(200).json({ success: true, message: 'Template draft saved', template });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/email/templates/:id/publish
 * Publish draft and create an immutable version snapshot
 */
export const publishTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    if (!template.versionHistory) template.versionHistory = [];
    template.versionHistory.push({
      version: template.version || 1,
      subject: template.subject,
      htmlBody: template.htmlBody,
      textBody: template.textBody,
      savedAt: new Date(),
      savedBy: req.user.name || req.user.email,
    });

    if (template.hasDraft && template.draftSubject) {
      template.subject = template.draftSubject;
      template.htmlBody = template.draftHtmlBody;
      if (template.draftTextBody) template.textBody = template.draftTextBody;
    }

    template.version = (template.version || 1) + 1;
    template.hasDraft = false;
    template.publishedAt = new Date();
    await template.save();

    res.status(200).json({
      success: true,
      message: `Template published as version v${template.version}`,
      template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/email/templates/:id/revert
 * Revert to a previous template version
 */
export const revertTemplateVersion = async (req, res, next) => {
  try {
    const { targetVersion } = req.body;
    const template = await EmailTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ success: false, message: 'Template not found' });

    const historical = (template.versionHistory || []).find((v) => v.version === Number(targetVersion));
    if (!historical) {
      return res.status(404).json({ success: false, message: `Version v${targetVersion} not found in history` });
    }

    template.subject = historical.subject;
    template.htmlBody = historical.htmlBody;
    template.textBody = historical.textBody || '';
    template.hasDraft = false;
    await template.save();

    res.status(200).json({ success: true, message: `Reverted to version v${targetVersion}`, template });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/email/providers
 */
export const getEmailProviders = async (req, res, next) => {
  try {
    const providers = await getAllProvidersSanitized();
    res.status(200).json({ success: true, providers });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/email/providers
 * Create or update an email provider
 */
export const saveEmailProvider = async (req, res, next) => {
  try {
    const {
      _id,
      name,
      providerType,
      priority,
      isActive,
      isPrimary,
      isFallback,
      senderName,
      senderEmail,
      replyToEmail,
      smtpConfig,
      resendConfig,
    } = req.body;

    let provider;
    if (_id) {
      provider = await EmailProvider.findById(_id);
    }
    if (!provider) {
      provider = new EmailProvider({ name: name || 'New Provider' });
    }

    if (name) provider.name = name.trim();
    if (providerType) provider.providerType = providerType;
    if (priority !== undefined) provider.priority = Number(priority);
    if (isActive !== undefined) provider.isActive = Boolean(isActive);
    if (isPrimary !== undefined) provider.isPrimary = Boolean(isPrimary);
    if (isFallback !== undefined) provider.isFallback = Boolean(isFallback);
    if (senderName) provider.senderName = senderName.trim();
    if (senderEmail) provider.senderEmail = senderEmail.trim().toLowerCase();
    if (replyToEmail) provider.replyToEmail = replyToEmail.trim().toLowerCase();

    if (smtpConfig) {
      if (!provider.smtpConfig) provider.smtpConfig = {};
      if (smtpConfig.host !== undefined) provider.smtpConfig.host = smtpConfig.host;
      if (smtpConfig.port !== undefined) provider.smtpConfig.port = Number(smtpConfig.port);
      if (smtpConfig.username !== undefined) provider.smtpConfig.username = smtpConfig.username;
      if (smtpConfig.encryptionMode) provider.smtpConfig.encryptionMode = smtpConfig.encryptionMode;
      if (smtpConfig.password && !smtpConfig.password.includes('••••')) {
        provider.smtpConfig.encryptedPassword = encryptCredential(smtpConfig.password);
      }
    }

    if (resendConfig) {
      if (!provider.resendConfig) provider.resendConfig = {};
      if (resendConfig.apiKey && !resendConfig.apiKey.includes('••••')) {
        provider.resendConfig.encryptedApiKey = encryptCredential(resendConfig.apiKey);
      }
    }

    await provider.save();
    const all = await getAllProvidersSanitized();
    const sanitized = all.find((p) => p._id.toString() === provider._id.toString());

    res.status(200).json({ success: true, message: 'Provider configuration saved', provider: sanitized });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/email/providers/:id/test
 */
export const testEmailProvider = async (req, res, next) => {
  try {
    const result = await testProviderConnectivity(req.params.id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/admin/email/providers/:id
 */
export const deleteEmailProvider = async (req, res, next) => {
  try {
    await EmailProvider.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, message: 'Provider deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/admin/email/analytics
 */
export const getEmailAnalytics = async (req, res, next) => {
  try {
    const { days, category, status } = req.query;
    const data = await getEmailAnalyticsData({ days, category, status });
    res.status(200).json({ success: true, ...data });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/admin/email/delivery-notifications/:notificationId/resend
 */
export const resendDeliveryNotificationAdmin = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const result = await resendDeliveryNotification(notificationId, req.user);
    res.status(200).json({
      success: true,
      message: 'Delivery notification re-sent successfully without altering inventory',
      notification: result.notification,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: GET /api/email/preferences
 */
export const getMyEmailPreferences = async (req, res, next) => {
  try {
    let pref = await EmailPreference.findOne({ user: req.user._id });
    if (!pref) {
      pref = await EmailPreference.create({ user: req.user._id });
    }
    res.status(200).json({ success: true, preferences: pref });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: PUT /api/email/preferences
 */
export const updateMyEmailPreferences = async (req, res, next) => {
  try {
    let pref = await EmailPreference.findOne({ user: req.user._id });
    if (!pref) {
      pref = new EmailPreference({ user: req.user._id });
    }
    const allowed = [
      'orderUpdates',
      'deliveryNotifications',
      'invoiceReceipts',
      'subscriptionReminders',
      'marketingPromotions',
      'newsletter',
    ];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) pref[field] = Boolean(req.body[field]);
    });
    await pref.save();
    res.status(200).json({ success: true, message: 'Preferences updated', preferences: pref });
  } catch (error) {
    next(error);
  }
};

/**
 * Customer: GET /api/email/my-history
 */
export const getMyEmailHistory = async (req, res, next) => {
  try {
    const logs = await EmailLog.find({ recipient: req.user.email.toLowerCase() })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('subject category status sentAt createdAt messageId order invoice');
    res.status(200).json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};
