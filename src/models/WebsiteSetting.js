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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('WebsiteSetting', websiteSettingSchema);

