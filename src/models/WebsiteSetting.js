import mongoose from 'mongoose';

const websiteSettingSchema = new mongoose.Schema(
  {
    siteName: {
      type: String,
      default: 'BundleByte',
    },
    siteTagline: {
      type: String,
      default: 'Premium Software Subscriptions & Digital Licenses',
    },
    supportEmail: {
      type: String,
      default: 'support@bundlebyte.com',
    },
    announcement: {
      enabled: { type: Boolean, default: true },
      text: { type: String, default: '🚀 Flash Sale: Use code WELCOME20 for 20% off all software subscriptions & digital licenses!' },
      link: { type: String, default: '/products' },
      badge: { type: String, default: 'LIMITED OFFER' },
    },
    taxRatePercent: {
      type: Number,
      default: 0, // e.g. 0% for international digital goods by default, configurable
    },
    currency: {
      type: String,
      default: 'USD',
    },
    gateways: {
      mock: { enabled: { type: Boolean, default: false }, name: { type: String, default: 'Instant Test Checkout (Mock)' } },
      stripe: { enabled: { type: Boolean, default: true }, publishableKey: { type: String, default: '' } },
      paypal: { enabled: { type: Boolean, default: false }, clientId: { type: String, default: '' } },
      binance: {
        enabled: { type: Boolean, default: true },
        name: { type: String, default: 'Binance USDT (TRC20 / BEP20)' },
        apiKey: { type: String, default: '' },
        apiSecret: { type: String, default: '' },
        depositAddress: { type: String, default: 'TLR7Vw3G1uK4K4U5w6q7N9x8yZ2A1B3C4D' },
        network: { type: String, default: 'TRX' },
        autoVerifyEnabled: { type: Boolean, default: true },
        minDepositUsdt: { type: Number, default: 1 },
        usdtToUsdRate: { type: Number, default: 1.0 },
        usdtToInrRate: { type: Number, default: 86.5 },
      },
      upi: {
        enabled: { type: Boolean, default: true },
        name: { type: String, default: 'UPI / QR Code Transfer' },
        vpa: { type: String, default: 'bundlebyte@upi' },
        upiId: { type: String, default: 'bundlebyte@upi' },
        merchantName: { type: String, default: 'BundleByte Technologies' },
        qrCodeUrl: { type: String, default: '' },
        autoApproveTrusted: { type: Boolean, default: true },
      },
      paytm: {
        enabled: { type: Boolean, default: true },
        name: { type: String, default: 'Paytm Merchant Dynamic QR' },
        defaultMid: { type: String, default: '' },
        autoVerifyEnabled: { type: Boolean, default: true },
        pollingIntervalSeconds: { type: Number, default: 2 },
        timeoutMinutes: { type: Number, default: 5 },
      },
    },
    emailConfig: {
      provider: { type: String, enum: ['smtp', 'resend', 'simulation'], default: 'smtp' },
      fromName: { type: String, default: 'BundleByte' },
      fromEmail: { type: String, default: 'support@bundlebyte.com' },
      smtp: {
        host: { type: String, default: '' },
        port: { type: Number, default: 587 },
        user: { type: String, default: '' },
        pass: { type: String, default: '' },
        secure: { type: Boolean, default: false },
      },
      resend: {
        apiKey: { type: String, default: '' },
      },
    },
    authConfig: {
      google: {
        enabled: { type: Boolean, default: true },
        clientId: { type: String, default: '' },
      },
      telegram: {
        enabled: { type: Boolean, default: true },
        botUsername: { type: String, default: '' },
        botToken: { type: String, default: '' },
      },
    },
    invoiceConfig: {
      companyName: { type: String, default: 'BundleByte Technologies Pvt Ltd' },
      businessAddress: { type: String, default: '100 Innovation Boulevard, Tech Park, Bangalore 560001' },
      supportEmail: { type: String, default: 'billing@bundlebyte.com' },
      supportPhone: { type: String, default: '+91 80 4000 1234' },
      gstin: { type: String, default: '29ABCDE1234F1Z5' },
      websiteUrl: { type: String, default: 'https://bundlebyte.com' },
      invoiceTitle: { type: String, default: 'TAX INVOICE' },
      invoicePrefix: { type: String, default: 'INV' },
      accentColor: { type: String, default: '#4f46e5' },
      secondaryColor: { type: String, default: '#0f172a' },
      logoUrl: { type: String, default: '' },
      showLogo: { type: Boolean, default: true },
      showAccessLinks: { type: Boolean, default: true },
      accessButtonLabel: { type: String, default: 'Access Product & Vault' },
      showLicenseKeyPreview: { type: Boolean, default: true },
      showHsnSac: { type: Boolean, default: true },
      showGstBreakdown: { type: Boolean, default: true },
      defaultPlaceOfSupply: { type: String, default: 'Karnataka (29)' },
      termsText: {
        type: String,
        default: '1. Genuine perpetual licenses and account credentials reside in your encrypted customer vault.\n2. Sale is subject to standard terms of service & 14-day replacement warranty.\n3. This is a computer-generated tax invoice and requires no physical signature.',
      },
      footerNote: {
        type: String,
        default: 'Official tax receipt for verified digital software licenses. Registered in accordance with online merchant standards.',
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('WebsiteSetting', websiteSettingSchema);

