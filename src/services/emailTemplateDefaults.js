import EmailTemplate from '../models/EmailTemplate.js';
import { buildCrossClientEmailHtml } from './emailHtmlEngine.js';

export const DEFAULT_TEMPLATES = [
  // ==========================================
  // 1. INSTANT ACCESS DELIVERY (NEW DEDICATED)
  // ==========================================
  {
    key: 'instant_access_delivery',
    name: 'Instant Access Link & Invitation Delivery',
    category: 'delivery',
    subject: 'Your Instant Access Link: {{productTitle}} (Order #{{orderNumber}})',
    previewText: 'Immediate access to {{productTitle}} has been provisioned. Open your invite link inside.',
    variables: [
      'customerName',
      'orderNumber',
      'productTitle',
      'productAccessLink',
      'setupGuideUrl',
      'vaultUrl',
      'activationSteps',
      'supportUrl',
      'orderDate',
    ],
    brandColor: '#4f46e5',
    headerLogoEnabled: true,
    primaryButtonText: 'Open Your Product Access Link',
    primaryButtonUrl: '{{productAccessLink}}',
    footerText: 'BundleByte &bull; Enterprise Software & Verified Digital Assets',
    visualSections: {
      headline: 'Your Digital Product Access is Ready!',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Thank you for choosing BundleByte. Fulfillment for <strong>Order #{{orderNumber}}</strong> is complete. Your direct invite and software provisioning link are active.</p>',
      productAccessBox: {
        enabled: true,
        productTitle: '{{productTitle}}',
        accessLink: '{{productAccessLink}}',
        accessLabel: 'Open Your Product Access Link',
        setupGuideUrl: '{{setupGuideUrl}}',
        showLicenseKey: false,
        activationSteps: '{{activationSteps}}',
      },
      ctaButton: {
        label: 'Access Secure Digital Vault',
        url: '{{vaultUrl}}',
        color: '#4f46e5',
        radius: '8px',
      },
      securityNotice: 'This single-tenant invitation link was generated exclusively for your authorized email address. For security compliance, please do not forward this message.',
      supportLink: {
        label: 'Need Help? Message Concierge Desk on WhatsApp',
        url: '{{supportUrl}}',
      },
      footerText: 'BundleByte &bull; Instant Verified Delivery &bull; Dedicated Support',
    },
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Your Instant Access Link: {{productTitle}} (Order #{{orderNumber}})',
      previewText: 'Immediate access to {{productTitle}} has been provisioned. Open your invite link inside.',
      brandColor: '#4f46e5',
      headline: 'Your Digital Product Access is Ready!',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Thank you for choosing BundleByte. Fulfillment for <strong>Order #{{orderNumber}}</strong> is complete. Your direct invite and software provisioning link are active.</p>',
      productAccessBox: {
        enabled: true,
        productTitle: '{{productTitle}}',
        accessLink: '{{productAccessLink}}',
        accessLabel: 'Open Your Product Access Link',
        setupGuideUrl: '{{setupGuideUrl}}',
        showLicenseKey: false,
        activationSteps: '{{activationSteps}}',
      },
      ctaButton: {
        label: 'Access Secure Digital Vault',
        url: '{{vaultUrl}}',
        color: '#4f46e5',
        radius: '8px',
      },
      securityNotice: 'This single-tenant invitation link was generated exclusively for your authorized email address. For security compliance, please do not forward this message.',
      supportLink: {
        label: 'Need Help? Message Concierge Desk on WhatsApp',
        url: '{{supportUrl}}',
      },
      footerText: 'BundleByte &bull; Instant Verified Delivery &bull; Dedicated Support',
    }),
    textBody: 'Your instant access link for {{productTitle}} is ready! Open your product access link: {{productAccessLink}}. Read setup guide: {{setupGuideUrl}}. Access your encrypted vault: {{vaultUrl}}',
  },

  // ==========================================
  // 2. LICENSE KEY DELIVERY (NEW DEDICATED)
  // ==========================================
  {
    key: 'license_key_delivery',
    name: 'License Key & Step-by-Step Activation',
    category: 'delivery',
    subject: 'Your Genuine License Key: {{productTitle}} (Order #{{orderNumber}})',
    previewText: 'Copy your retail license key and follow the step-by-step activation guide for {{productTitle}}.',
    variables: [
      'customerName',
      'orderNumber',
      'productTitle',
      'licenseKeyPreview',
      'setupGuideUrl',
      'vaultUrl',
      'activationSteps',
      'supportUrl',
    ],
    brandColor: '#0ea5e9',
    headerLogoEnabled: true,
    primaryButtonText: 'Reveal Full Key in Vault',
    primaryButtonUrl: '{{vaultUrl}}',
    footerText: 'BundleByte &bull; Genuine Retail Software & Digital Licenses',
    visualSections: {
      headline: 'Genuine Software License Issued',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Your payment for <strong>Order #{{orderNumber}}</strong> has cleared, and your genuine perpetual license key for <strong>{{productTitle}}</strong> is ready for redemption.</p>',
      productAccessBox: {
        enabled: true,
        productTitle: '{{productTitle}}',
        accessLink: '{{vaultUrl}}',
        accessLabel: 'Reveal Full Key in Vault',
        setupGuideUrl: '{{setupGuideUrl}}',
        showLicenseKey: true,
        licenseKeyPreview: '{{licenseKeyPreview}}',
        activationSteps: '{{activationSteps}}',
      },
      ctaButton: {
        label: 'Open Secure Vault & Copy Key',
        url: '{{vaultUrl}}',
        color: '#0ea5e9',
        radius: '8px',
      },
      securityNotice: 'License keys are tied to your personal BundleByte account. A permanent backup is kept in your encrypted vault so you never lose activation status.',
      supportLink: {
        label: 'Need Activation Assistance? Contact Concierge',
        url: '{{supportUrl}}',
      },
      footerText: 'BundleByte &bull; Genuine Digital Licenses with Lifetime Warranty',
    },
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Your Genuine License Key: {{productTitle}} (Order #{{orderNumber}})',
      previewText: 'Copy your retail license key and follow the step-by-step activation guide for {{productTitle}}.',
      brandColor: '#0ea5e9',
      headline: 'Genuine Software License Issued',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Your payment for <strong>Order #{{orderNumber}}</strong> has cleared, and your genuine perpetual license key for <strong>{{productTitle}}</strong> is ready for redemption.</p>',
      productAccessBox: {
        enabled: true,
        productTitle: '{{productTitle}}',
        accessLink: '{{vaultUrl}}',
        accessLabel: 'Reveal Full Key in Vault',
        setupGuideUrl: '{{setupGuideUrl}}',
        showLicenseKey: true,
        licenseKeyPreview: '{{licenseKeyPreview}}',
        activationSteps: '{{activationSteps}}',
      },
      ctaButton: {
        label: 'Open Secure Vault & Copy Key',
        url: '{{vaultUrl}}',
        color: '#0ea5e9',
        radius: '8px',
      },
      securityNotice: 'License keys are tied to your personal BundleByte account. A permanent backup is kept in your encrypted vault so you never lose activation status.',
      supportLink: {
        label: 'Need Activation Assistance? Contact Concierge',
        url: '{{supportUrl}}',
      },
      footerText: 'BundleByte &bull; Genuine Digital Licenses with Lifetime Warranty',
    }),
    textBody: 'Your genuine license key for {{productTitle}} is: {{licenseKeyPreview}}. Follow activation guide: {{setupGuideUrl}}. View in vault: {{vaultUrl}}',
  },

  // ==========================================
  // 3. ACCOUNT CREDENTIALS VAULT READY (NEW DEDICATED)
  // ==========================================
  {
    key: 'account_credentials_vault',
    name: 'Account Credentials Vault Ready',
    category: 'delivery',
    subject: 'Encrypted Credentials Ready in Vault: {{productTitle}} (Order #{{orderNumber}})',
    previewText: 'Your private account credentials have been securely provisioned in your BundleByte Vault.',
    variables: [
      'customerName',
      'orderNumber',
      'productTitle',
      'vaultUrl',
      'setupGuideUrl',
      'supportUrl',
      'paymentMethod',
    ],
    brandColor: '#8b5cf6',
    headerLogoEnabled: true,
    primaryButtonText: 'Authenticate & Access Vault',
    primaryButtonUrl: '{{vaultUrl}}',
    footerText: 'BundleByte Security Center &bull; Zero-Cleartext Credential Architecture',
    visualSections: {
      headline: 'Encrypted Credentials Staged in Vault',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Account setup for <strong>{{productTitle}}</strong> (Order #{{orderNumber}}) has been finalized by our provisioning systems.</p>',
      ctaButton: {
        label: 'Authenticate & Open Your Vault',
        url: '{{vaultUrl}}',
        color: '#8b5cf6',
        radius: '8px',
      },
      securityNotice: '🛡️ <strong>Zero-Cleartext Guarantee:</strong> To prevent unauthorized interception and email skimming, master account passwords, PINs, and 2FA recovery codes are NEVER transmitted over email. Click the button above to safely reveal your credentials inside your authenticated session.',
      supportLink: {
        label: 'Have Questions? Message Concierge Team on WhatsApp',
        url: '{{supportUrl}}',
      },
      footerText: 'BundleByte &bull; Enterprise Privacy & Encrypted Vault Delivery',
    },
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Encrypted Credentials Ready in Vault: {{productTitle}} (Order #{{orderNumber}})',
      previewText: 'Your private account credentials have been securely provisioned in your BundleByte Vault.',
      brandColor: '#8b5cf6',
      headline: 'Encrypted Credentials Staged in Vault',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Account setup for <strong>{{productTitle}}</strong> (Order #{{orderNumber}}) has been finalized by our provisioning systems.</p>',
      ctaButton: {
        label: 'Authenticate & Open Your Vault',
        url: '{{vaultUrl}}',
        color: '#8b5cf6',
        radius: '8px',
      },
      securityNotice: '🛡️ <strong>Zero-Cleartext Guarantee:</strong> To prevent unauthorized interception and email skimming, master account passwords, PINs, and 2FA recovery codes are NEVER transmitted over email. Click the button above to safely reveal your credentials inside your authenticated session.',
      supportLink: {
        label: 'Have Questions? Message Concierge Team on WhatsApp',
        url: '{{supportUrl}}',
      },
      footerText: 'BundleByte &bull; Enterprise Privacy & Encrypted Vault Delivery',
    }),
    textBody: 'Your credentials for {{productTitle}} are ready in your secure vault. Log in to view: {{vaultUrl}}',
  },

  // ==========================================
  // 4. WHATSAPP CONCIERGE DELIVERY (NEW DEDICATED)
  // ==========================================
  {
    key: 'whatsapp_concierge_delivery',
    name: 'Concierge WhatsApp Manual Dispatch',
    category: 'delivery',
    subject: 'Concierge Dispatch Ready: {{productTitle}} (Order #{{orderNumber}})',
    previewText: 'Your personalized order is queued for 1-on-1 concierge dispatch. Connect via WhatsApp now.',
    variables: [
      'customerName',
      'orderNumber',
      'productTitle',
      'orderTotal',
      'supportUrl',
      'vaultUrl',
    ],
    brandColor: '#10b981',
    headerLogoEnabled: true,
    primaryButtonText: 'Open WhatsApp Concierge Chat',
    primaryButtonUrl: '{{supportUrl}}',
    footerText: 'BundleByte &bull; VIP Concierge Desk & Dedicated Account Management',
    visualSections: {
      headline: 'Your Concierge Dispatch is Standing By',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Thank you for your order! Your purchase of <strong>{{productTitle}}</strong> (Order <strong>#{{orderNumber}}</strong>) includes white-glove manual onboarding with our dedicated delivery team.</p><p>Click below to begin your 1-on-1 WhatsApp session pre-loaded with your order token for instantaneous fulfillment.</p>',
      ctaButton: {
        label: 'Connect with Concierge on WhatsApp',
        url: '{{supportUrl}}',
        color: '#10b981',
        radius: '8px',
      },
      securityNotice: 'Our official verified WhatsApp concierge will never ask for your BundleByte account master password or credit card CVV. Always verify the green business badge.',
      supportLink: {
        label: 'View Order Status in Dashboard',
        url: '{{vaultUrl}}',
      },
      footerText: 'BundleByte Concierge Service &bull; Average Response Time: < 5 Minutes',
    },
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Concierge Dispatch Ready: {{productTitle}} (Order #{{orderNumber}})',
      previewText: 'Your personalized order is queued for 1-on-1 concierge dispatch. Connect via WhatsApp now.',
      brandColor: '#10b981',
      headline: 'Your Concierge Dispatch is Standing By',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Thank you for your order! Your purchase of <strong>{{productTitle}}</strong> (Order <strong>#{{orderNumber}}</strong>) includes white-glove manual onboarding with our dedicated delivery team.</p><p>Click below to begin your 1-on-1 WhatsApp session pre-loaded with your order token for instantaneous fulfillment.</p>',
      ctaButton: {
        label: 'Connect with Concierge on WhatsApp',
        url: '{{supportUrl}}',
        color: '#10b981',
        radius: '8px',
      },
      securityNotice: 'Our official verified WhatsApp concierge will never ask for your BundleByte account master password or credit card CVV. Always verify the green business badge.',
      supportLink: {
        label: 'View Order Status in Dashboard',
        url: '{{vaultUrl}}',
      },
      footerText: 'BundleByte Concierge Service &bull; Average Response Time: < 5 Minutes',
    }),
    textBody: 'Your concierge dispatch for {{productTitle}} (Order #{{orderNumber}}) is ready. Chat with us on WhatsApp: {{supportUrl}}',
  },

  // ==========================================
  // 5. REGISTRATION WELCOME EMAIL
  // ==========================================
  {
    key: 'welcome_email',
    name: 'Registration Welcome Email',
    category: 'auth',
    subject: 'Welcome to BundleByte, {{customerName}}!',
    previewText: 'Explore genuine software licenses, verified digital accounts, and your encrypted personal vault.',
    variables: ['customerName', 'dashboardUrl', 'vaultUrl'],
    brandColor: '#4f46e5',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Welcome to BundleByte, {{customerName}}!',
      previewText: 'Explore genuine software licenses, verified digital accounts, and your encrypted personal vault.',
      brandColor: '#4f46e5',
      headline: 'Welcome to BundleByte!',
      greeting: 'Hello {{customerName}},',
      bodyContent: `
        <p>Thank you for joining BundleByte — your trusted marketplace for premium developer tools, verified software subscriptions, and genuine perpetual licenses.</p>
        <p>Explore your dashboard anytime to track active subscriptions, manage your store wallet, and access your purchased software keys.</p>
      `,
      ctaButton: {
        label: 'Explore Software & Vault',
        url: '{{vaultUrl}}',
        color: '#4f46e5',
        radius: '8px',
      },
      securityNotice: '<strong>Quick Security Tip:</strong> Your digital license keys and account credentials are permanently stored in your encrypted personal <strong>Digital Vault</strong>. They are never sent via unencrypted email.',
      footerText: 'BundleByte &bull; Premium Digital Marketplace',
    }),
    textBody: 'Welcome to BundleByte! Thank you for joining us. You can access your digital licenses and active subscriptions anytime from your dashboard: {{vaultUrl}}',
  },

  // ==========================================
  // 6. EMAIL VERIFICATION
  // ==========================================
  {
    key: 'email_verification',
    name: 'Email Address Verification',
    category: 'auth',
    subject: 'Verify your email address for BundleByte',
    previewText: 'Confirm your email address to activate your BundleByte account and unlock orders.',
    variables: ['customerName', 'verifyUrl'],
    brandColor: '#4f46e5',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Verify your email address for BundleByte',
      previewText: 'Confirm your email address to activate your BundleByte account and unlock orders.',
      brandColor: '#4f46e5',
      headline: 'Verify Your Email Address',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Please click the button below to verify your email address and activate all features on your BundleByte account.</p>',
      ctaButton: {
        label: 'Verify Email Address',
        url: '{{verifyUrl}}',
        color: '#4f46e5',
        radius: '8px',
      },
      securityNotice: 'This link is active for 24 hours. If you did not register for a BundleByte account, please disregard this email.',
      footerText: 'BundleByte &bull; Account Security Desk',
    }),
    textBody: 'Please verify your email address by following this link: {{verifyUrl}}',
  },

  // ==========================================
  // 7. PASSWORD RESET
  // ==========================================
  {
    key: 'password_reset',
    name: 'Password Reset Request',
    category: 'auth',
    subject: 'Reset your BundleByte account password',
    previewText: 'Secure link to reset your account password. Expires in 15 minutes.',
    variables: ['customerName', 'resetUrl'],
    brandColor: '#e11d48',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Reset your BundleByte account password',
      previewText: 'Secure link to reset your account password. Expires in 15 minutes.',
      brandColor: '#e11d48',
      headline: 'Reset Your Account Password',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>We received a request to reset your password. Click the secure button below to set a new password for your account.</p>',
      ctaButton: {
        label: 'Set New Password',
        url: '{{resetUrl}}',
        color: '#e11d48',
        radius: '8px',
      },
      securityNotice: '<strong>Security Notice:</strong> This link expires in 15 minutes. If you did not request a password reset, please contact support immediately.',
      footerText: 'BundleByte &bull; Account Security Desk',
    }),
    textBody: 'To reset your password, visit the following URL: {{resetUrl}}. This link expires in 15 minutes.',
  },

  // ==========================================
  // 8. ORDER CONFIRMATION
  // ==========================================
  {
    key: 'order_confirmation',
    name: 'Customer Order Confirmation',
    category: 'order',
    subject: 'Order #{{orderNumber}} Confirmed',
    previewText: 'We have received Order #{{orderNumber}} for {{orderTotal}}. Your items are being prepared.',
    variables: ['customerName', 'orderNumber', 'orderTotal', 'itemCount', 'paymentMethod', 'vaultUrl'],
    brandColor: '#4f46e5',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Order #{{orderNumber}} Confirmed',
      previewText: 'We have received Order #{{orderNumber}} for {{orderTotal}}. Your items are being prepared.',
      brandColor: '#4f46e5',
      headline: 'Order Confirmed!',
      greeting: 'Hello {{customerName}},',
      bodyContent: `
        <p>We have successfully received your order <strong>#{{orderNumber}}</strong>.</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; margin: 16px 0;">
          <tr>
            <td style="padding: 16px 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size: 13px; color: #94a3b8; padding: 4px 0;">Order Number:</td>
                  <td align="right" style="font-size: 13px; font-weight: 700; color: #ffffff; padding: 4px 0;">#{{orderNumber}}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #94a3b8; padding: 4px 0;">Total Items:</td>
                  <td align="right" style="font-size: 13px; font-weight: 600; color: #ffffff; padding: 4px 0;">{{itemCount}}</td>
                </tr>
                <tr>
                  <td style="font-size: 13px; color: #94a3b8; padding: 4px 0;">Payment Method:</td>
                  <td align="right" style="font-size: 13px; font-weight: 600; color: #ffffff; padding: 4px 0;">{{paymentMethod}}</td>
                </tr>
                <tr>
                  <td style="font-size: 15px; font-weight: 700; color: #ffffff; padding-top: 10px; border-top: 1px solid #334155;">Total Amount:</td>
                  <td align="right" style="font-size: 17px; font-weight: 800; color: #6366f1; padding-top: 10px; border-top: 1px solid #334155;">{{orderTotal}}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p>Your license keys and credentials are being prepared for dispatch to your digital vault.</p>
      `,
      ctaButton: {
        label: 'View Order Details & Invoices',
        url: '{{vaultUrl}}',
        color: '#4f46e5',
        radius: '8px',
      },
      footerText: 'BundleByte &bull; Order Fulfillment Center',
    }),
    textBody: 'Your order #{{orderNumber}} has been placed successfully for {{orderTotal}}. Check your digital vault to access your products: {{vaultUrl}}',
  },

  // ==========================================
  // 9. PAYMENT CONFIRMATION
  // ==========================================
  {
    key: 'payment_confirmation',
    name: 'Payment Receipt & Confirmation',
    category: 'finance',
    subject: 'Payment Received for Order #{{orderNumber}}',
    previewText: 'Your payment of {{amountPaid}} has been verified.',
    variables: ['customerName', 'orderNumber', 'amountPaid', 'gateway', 'vaultUrl'],
    brandColor: '#10b981',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Payment Received for Order #{{orderNumber}}',
      previewText: 'Your payment of {{amountPaid}} has been verified.',
      brandColor: '#10b981',
      headline: 'Payment Verified & Recorded',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Your payment of <strong>{{amountPaid}}</strong> for Order <strong>#{{orderNumber}}</strong> has been confirmed via <strong>{{gateway}}</strong>.</p>',
      ctaButton: {
        label: 'Open Digital Vault',
        url: '{{vaultUrl}}',
        color: '#10b981',
        radius: '8px',
      },
      securityNotice: '<strong>Instant Automated Delivery:</strong> With payment confirmed, your licenses and accounts are immediately available in your Personal Vault.',
      footerText: 'BundleByte Finance &bull; Automated Settlement',
    }),
    textBody: 'Your payment of {{amountPaid}} for Order #{{orderNumber}} via {{gateway}} has been verified.',
  },

  // ==========================================
  // 10. WALLET TOP-UP CONFIRMATION
  // ==========================================
  {
    key: 'wallet_topup_confirmation',
    name: 'Wallet Balance Top-Up Confirmation',
    category: 'finance',
    subject: 'Wallet Credited with ₹{{amount}}',
    previewText: 'Your store wallet has been updated. New available balance: ₹{{newBalance}}',
    variables: ['customerName', 'amount', 'newBalance', 'vaultUrl'],
    brandColor: '#10b981',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Wallet Credited with ₹{{amount}}',
      previewText: 'Your store wallet has been updated. New available balance: ₹{{newBalance}}',
      brandColor: '#10b981',
      headline: 'Wallet Balance Updated!',
      greeting: 'Hello {{customerName}},',
      bodyContent: `
        <p>We have credited <strong>₹{{amount}}</strong> to your internal BundleByte wallet balance.</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; margin: 16px 0; text-align: center;">
          <tr>
            <td style="padding: 24px 20px;">
              <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">New Available Balance</div>
              <div style="font-size: 28px; font-weight: 900; color: #10b981; margin-top: 6px;">₹{{newBalance}}</div>
            </td>
          </tr>
        </table>
        <p>You can use your wallet balance for instantaneous 1-click checkouts and split payments across any product in our store.</p>
      `,
      ctaButton: {
        label: 'Open Wallet Dashboard',
        url: '{{vaultUrl}}',
        color: '#10b981',
        radius: '8px',
      },
      footerText: 'BundleByte Wallet &bull; Secure Digital Cash',
    }),
    textBody: 'Your BundleByte wallet has been credited with ₹{{amount}}. Your new balance is ₹{{newBalance}}.',
  },

  // ==========================================
  // 11. VAULT DELIVERY READY
  // ==========================================
  {
    key: 'vault_delivery_ready',
    name: 'Digital Products Vault Delivery Notification',
    category: 'delivery',
    subject: 'Your Digital Products for Order #{{orderNumber}} are Ready!',
    previewText: 'Fulfillment complete for {{productTitle}}. Open your secure vault to access your credentials.',
    variables: ['customerName', 'orderNumber', 'productTitle', 'vaultUrl'],
    brandColor: '#4f46e5',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Your Digital Products for Order #{{orderNumber}} are Ready!',
      previewText: 'Fulfillment complete for {{productTitle}}. Open your secure vault to access your credentials.',
      brandColor: '#4f46e5',
      headline: 'Your Products are Ready in Your Vault!',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>Great news! Digital fulfillment for Order <strong>#{{orderNumber}}</strong> (<strong>{{productTitle}}</strong>) is complete.</p>',
      ctaButton: {
        label: 'Access Your Digital Vault',
        url: '{{vaultUrl}}',
        color: '#4f46e5',
        radius: '8px',
      },
      securityNotice: '<strong>🔒 End-to-End Credential Security:</strong> To protect your digital licenses, software access links, and account passwords from unencrypted email interception, credentials are never sent via cleartext email. Click the button above to view and copy your keys securely from your authenticated dashboard vault.',
      footerText: 'BundleByte &bull; Encrypted Vault Delivery',
    }),
    textBody: 'Your digital products for Order #{{orderNumber}} ({{productTitle}}) are ready! Open your vault to access your credentials: {{vaultUrl}}',
  },

  // ==========================================
  // 12. SUBSCRIPTION EXPIRY REMINDER
  // ==========================================
  {
    key: 'subscription_expiry',
    name: 'Subscription Expiry Reminder',
    category: 'order',
    subject: 'Subscription for {{productTitle}} expires in {{daysRemaining}} days',
    previewText: 'Your subscription is nearing renewal. Renew now to avoid interruption.',
    variables: ['customerName', 'productTitle', 'daysRemaining', 'renewalUrl'],
    brandColor: '#f59e0b',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Subscription for {{productTitle}} expires in {{daysRemaining}} days',
      previewText: 'Your subscription is nearing renewal. Renew now to avoid interruption.',
      brandColor: '#f59e0b',
      headline: 'Subscription Expiry Notice',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>This is a friendly reminder that your subscription for <strong>{{productTitle}}</strong> is scheduled to expire in <strong>{{daysRemaining}} day(s)</strong>.</p><p>To avoid any disruption to your software or team access, please renew your plan from your dashboard.</p>',
      ctaButton: {
        label: 'Renew Subscription Now',
        url: '{{renewalUrl}}',
        color: '#f59e0b',
        radius: '8px',
      },
      footerText: 'BundleByte Subscriptions &bull; Automatic Expiry Monitoring',
    }),
    textBody: 'Your subscription for {{productTitle}} expires in {{daysRemaining}} days. Visit your dashboard to renew: {{renewalUrl}}',
  },

  // ==========================================
  // 13. ORDER STATUS UPDATE
  // ==========================================
  {
    key: 'order_status_update',
    name: 'Order Lifecycle Status Update',
    category: 'order',
    subject: 'Update on Order #{{orderNumber}}: Status is {{orderStatus}}',
    previewText: 'Your order status has changed to {{orderStatus}}.',
    variables: ['customerName', 'orderNumber', 'orderStatus', 'vaultUrl'],
    brandColor: '#6366f1',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Update on Order #{{orderNumber}}: Status is {{orderStatus}}',
      previewText: 'Your order status has changed to {{orderStatus}}.',
      brandColor: '#6366f1',
      headline: 'Order Status Updated',
      greeting: 'Hello {{customerName}},',
      bodyContent: '<p>The status of your Order <strong>#{{orderNumber}}</strong> has been updated to: <strong style="color: #6366f1;">{{orderStatus}}</strong>.</p><p>You can check the full order tracking timeline and download invoices anytime from your account.</p>',
      ctaButton: {
        label: 'Track Order in Dashboard',
        url: '{{vaultUrl}}',
        color: '#6366f1',
        radius: '8px',
      },
      footerText: 'BundleByte &bull; Real-time Order Tracking',
    }),
    textBody: 'Your order #{{orderNumber}} status has been updated to: {{orderStatus}}.',
  },

  // ==========================================
  // 14. SUPPORT TICKET CONCIERGE REPLY
  // ==========================================
  {
    key: 'ticket_reply',
    name: 'Support Ticket Concierge Reply',
    category: 'support',
    subject: 'New Reply on Support Ticket #{{ticketNumber}}',
    previewText: 'Our support team has posted a reply regarding "{{subjectSnippet}}"',
    variables: ['customerName', 'ticketNumber', 'subjectSnippet', 'replySnippet', 'vaultUrl'],
    brandColor: '#4f46e5',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'New Reply on Support Ticket #{{ticketNumber}}',
      previewText: 'Our support team has posted a reply regarding "{{subjectSnippet}}"',
      brandColor: '#4f46e5',
      headline: 'New Response on Ticket #{{ticketNumber}}',
      greeting: 'Hello {{customerName}},',
      bodyContent: `
        <p>Our support team has posted a new reply regarding: <em>"{{subjectSnippet}}"</em></p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; border-left: 4px solid #6366f1; border-radius: 8px; margin: 16px 0;">
          <tr>
            <td style="padding: 16px; font-size: 14px; line-height: 1.6; color: #e2e8f0;">
              {{replySnippet}}
            </td>
          </tr>
        </table>
        <p>Please click below to view the entire ticket conversation or post your reply.</p>
      `,
      ctaButton: {
        label: 'View Ticket Thread',
        url: '{{vaultUrl}}',
        color: '#4f46e5',
        radius: '8px',
      },
      footerText: 'BundleByte &bull; 24/7 Concierge Support',
    }),
    textBody: 'New response on Support Ticket #{{ticketNumber}}: {{replySnippet}}',
  },

  // ==========================================
  // 15. REFUND NOTIFICATION
  // ==========================================
  {
    key: 'refund_notification',
    name: 'Refund Credit Notification',
    category: 'finance',
    subject: 'Refund Processed for Order #{{orderNumber}}',
    previewText: 'A refund of {{refundAmount}} has been processed for Order #{{orderNumber}}.',
    variables: ['customerName', 'orderNumber', 'refundAmount', 'reason', 'vaultUrl'],
    brandColor: '#10b981',
    headerLogoEnabled: true,
    htmlBody: buildCrossClientEmailHtml({
      subject: 'Refund Processed for Order #{{orderNumber}}',
      previewText: 'A refund of {{refundAmount}} has been processed for Order #{{orderNumber}}.',
      brandColor: '#10b981',
      headline: 'Refund Confirmed',
      greeting: 'Hello {{customerName}},',
      bodyContent: `
        <p>A refund of <strong>{{refundAmount}}</strong> has been successfully processed for Order <strong>#{{orderNumber}}</strong>.</p>
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; margin: 16px 0;">
          <tr>
            <td style="padding: 16px 20px;">
              <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; font-weight: 700;">Refund Note:</div>
              <div style="font-size: 14px; font-weight: 600; color: #ffffff; margin-top: 4px;">{{reason}}</div>
            </td>
          </tr>
        </table>
        <p>If credited to your store wallet, funds are immediately available for use. For external gateway refunds, please allow 3-5 business days depending on your bank.</p>
      `,
      ctaButton: {
        label: 'View Wallet & Orders',
        url: '{{vaultUrl}}',
        color: '#10b981',
        radius: '8px',
      },
      footerText: 'BundleByte Finance &bull; Guaranteed Buyer Protection',
    }),
    textBody: 'A refund of {{refundAmount}} has been processed for Order #{{orderNumber}}.',
  },
];

/**
 * Retrieve factory default template by key
 */
export const getDefaultTemplateByKey = (key) => {
  return DEFAULT_TEMPLATES.find((t) => t.key === key.toLowerCase().trim()) || null;
};

/**
 * Ensure all default templates are seeded into database
 */
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
