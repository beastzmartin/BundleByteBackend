import nodemailer from 'nodemailer';
import { ENV } from '../config/environment.js';
import WebsiteSetting from '../models/WebsiteSetting.js';
import EmailTemplate from '../models/EmailTemplate.js';
import EmailLog from '../models/EmailLog.js';
import User from '../models/User.js';

// Background Queue for asynchronous email processing with automatic retries
const emailQueue = [];
let isQueueProcessing = false;

/**
 * Standard branded responsive HTML email layout wrapper
 */
const renderEmailShell = ({ title, bodyHtml, actionText, actionUrl, siteName = 'BundleByte', supportEmail = 'support@bundlebyte.com' }) => {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #0f172a; color: #f8fafc; }
    .wrapper { width: 100%; max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; overflow: hidden; border: 1px solid #334155; }
    .header { padding: 32px 24px 20px; text-align: center; border-bottom: 1px solid #334155; }
    .brand { font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-decoration: none; }
    .brand span { color: #6366f1; }
    .content { padding: 32px 24px; font-size: 15px; line-height: 1.6; color: #cbd5e1; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; padding: 14px 32px; border-radius: 12px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 4px 14px rgba(79, 70, 229, 0.4); }
    .alert-box { background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #a5b4fc; }
    .footer { padding: 24px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #334155; background-color: #0f172a; }
  </style>
</head>
<body>
  <div style="padding: 24px 12px;">
    <div class="wrapper">
      <div class="header">
        <div class="brand">Bundle<span>Byte</span></div>
        <p style="margin: 6px 0 0; font-size: 12px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Premium Digital Marketplace</p>
      </div>
      <div class="content">
        ${bodyHtml}
        ${
          actionText && actionUrl
            ? `<div class="btn-container">
                 <a href="${actionUrl}" class="btn" target="_blank">${actionText} &rarr;</a>
               </div>`
            : ''
        }
      </div>
      <div class="footer">
        <p style="margin: 0 0 8px;">&copy; ${new Date().getFullYear()} ${siteName}. All rights reserved.</p>
        <p style="margin: 0;">For assistance, reach our concierge desk at <a href="mailto:${supportEmail}" style="color: #818cf8; text-decoration: none;">${supportEmail}</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Retrieve active email configuration from WebsiteSettings or fallback to ENV
 */
export const getActiveEmailConfig = async () => {
  try {
    const settings = await WebsiteSetting.findOne();
    const config = settings?.emailConfig || {};
    return {
      provider: config.provider || (ENV.SMTP_HOST ? 'smtp' : 'simulation'),
      fromName: config.fromName || ENV.FROM_NAME || 'BundleByte',
      fromEmail: config.fromEmail || ENV.FROM_EMAIL || 'support@bundlebyte.com',
      smtp: {
        host: config.smtp?.host || ENV.SMTP_HOST || '',
        port: config.smtp?.port || ENV.SMTP_PORT || 587,
        user: config.smtp?.user || ENV.SMTP_USER || '',
        pass: config.smtp?.pass || ENV.SMTP_PASS || '',
        secure: config.smtp?.secure ?? (ENV.SMTP_PORT === 465),
      },
      resend: {
        apiKey: config.resend?.apiKey || process.env.RESEND_API_KEY || '',
      },
    };
  } catch (err) {
    return {
      provider: 'simulation',
      fromName: 'BundleByte',
      fromEmail: 'support@bundlebyte.com',
      smtp: {},
      resend: {},
    };
  }
};

/**
 * Dispatch an email via configured provider (SMTP, Resend API, or Simulation)
 */
export const executeEmailSend = async ({ to, subject, html, text, fromName, fromEmail }) => {
  const config = await getActiveEmailConfig();
  const effectiveFromName = fromName || config.fromName;
  const effectiveFromEmail = fromEmail || config.fromEmail;
  const fromFormatted = `"${effectiveFromName}" <${effectiveFromEmail}>`;

  // 1. Resend API
  if (config.provider === 'resend' && config.resend?.apiKey) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resend.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromFormatted,
        to: [to],
        subject,
        html,
        text,
      }),
    });

    const resData = await response.json();
    if (!response.ok) {
      throw new Error(`Resend API Error: ${resData.message || response.statusText}`);
    }
    return { provider: 'resend', messageId: resData.id };
  }

  // 2. SMTP
  if (config.provider === 'smtp' && config.smtp?.host && config.smtp?.user) {
    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });

    const info = await transporter.sendMail({
      from: fromFormatted,
      to,
      subject,
      html,
      text,
    });
    return { provider: 'smtp', messageId: info.messageId };
  }

  // 3. Fallback Simulation in Development / Unconfigured State
  console.log('\n================== 📧 OUTGOING EMAIL SIMULATION ==================');
  console.log(`To: ${to}`);
  console.log(`From: ${fromFormatted}`);
  console.log(`Subject: ${subject}`);
  console.log(`Preview: ${text?.substring(0, 150) || '(HTML body rendered)'}`);
  console.log('===================================================================\n');

  return { provider: 'simulation', messageId: `sim-${Date.now()}` };
};

/**
 * Worker loop to process queued emails with retry handling
 */
const processQueueWorker = async () => {
  if (isQueueProcessing || emailQueue.length === 0) return;
  isQueueProcessing = true;

  while (emailQueue.length > 0) {
    const task = emailQueue.shift();
    const { logId, retryCount } = task;

    try {
      const log = await EmailLog.findById(logId);
      if (!log || log.status === 'sent') continue;

      log.status = 'sending';
      log.attempts += 1;
      await log.save();

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
    } catch (err) {
      console.error(`❌ Email send failed for log ${logId}:`, err.message);
      try {
        const log = await EmailLog.findById(logId);
        if (log) {
          log.lastError = err.message;
          log.failedAt = new Date();

          if (log.attempts < log.maxAttempts) {
            log.status = 'retrying';
            await log.save();

            // Schedule retry with exponential backoff (e.g. 5s * retryCount)
            setTimeout(() => {
              emailQueue.push({ logId, retryCount: retryCount + 1 });
              processQueueWorker();
            }, Math.min(30000, 5000 * Math.pow(2, retryCount)));
          } else {
            log.status = 'failed';
            await log.save();
          }
        }
      } catch (saveErr) {
        console.error('Failed to update email log state:', saveErr);
      }
    }
  }

  isQueueProcessing = false;
};

/**
 * Primary method to queue an email for delivery
 */
export const queueEmail = async ({
  recipient,
  recipientName = '',
  templateKey = 'custom',
  subject: customSubject,
  variables = {},
  metadata = {},
  htmlOverride,
  textOverride,
}) => {
  try {
    let subject = customSubject || 'Important update from BundleByte';
    let htmlContent = htmlOverride || '';
    let textContent = textOverride || '';

    // If templateKey is provided, resolve template
    if (templateKey && templateKey !== 'custom') {
      const template = await EmailTemplate.findOne({ key: templateKey, isActive: true });
      if (template) {
        subject = template.subject;
        htmlContent = template.htmlBody;
        textContent = template.textBody;
      }
    }

    // Interpolate dynamic variables {{variableName}}
    const allVariables = {
      customerName: recipientName || 'Valued Customer',
      siteName: 'BundleByte',
      dashboardUrl: `${ENV.CLIENT_URL}/dashboard`,
      vaultUrl: `${ENV.CLIENT_URL}/dashboard/vault`,
      ordersUrl: `${ENV.CLIENT_URL}/dashboard/orders`,
      ticketsUrl: `${ENV.CLIENT_URL}/dashboard/tickets`,
      ...variables,
    };

    for (const [key, val] of Object.entries(allVariables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      subject = subject.replace(regex, String(val ?? ''));
      htmlContent = htmlContent.replace(regex, String(val ?? ''));
      textContent = textContent.replace(regex, String(val ?? ''));
    }

    // Wrap in standard shell if not already full document
    if (!htmlContent.includes('<html')) {
      htmlContent = renderEmailShell({
        title: subject,
        bodyHtml: htmlContent,
        actionText: allVariables.actionText,
        actionUrl: allVariables.actionUrl,
      });
    }

    // Create persistent EmailLog entry
    const log = await EmailLog.create({
      recipient,
      recipientName,
      templateKey,
      subject,
      htmlContent,
      textContent,
      metadata,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
    });

    // Enqueue for background delivery
    emailQueue.push({ logId: log._id.toString(), retryCount: 0 });
    processQueueWorker();

    return { success: true, logId: log._id };
  } catch (err) {
    console.error('Failed to queue email:', err);
    return { success: false, error: err.message };
  }
};

/**
 * HIGH-LEVEL AUTOMATED EMAIL TRIGGERS
 */

// 1. Welcome Email
export const sendWelcomeEmail = async (user) => {
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'welcome_email',
    subject: `Welcome to BundleByte, {{customerName}}!`,
    variables: {
      actionText: 'Explore Software & Vault',
      actionUrl: `${ENV.CLIENT_URL}/dashboard`,
    },
    metadata: { userId: user._id.toString() },
  });
};

// 2. Email Verification
export const sendVerificationEmail = async (user, token) => {
  const verifyUrl = `${ENV.CLIENT_URL}/login?verifyToken=${token}`;
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'email_verification',
    subject: `Verify your email address for BundleByte`,
    variables: {
      verifyUrl,
      actionText: 'Verify Email Address',
      actionUrl: verifyUrl,
    },
    metadata: { userId: user._id.toString() },
  });
};

// 3. Password Reset
export const sendPasswordResetEmail = async (user, resetToken) => {
  const resetUrl = `${ENV.CLIENT_URL}/login?resetToken=${resetToken}`;
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'password_reset',
    subject: `Reset your BundleByte account password`,
    variables: {
      resetUrl,
      actionText: 'Reset Password',
      actionUrl: resetUrl,
    },
    metadata: { userId: user._id.toString() },
  });
};

// 4. Order Confirmation
export const sendOrderConfirmationEmail = async (order, user) => {
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'order_confirmation',
    subject: `Order #{{orderNumber}} Confirmed`,
    variables: {
      orderNumber: order.orderNumber,
      orderTotal: `₹${order.totalAmount.toLocaleString('en-IN')}`,
      itemCount: order.items?.length || 1,
      paymentMethod: order.paymentMethod.toUpperCase(),
      actionText: 'View Order Invoice',
      actionUrl: `${ENV.CLIENT_URL}/dashboard/orders`,
    },
    metadata: { orderId: order._id.toString(), userId: user._id.toString() },
  });
};

// 5. Payment Confirmation
export const sendPaymentConfirmationEmail = async (order, user) => {
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'payment_confirmation',
    subject: `Payment Received for Order #{{orderNumber}}`,
    variables: {
      orderNumber: order.orderNumber,
      amountPaid: `₹${order.totalAmount.toLocaleString('en-IN')}`,
      gateway: order.paymentDetails?.gateway || order.paymentMethod,
      actionText: 'Open Order Details',
      actionUrl: `${ENV.CLIENT_URL}/dashboard/orders`,
    },
    metadata: { orderId: order._id.toString(), userId: user._id.toString() },
  });
};

// 6. Wallet Top-Up Confirmation
export const sendWalletTopupEmail = async (user, amount, newBalance) => {
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'wallet_topup_confirmation',
    subject: `Wallet Credited with ₹{{amount}}`,
    variables: {
      amount: amount.toLocaleString('en-IN'),
      newBalance: newBalance.toLocaleString('en-IN'),
      actionText: 'Open Wallet Dashboard',
      actionUrl: `${ENV.CLIENT_URL}/dashboard/wallet`,
    },
    metadata: { userId: user._id.toString() },
  });
};

// 7. Secure Vault Delivery Notification (NEVER sends plaintext passwords or licenses in email!)
export const sendVaultDeliveryNotification = async (order, user, productTitle) => {
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'vault_delivery_ready',
    subject: `Your Digital Products for Order #{{orderNumber}} are Ready!`,
    variables: {
      orderNumber: order.orderNumber,
      productTitle: productTitle || 'Purchased Products',
      actionText: 'Access Your Digital Vault',
      actionUrl: `${ENV.CLIENT_URL}/dashboard/vault`,
    },
    metadata: { orderId: order._id.toString(), userId: user._id.toString() },
  });
};

// 8. Subscription Expiry Reminder
export const sendSubscriptionExpiryReminder = async (subscription, user, daysRemaining) => {
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'subscription_expiry',
    subject: `Subscription for {{productTitle}} expires in {{daysRemaining}} days`,
    variables: {
      productTitle: subscription.productTitle,
      daysRemaining,
      renewalUrl: `${ENV.CLIENT_URL}/dashboard/subscriptions`,
      actionText: 'Renew Subscription',
      actionUrl: `${ENV.CLIENT_URL}/dashboard/subscriptions`,
    },
    metadata: { subscriptionId: subscription._id.toString(), userId: user._id.toString() },
  });
};

// 9. Order Status Updates
export const sendOrderStatusUpdateEmail = async (order, user, newStatus) => {
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'order_status_update',
    subject: `Update on Order #{{orderNumber}}: Status is {{orderStatus}}`,
    variables: {
      orderNumber: order.orderNumber,
      orderStatus: newStatus.replace(/_/g, ' ').toUpperCase(),
      actionText: 'Track Order',
      actionUrl: `${ENV.CLIENT_URL}/dashboard/orders`,
    },
    metadata: { orderId: order._id.toString(), userId: user._id.toString() },
  });
};

// 10. Support Ticket Replies
export const sendTicketReplyNotification = async (ticket, user, replySnippet) => {
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'ticket_reply',
    subject: `New Reply on Support Ticket #{{ticketNumber}}`,
    variables: {
      ticketNumber: ticket.ticketNumber,
      subjectSnippet: ticket.subject,
      replySnippet: replySnippet || 'Support has responded to your inquiry.',
      actionText: 'View Ticket Thread',
      actionUrl: `${ENV.CLIENT_URL}/dashboard/tickets`,
    },
    metadata: { ticketId: ticket._id.toString(), userId: user._id.toString() },
  });
};

// 11. Refund Notifications
export const sendRefundNotificationEmail = async (refund, order, user) => {
  return await queueEmail({
    recipient: user.email,
    recipientName: user.name,
    templateKey: 'refund_notification',
    subject: `Refund Processed for Order #{{orderNumber}}`,
    variables: {
      orderNumber: order.orderNumber,
      refundAmount: `₹${refund.amount.toLocaleString('en-IN')}`,
      reason: refund.reason || 'Requested by customer',
      actionText: 'View Wallet & Orders',
      actionUrl: `${ENV.CLIENT_URL}/dashboard/orders`,
    },
    metadata: { refundId: refund._id.toString(), userId: user._id.toString() },
  });
};
