import EmailTemplate from '../models/EmailTemplate.js';

export const DEFAULT_TEMPLATES = [
  {
    key: 'welcome_email',
    name: 'Registration Welcome Email',
    category: 'auth',
    subject: 'Welcome to BundleByte, {{customerName}}!',
    variables: ['customerName', 'dashboardUrl', 'vaultUrl'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Welcome to BundleByte!</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>Thank you for joining BundleByte — your trusted marketplace for premium software subscriptions, verified digital accounts, and genuine perpetual licenses.</p>
      <div class="alert-box">
        <strong>Quick Security Tip:</strong> Your digital license keys and account credentials are permanently stored in your encrypted personal <strong>Digital Vault</strong>. They are never sent via unencrypted email.
      </div>
      <p>Explore your dashboard anytime to track active subscriptions, manage your store wallet, and access your purchased software keys.</p>
    `,
    textBody: 'Welcome to BundleByte! Thank you for joining us. You can access your digital licenses and active subscriptions anytime from your dashboard.',
  },
  {
    key: 'email_verification',
    name: 'Email Address Verification',
    category: 'auth',
    subject: 'Verify your email address for BundleByte',
    variables: ['customerName', 'verifyUrl'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Verify Your Email Address</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>Please click the button below to verify your email address and activate all features on your BundleByte account.</p>
      <div class="alert-box">
        This link is active for 24 hours. If you did not register for an account, please disregard this email.
      </div>
    `,
    textBody: 'Please verify your email address by following the link: {{verifyUrl}}',
  },
  {
    key: 'password_reset',
    name: 'Password Reset Request',
    category: 'auth',
    subject: 'Reset your BundleByte account password',
    variables: ['customerName', 'resetUrl'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Reset Your Password</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>We received a request to reset your password. Click the secure button below to set a new password for your account.</p>
      <div class="alert-box">
        <strong>Security Notice:</strong> This link expires in 15 minutes. If you did not request a password reset, please contact support immediately.
      </div>
    `,
    textBody: 'To reset your password, visit the following URL: {{resetUrl}}. This link expires in 15 minutes.',
  },
  {
    key: 'order_confirmation',
    name: 'Customer Order Confirmation',
    category: 'order',
    subject: 'Order #{{orderNumber}} Confirmed',
    variables: ['customerName', 'orderNumber', 'orderTotal', 'itemCount', 'paymentMethod'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Order Confirmed!</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>We have successfully received your order <strong>#{{orderNumber}}</strong>.</p>
      <div style="background: #0f172a; padding: 16px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #94a3b8;">Order Number:</span>
          <strong style="color: #ffffff;">#{{orderNumber}}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #94a3b8;">Total Items:</span>
          <span style="color: #ffffff;">{{itemCount}} item(s)</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
          <span style="color: #94a3b8;">Payment Method:</span>
          <span style="color: #ffffff;">{{paymentMethod}}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 16px; padding-top: 8px; border-top: 1px solid #334155;">
          <span style="color: #ffffff; font-weight: bold;">Total Amount:</span>
          <strong style="color: #6366f1;">{{orderTotal}}</strong>
        </div>
      </div>
      <p>Your license keys and credentials are being prepared for dispatch to your digital vault.</p>
    `,
    textBody: 'Your order #{{orderNumber}} has been placed successfully for {{orderTotal}}. Check your digital vault to access your products.',
  },
  {
    key: 'payment_confirmation',
    name: 'Payment Receipt & Confirmation',
    category: 'finance',
    subject: 'Payment Received for Order #{{orderNumber}}',
    variables: ['customerName', 'orderNumber', 'amountPaid', 'gateway'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Payment Verified & Recorded</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>Your payment of <strong>{{amountPaid}}</strong> for Order <strong>#{{orderNumber}}</strong> has been confirmed via <strong>{{gateway}}</strong>.</p>
      <div class="alert-box">
        <strong>Instant Automated Delivery:</strong> As payment is confirmed, your licenses and accounts are available right now in your Personal Vault.
      </div>
    `,
    textBody: 'Your payment of {{amountPaid}} for Order #{{orderNumber}} via {{gateway}} has been verified.',
  },
  {
    key: 'wallet_topup_confirmation',
    name: 'Wallet Balance Top-Up Confirmation',
    category: 'finance',
    subject: 'Wallet Credited with ₹{{amount}}',
    variables: ['customerName', 'amount', 'newBalance'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Wallet Balance Updated!</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>We have credited <strong>₹{{amount}}</strong> to your internal BundleByte wallet balance.</p>
      <div style="background: #0f172a; padding: 20px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155; text-align: center;">
        <div style="font-size: 13px; color: #94a3b8; text-transform: uppercase; font-weight: bold;">New Available Balance</div>
        <div style="font-size: 28px; font-weight: 900; color: #10b981; margin-top: 6px;">₹{{newBalance}}</div>
      </div>
      <p>You can use your wallet balance for instantaneous 1-click checkouts and split payments across any product in our store.</p>
    `,
    textBody: 'Your BundleByte wallet has been credited with ₹{{amount}}. Your new balance is ₹{{newBalance}}.',
  },
  {
    key: 'vault_delivery_ready',
    name: 'Digital Products Vault Delivery Notification',
    category: 'delivery',
    subject: 'Your Digital Products for Order #{{orderNumber}} are Ready!',
    variables: ['customerName', 'orderNumber', 'productTitle', 'vaultUrl'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Your Products are Ready in Your Vault!</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>Great news! Digital fulfillment for Order <strong>#{{orderNumber}}</strong> (<strong>{{productTitle}}</strong>) is complete.</p>
      <div class="alert-box">
        <strong>🔒 End-to-End Credential Security:</strong>
        To protect your digital licenses, software access links, and account passwords from email sniffing and unauthorized interception, credentials are never sent via cleartext email.
        <br><br>
        Click the button below to view and copy your keys securely from your authenticated dashboard vault.
      </div>
    `,
    textBody: 'Your digital products for Order #{{orderNumber}} ({{productTitle}}) are ready! Open your vault to access your credentials: {{vaultUrl}}',
  },
  {
    key: 'subscription_expiry',
    name: 'Subscription Expiry Reminder',
    category: 'order',
    subject: 'Subscription for {{productTitle}} expires in {{daysRemaining}} days',
    variables: ['customerName', 'productTitle', 'daysRemaining', 'renewalUrl'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Subscription Expiry Notice</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>This is a friendly reminder that your subscription for <strong>{{productTitle}}</strong> is scheduled to expire in <strong>{{daysRemaining}} day(s)</strong>.</p>
      <p>To avoid any disruption to your software or team access, please renew your plan from your dashboard.</p>
    `,
    textBody: 'Your subscription for {{productTitle}} expires in {{daysRemaining}} days. Visit your dashboard to renew: {{renewalUrl}}',
  },
  {
    key: 'order_status_update',
    name: 'Order Lifecycle Status Update',
    category: 'order',
    subject: 'Update on Order #{{orderNumber}}: Status is {{orderStatus}}',
    variables: ['customerName', 'orderNumber', 'orderStatus'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Order Status Updated</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>The status of your Order <strong>#{{orderNumber}}</strong> has been updated to:</p>
      <div style="display: inline-block; padding: 8px 16px; border-radius: 8px; font-weight: bold; background: #3730a3; color: #ffffff; margin: 12px 0;">
        {{orderStatus}}
      </div>
      <p>You can check the full order tracking timeline and download invoices anytime from your account.</p>
    `,
    textBody: 'Your order #{{orderNumber}} status has been updated to: {{orderStatus}}.',
  },
  {
    key: 'ticket_reply',
    name: 'Support Ticket Concierge Reply',
    category: 'support',
    subject: 'New Reply on Support Ticket #{{ticketNumber}}',
    variables: ['customerName', 'ticketNumber', 'subjectSnippet', 'replySnippet'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">New Response on Ticket #{{ticketNumber}}</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>Our support team has posted a new reply regarding: <em>"{{subjectSnippet}}"</em></p>
      <div style="background: #0f172a; padding: 16px; border-radius: 12px; margin: 20px 0; border-left: 4px solid #6366f1; color: #e2e8f0; font-size: 14px;">
        {{replySnippet}}
      </div>
      <p>Please click below to view the entire ticket conversation or post your reply.</p>
    `,
    textBody: 'New response on Support Ticket #{{ticketNumber}}: {{replySnippet}}',
  },
  {
    key: 'refund_notification',
    name: 'Refund Credit Notification',
    category: 'finance',
    subject: 'Refund Processed for Order #{{orderNumber}}',
    variables: ['customerName', 'orderNumber', 'refundAmount', 'reason'],
    htmlBody: `
      <h2 style="color: #ffffff; margin-top: 0;">Refund Confirmed</h2>
      <p>Hello <strong>{{customerName}}</strong>,</p>
      <p>A refund of <strong>{{refundAmount}}</strong> has been successfully processed for Order <strong>#{{orderNumber}}</strong>.</p>
      <div style="background: #0f172a; padding: 16px; border-radius: 12px; margin: 20px 0; border: 1px solid #334155;">
        <span style="color: #94a3b8;">Refund Note:</span>
        <p style="margin: 4px 0 0; color: #ffffff;">{{reason}}</p>
      </div>
      <p>If credited to your store wallet, funds are immediately available for use. For external gateway refunds, please allow 3-5 business days depending on your bank.</p>
    `,
    textBody: 'A refund of {{refundAmount}} has been processed for Order #{{orderNumber}}.',
  },
];

export const ensureDefaultTemplates = async () => {
  try {
    for (const tpl of DEFAULT_TEMPLATES) {
      const exists = await EmailTemplate.findOne({ key: tpl.key });
      if (!exists) {
        await EmailTemplate.create(tpl);
      }
    }
  } catch (err) {
    console.error('Error seeding default email templates:', err);
  }
};
