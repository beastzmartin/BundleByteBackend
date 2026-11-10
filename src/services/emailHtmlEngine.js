/**
 * BundleByte Cross-Client Email HTML Engine
 * 
 * Generates robust, standards-compliant HTML emails compatible with:
 * Gmail (Web, iOS, Android), Apple Mail, Microsoft Outlook (Desktop & Web),
 * Yahoo Mail, and modern mobile clients.
 * 
 * Standards applied:
 * - Table-based layout (nested tables for column control & alignment)
 * - Inline CSS on all elements
 * - Bulletproof <a> CTA buttons with padding and fallback backgrounds
 * - Safe system fonts (-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif)
 * - Media query @media only screen and (max-width: 600px) for fluid mobile viewport
 * - Hidden inbox preheader snippet text
 */

export const MOCK_CONTEXTS = {
  jetbrains: {
    customerName: 'Sarah Connor',
    customerEmail: 'sarah.connor@cyberdyne.io',
    orderNumber: 'BB-849201',
    orderDate: 'Nov 11, 2026',
    orderTotal: '₹4,999.00',
    paymentMethod: 'UPI / Razorpay',
    productTitle: 'JetBrains All Products Pack (1-Year Commercial License)',
    productAccessLink: 'https://account.jetbrains.com/accept-invite?token=bb-jb-981247',
    setupGuideUrl: 'https://bundlebyte.com/guides/jetbrains-activation',
    vaultUrl: 'https://bundlebyte.com/dashboard/vault',
    activationSteps: '1. Click "Open Your Product Access Link" above to accept the team invitation.<br>2. Sign in with your registered JetBrains account or create a new one.<br>3. Open your IDE (IntelliJ, WebStorm, PyCharm) and log in with your JetBrains Account credentials.<br>4. Perpetual fallback & enterprise plugin access will activate instantly.',
    licenseKeyPreview: 'JB-7842-9901-****',
    supportUrl: 'https://wa.me/15550192834?text=Hi%20BundleByte%20Support,%20I%20need%20help%20with%20Order%20%23BB-849201',
    siteName: 'BundleByte',
    supportEmail: 'support@bundlebyte.com',
    itemCount: '1 item',
    amountPaid: '₹4,999.00',
    gateway: 'Razorpay UPI',
    newBalance: '2,500.00',
    amount: '1,000.00',
    daysRemaining: '7',
    renewalUrl: 'https://bundlebyte.com/dashboard/subscriptions',
    orderStatus: 'COMPLETED',
    ticketNumber: 'TKT-92011',
    subjectSnippet: 'Assistance with JetBrains All Pack License',
    replySnippet: 'Our licensing specialist has verified your team seat. Please use the invitation link above to activate your tools.',
    refundAmount: '₹4,999.00',
    reason: 'Customer initiated return within warranty period',
    verifyUrl: 'https://bundlebyte.com/verify?token=bb-demo-tok-12345',
    resetUrl: 'https://bundlebyte.com/reset-password?token=bb-demo-tok-67890',
  },
  claude: {
    customerName: 'Alex Rivera',
    customerEmail: 'alex@innovatetech.org',
    orderNumber: 'BB-910243',
    orderDate: 'Nov 11, 2026',
    orderTotal: '₹1,899.00',
    paymentMethod: 'Credit Card (Stripe)',
    productTitle: 'Anthropic Claude Pro Dedicated Seat (Claude 3.5 Sonnet / Opus)',
    productAccessLink: 'https://claude.ai/enterprise/invite/bb-cl-558291',
    setupGuideUrl: 'https://bundlebyte.com/guides/claude-pro-onboarding',
    vaultUrl: 'https://bundlebyte.com/dashboard/vault',
    activationSteps: '1. Click the Claude team invite link above.<br>2. Accept team membership for BundleByte Pro Workspace.<br>3. Enable two-factor authentication on your mobile authenticator app.<br>4. Begin using Claude 3.5 Sonnet & Claude 3 Opus with prioritized queue limits.',
    licenseKeyPreview: 'CL-PRO-CORP-****',
    supportUrl: 'https://wa.me/15550192834?text=Hi%20BundleByte%20Support,%20I%20need%20help%20with%20Order%20%23BB-910243',
    siteName: 'BundleByte',
    supportEmail: 'support@bundlebyte.com',
    itemCount: '1 item',
    amountPaid: '₹1,899.00',
    gateway: 'Stripe Gateway',
    newBalance: '1,500.00',
    amount: '500.00',
    daysRemaining: '14',
    renewalUrl: 'https://bundlebyte.com/dashboard/subscriptions',
    orderStatus: 'COMPLETED',
    ticketNumber: 'TKT-91044',
    subjectSnippet: 'Claude Pro Workspace Invitation',
    replySnippet: 'Your seat invitation has been refreshed. Click the access link to accept into the workspace.',
    refundAmount: '₹1,899.00',
    reason: 'Duplicate payment refunded automatically',
    verifyUrl: 'https://bundlebyte.com/verify?token=bb-demo-tok-12345',
    resetUrl: 'https://bundlebyte.com/reset-password?token=bb-demo-tok-67890',
  },
  windows: {
    customerName: 'David Miller',
    customerEmail: 'david.miller@gmail.com',
    orderNumber: 'BB-338194',
    orderDate: 'Nov 11, 2026',
    orderTotal: '₹899.00',
    paymentMethod: 'BundleByte Wallet',
    productTitle: 'Windows 11 Pro Retail Lifetime License Key (Global 32/64-bit)',
    productAccessLink: 'https://www.microsoft.com/software-download/windows11',
    setupGuideUrl: 'https://bundlebyte.com/guides/windows-11-activation',
    vaultUrl: 'https://bundlebyte.com/dashboard/vault',
    activationSteps: '1. Click Start > Settings > System > Activation on your Windows PC.<br>2. Select "Change product key" under the Upgrade edition section.<br>3. Paste your 25-character genuine retail key from your BundleByte Vault.<br>4. Click Next and Activate to complete digital license validation.',
    licenseKeyPreview: 'VK7JG-NPHTM-C97JM-****',
    supportUrl: 'https://wa.me/15550192834?text=Hi%20BundleByte%20Support,%20I%20need%20help%20with%20Order%20%23BB-338194',
    siteName: 'BundleByte',
    supportEmail: 'support@bundlebyte.com',
    itemCount: '1 item',
    amountPaid: '₹899.00',
    gateway: 'BundleByte Wallet',
    newBalance: '3,200.00',
    amount: '899.00',
    daysRemaining: 'Lifetime',
    renewalUrl: 'https://bundlebyte.com/dashboard/orders',
    orderStatus: 'DELIVERED',
    ticketNumber: 'TKT-33821',
    subjectSnippet: 'Windows 11 Retail Key Verification',
    replySnippet: 'Your retail digital license is backed by our genuine lifetime activation guarantee.',
    refundAmount: '₹899.00',
    reason: 'Key exchange requested',
    verifyUrl: 'https://bundlebyte.com/verify?token=bb-demo-tok-12345',
    resetUrl: 'https://bundlebyte.com/reset-password?token=bb-demo-tok-67890',
  },
  canva: {
    customerName: 'Elena Rostova',
    customerEmail: 'elena.design@creative.co',
    orderNumber: 'BB-662819',
    orderDate: 'Nov 11, 2026',
    orderTotal: '₹599.00',
    paymentMethod: 'Paytm UPI QR',
    productTitle: 'Canva Pro Enterprise Team Member (Lifetime Brand Kit Access)',
    productAccessLink: 'https://www.canva.com/brand/join?token=bb-canva-88912',
    setupGuideUrl: 'https://bundlebyte.com/guides/canva-pro-invite',
    vaultUrl: 'https://bundlebyte.com/dashboard/vault',
    activationSteps: '1. Open the Canva invitation link.<br>2. Sign in to your existing Canva account.<br>3. Switch your current team to "BundleByte Enterprise" in the top-left switcher.<br>4. Access 100M+ premium stock media, Magic Studio AI tools, and 1TB cloud storage.',
    licenseKeyPreview: 'CANVA-TEAM-****',
    supportUrl: 'https://wa.me/15550192834?text=Hi%20BundleByte%20Support,%20I%20need%20help%20with%20Order%20%23BB-662819',
    siteName: 'BundleByte',
    supportEmail: 'support@bundlebyte.com',
    itemCount: '1 item',
    amountPaid: '₹599.00',
    gateway: 'Paytm QR',
    newBalance: '450.00',
    amount: '599.00',
    daysRemaining: 'Lifetime',
    renewalUrl: 'https://bundlebyte.com/dashboard/subscriptions',
    orderStatus: 'DELIVERED',
    ticketNumber: 'TKT-66299',
    subjectSnippet: 'Canva Team Membership Access',
    replySnippet: 'You have been granted Brand Kit access under the enterprise plan. Log in and toggle your workspace.',
    refundAmount: '₹599.00',
    reason: 'Requested by customer',
    verifyUrl: 'https://bundlebyte.com/verify?token=bb-demo-tok-12345',
    resetUrl: 'https://bundlebyte.com/reset-password?token=bb-demo-tok-67890',
  },
  whatsapp: {
    customerName: 'Vikram Mehta',
    customerEmail: 'vikram.m@techventures.in',
    orderNumber: 'BB-772190',
    orderDate: 'Nov 11, 2026',
    orderTotal: '₹12,499.00',
    paymentMethod: 'Bank Wire Transfer',
    productTitle: 'AWS Cloud Enterprise Credits ($1,000 Voucher Code + Setup)',
    productAccessLink: 'https://bundlebyte.com/dashboard/vault',
    setupGuideUrl: 'https://bundlebyte.com/guides/aws-credits-activation',
    vaultUrl: 'https://bundlebyte.com/dashboard/vault',
    activationSteps: '1. Connect with your dedicated account manager via the WhatsApp concierge button below.<br>2. Share your AWS Account ID (12-digit number).<br>3. Our certified architect will apply the enterprise billing credit within 30 minutes.',
    licenseKeyPreview: 'AWS-CRED-****',
    supportUrl: 'https://wa.me/15550192834?text=Hi%20BundleByte%20Concierge,%20Order%20%23BB-772190%20(AWS%20Credits)%20Ready%20for%20Dispatch',
    siteName: 'BundleByte',
    supportEmail: 'support@bundlebyte.com',
    itemCount: '1 package',
    amountPaid: '₹12,499.00',
    gateway: 'Direct Bank Wire',
    newBalance: '5,000.00',
    amount: '12,499.00',
    daysRemaining: '365',
    renewalUrl: 'https://bundlebyte.com/dashboard/orders',
    orderStatus: 'IN_CONCIERGE_QUEUE',
    ticketNumber: 'TKT-77219',
    subjectSnippet: 'Concierge Verification for AWS Package',
    replySnippet: 'Our senior concierge is awaiting your confirmation on WhatsApp to apply the billing voucher.',
    refundAmount: '₹12,499.00',
    reason: 'Account credentials replaced upon request',
    verifyUrl: 'https://bundlebyte.com/verify?token=bb-demo-tok-12345',
    resetUrl: 'https://bundlebyte.com/reset-password?token=bb-demo-tok-67890',
  },
};

/**
 * Safely interpolate {{variableName}} tokens
 */
export const interpolateEmailVariables = (templateStr = '', variables = {}) => {
  if (!templateStr || typeof templateStr !== 'string') return '';
  let result = templateStr;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(val ?? ''));
  }
  return result;
};

/**
 * Build bulletproof cross-client table-based HTML email shell
 */
export const buildCrossClientEmailHtml = ({
  subject = 'Update from BundleByte',
  previewText = '',
  brandColor = '#4f46e5',
  headerLogo = '',
  headerLogoEnabled = true,
  headline = '',
  greeting = '',
  bodyContent = '',
  productAccessBox = null,
  ctaButton = null,
  securityNotice = '',
  supportLink = null,
  footerText = '',
  theme = 'dark',
}) => {
  const isDark = theme !== 'light';
  const pageBg = isDark ? '#0b0f19' : '#f1f5f9';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const cardBorder = isDark ? '#1f2937' : '#e2e8f0';
  const textPrimary = isDark ? '#f9fafb' : '#0f172a';
  const textSecondary = isDark ? '#9ca3af' : '#475569';
  const textMuted = isDark ? '#6b7280' : '#94a3b8';
  const subcardBg = isDark ? '#030712' : '#f8fafc';
  const subcardBorder = isDark ? '#1f2937' : '#e2e8f0';

  const preheaderHidden = previewText
    ? `<div style="display: none; max-height: 0px; overflow: hidden; font-size: 1px; line-height: 1px; color: ${pageBg}; opacity: 0; mso-hide: all;">
        ${previewText}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
      </div>`
    : '';

  // CTA Button HTML
  let ctaHtml = '';
  if (ctaButton && ctaButton.label && ctaButton.url) {
    const btnBg = ctaButton.color || brandColor || '#4f46e5';
    const btnRadius = ctaButton.radius || '8px';
    ctaHtml = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0 20px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center" style="border-radius: ${btnRadius}; background-color: ${btnBg};">
                  <a href="${ctaButton.url}" target="_blank" style="display: inline-block; padding: 14px 32px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff !important; text-decoration: none; border-radius: ${btnRadius}; border: 1px solid ${btnBg};">
                    ${ctaButton.label} &rarr;
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  // Product Access Delivery Box HTML
  let accessBoxHtml = '';
  if (productAccessBox && productAccessBox.enabled) {
    const itemTitle = productAccessBox.productTitle || '{{productTitle}}';
    const accessLink = productAccessBox.accessLink || '{{productAccessLink}}';
    const accessLabel = productAccessBox.accessLabel || 'Open Your Product Access Link';
    const guideUrl = productAccessBox.setupGuideUrl || '{{setupGuideUrl}}';
    const keyPreview = productAccessBox.licenseKeyPreview || '{{licenseKeyPreview}}';
    const steps = productAccessBox.activationSteps || '{{activationSteps}}';

    accessBoxHtml = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${subcardBg}; border: 1px solid ${subcardBorder}; border-radius: 12px; margin: 24px 0; overflow: hidden;">
        <tr>
          <td style="padding: 20px 24px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%">
              <tr>
                <td style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: ${brandColor};">
                  DIGITAL PRODUCT DELIVERY
                </td>
              </tr>
              <tr>
                <td style="padding-top: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 17px; font-weight: 800; color: ${textPrimary}; line-height: 1.3;">
                  ${itemTitle}
                </td>
              </tr>

              <!-- Primary Access Button -->
              <tr>
                <td style="padding-top: 18px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="center" style="border-radius: 8px; background-color: ${brandColor};">
                        <a href="${accessLink}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; padding: 13px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff !important; text-decoration: none; text-align: center; border-radius: 8px;">
                          🚀 ${accessLabel} &rarr;
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- Setup Guide & Vault Sub-links -->
              <tr>
                <td style="padding-top: 10px;">
                  <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                      <td align="left" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px;">
                        <a href="${guideUrl}" target="_blank" style="color: ${brandColor}; text-decoration: underline; font-weight: 600;">
                          📖 Read Setup & Installation Guide
                        </a>
                      </td>
                      <td align="right" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px;">
                        <a href="{{vaultUrl}}" target="_blank" style="color: ${textSecondary}; text-decoration: none; font-weight: 600;">
                          🔒 Digital Vault
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- License Key Block if requested -->
              ${
                productAccessBox.showLicenseKey
                  ? `
                <tr>
                  <td style="padding-top: 18px;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${isDark ? '#000000' : '#ffffff'}; border: 1px dashed ${isDark ? '#374151' : '#cbd5e1'}; border-radius: 8px;">
                      <tr>
                        <td style="padding: 12px 16px;">
                          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 700; color: ${textMuted}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">
                            License Key Preview (1-Click Copy in Vault):
                          </div>
                          <div style="font-family: 'Courier New', Courier, monospace; font-size: 15px; font-weight: 700; color: #38bdf8; letter-spacing: 1.5px;">
                            ${keyPreview}
                          </div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              `
                  : ''
              }

              <!-- Activation Steps -->
              ${
                steps
                  ? `
                <tr>
                  <td style="padding-top: 18px; border-top: 1px solid ${subcardBorder}; margin-top: 16px;">
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; font-weight: 700; color: ${textPrimary}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
                      Step-by-Step Activation Instructions:
                    </div>
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.6; color: ${textSecondary};">
                      ${steps}
                    </div>
                  </td>
                </tr>
              `
                  : ''
              }
            </table>
          </td>
        </tr>
      </table>
    `;
  }

  // Security Notice Callout HTML
  let securityNoticeHtml = '';
  if (securityNotice) {
    securityNoticeHtml = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${isDark ? 'rgba(99, 102, 241, 0.08)' : '#eef2ff'}; border-left: 4px solid ${brandColor}; border-radius: 8px; margin: 20px 0;">
        <tr>
          <td style="padding: 14px 18px;">
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 700; color: ${brandColor}; margin-bottom: 4px;">
              🔒 End-to-End Vault Security
            </div>
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: ${textSecondary};">
              ${securityNotice}
            </div>
          </td>
        </tr>
      </table>
    `;
  }

  // WhatsApp / Support Link HTML
  let supportLinkHtml = '';
  if (supportLink && supportLink.url) {
    const supUrl = supportLink.url;
    const supLabel = supportLink.label || 'Contact Concierge on WhatsApp';
    supportLinkHtml = `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 16px 0;">
        <tr>
          <td align="center">
            <a href="${supUrl}" target="_blank" style="display: inline-block; padding: 10px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; font-weight: 700; color: #10b981; background-color: ${isDark ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5'}; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; text-decoration: none;">
              💬 ${supLabel} &rarr;
            </a>
          </td>
        </tr>
      </table>
    `;
  }

  // Header Logo or Brand Typography
  const headerHtml =
    headerLogoEnabled && headerLogo
      ? `<img src="${headerLogo}" alt="BundleByte" style="max-height: 38px; width: auto; border: 0;" />`
      : `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; color: ${textPrimary};">
           Bundle<span style="color: ${brandColor};">Byte</span>
         </div>
         <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: ${textMuted}; margin-top: 4px;">
           Enterprise Digital Marketplace
         </div>`;

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="${isDark ? 'dark' : 'light'}" />
  <meta name="supported-color-schemes" content="${isDark ? 'dark' : 'light'}" />
  <title>${subject}</title>
  <style type="text/css">
    /* Universal Resets */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${pageBg}; }

    /* Mobile Responsive Breakpoints */
    @media only screen and (max-width: 600px) {
      .email-container { width: 100% !important; max-width: 100% !important; border-radius: 0px !important; }
      .mobile-padding { padding-left: 18px !important; padding-right: 18px !important; }
      .mobile-btn { width: 100% !important; display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: ${pageBg}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: ${textPrimary};">
  ${preheaderHidden}

  <!-- Outer Email Container -->
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${pageBg};">
    <tr>
      <td align="center" style="padding: 32px 12px;">
        <!--[if (gte mso 9)|(IE)]>
        <table align="center" border="0" cellspacing="0" cellpadding="0" width="600">
        <tr>
        <td align="center" valign="top" width="600">
        <![endif]-->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: ${cardBg}; border: 1px solid ${cardBorder}; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);">
          
          <!-- Header Banner -->
          <tr>
            <td align="center" style="padding: 32px 24px 20px; border-bottom: 1px solid ${cardBorder}; background-color: ${subcardBg};">
              ${headerHtml}
            </td>
          </tr>

          <!-- Main Content Body -->
          <tr>
            <td class="mobile-padding" style="padding: 32px 28px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 15px; line-height: 1.6; color: ${textSecondary};">
              ${
                headline
                  ? `<div style="font-size: 20px; font-weight: 800; color: ${textPrimary}; margin-bottom: 16px; letter-spacing: -0.3px;">${headline}</div>`
                  : ''
              }
              ${
                greeting
                  ? `<p style="margin: 0 0 14px; font-size: 15px; font-weight: 600; color: ${textPrimary};">${greeting}</p>`
                  : ''
              }
              ${bodyContent}
              ${accessBoxHtml}
              ${ctaHtml}
              ${securityNoticeHtml}
              ${supportLinkHtml}
            </td>
          </tr>

          <!-- Footer Section -->
          <tr>
            <td align="center" style="padding: 24px 20px; background-color: ${subcardBg}; border-top: 1px solid ${cardBorder}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.6; color: ${textMuted};">
              <p style="margin: 0 0 8px;">
                ${footerText || `&copy; ${new Date().getFullYear()} BundleByte Marketplace. All rights reserved.`}
              </p>
              <p style="margin: 0; font-size: 11px;">
                Secure Encrypted Delivery &bull; Authenticated Vault Access &bull;
                <a href="{{vaultUrl}}" style="color: ${brandColor}; text-decoration: none;">Manage Notifications</a>
              </p>
            </td>
          </tr>

        </table>
        <!--[if (gte mso 9)|(IE)]>
        </td>
        </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
};

/**
 * Compile template with overrides and mock context
 */
export const compileTemplateWithMock = ({
  template,
  subjectOverride,
  htmlOverride,
  mockContextType = 'jetbrains',
  customVariables = {},
}) => {
  const mockData = {
    ...(MOCK_CONTEXTS[mockContextType] || MOCK_CONTEXTS.jetbrains),
    ...customVariables,
  };

  let subject = subjectOverride || template?.subject || 'Update from BundleByte';
  let html = htmlOverride || template?.htmlBody || '';

  // If the template defines structured visualSections and htmlOverride wasn't raw HTML
  if (template?.visualSections && !htmlOverride) {
    const vs = template.visualSections;
    html = buildCrossClientEmailHtml({
      subject,
      previewText: vs.previewText || template.previewText || '',
      brandColor: vs.brandColor || template.brandColor || '#4f46e5',
      headerLogo: vs.headerLogo || template.headerLogo || '',
      headerLogoEnabled: vs.headerLogoEnabled ?? template.headerLogoEnabled ?? true,
      headline: vs.headline || '',
      greeting: vs.greeting || '',
      bodyContent: vs.bodyContent || '',
      productAccessBox: vs.productAccessBox || null,
      ctaButton: vs.ctaButton || null,
      securityNotice: vs.securityNotice || '',
      supportLink: vs.supportLink || null,
      footerText: vs.footerText || template.footerText || '',
    });
  } else if (!html.includes('<html')) {
    // If raw HTML snippet without shell, wrap in our cross-client table shell
    html = buildCrossClientEmailHtml({
      subject,
      previewText: template?.previewText || '',
      brandColor: template?.brandColor || '#4f46e5',
      headerLogo: template?.headerLogo || '',
      headerLogoEnabled: template?.headerLogoEnabled ?? true,
      bodyContent: html,
      footerText: template?.footerText || '',
    });
  }

  // Interpolate variables
  const compiledSubject = interpolateEmailVariables(subject, mockData);
  const compiledHtml = interpolateEmailVariables(html, mockData);

  return {
    subject: compiledSubject,
    html: compiledHtml,
    mockData,
  };
};

