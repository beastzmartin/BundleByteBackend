import nodemailer from 'nodemailer';
import EmailProvider from '../models/EmailProvider.js';
import { encryptCredential, decryptCredential, maskCredential } from '../utils/credentialEncryption.js';

/**
 * Seed default providers if none exist
 */
export const ensureDefaultEmailProviders = async () => {
  const count = await EmailProvider.countDocuments();
  if (count === 0) {
    await EmailProvider.create([
      {
        name: 'Default SMTP Gateway',
        providerType: 'smtp',
        priority: 1,
        isActive: true,
        isPrimary: true,
        isFallback: false,
        senderName: 'BundleByte Support',
        senderEmail: 'support@bundlebyte.com',
        replyToEmail: 'support@bundlebyte.com',
        smtpConfig: {
          host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
          port: Number(process.env.SMTP_PORT) || 587,
          username: process.env.SMTP_USER || '',
          encryptedPassword: process.env.SMTP_PASS ? encryptCredential(process.env.SMTP_PASS) : '',
          encryptionMode: 'tls',
        },
        stats: { healthStatus: 'untested' },
      },
      {
        name: 'Resend API Gateway',
        providerType: 'resend',
        priority: 2,
        isActive: false,
        isPrimary: false,
        isFallback: true,
        senderName: 'BundleByte Dispatch',
        senderEmail: 'notifications@bundlebyte.com',
        replyToEmail: 'support@bundlebyte.com',
        resendConfig: {
          encryptedApiKey: process.env.RESEND_API_KEY ? encryptCredential(process.env.RESEND_API_KEY) : '',
        },
        stats: { healthStatus: 'untested' },
      },
    ]);
  }
};

/**
 * Returns all providers with encrypted credentials safely masked
 */
export const getAllProvidersSanitized = async () => {
  await ensureDefaultEmailProviders();
  const providers = await EmailProvider.find().sort({ priority: 1 });

  return providers.map((p) => {
    const obj = p.toObject();
    if (obj.smtpConfig?.encryptedPassword) {
      obj.smtpConfig.hasPassword = true;
      obj.smtpConfig.passwordMasked = maskCredential(decryptCredential(obj.smtpConfig.encryptedPassword));
      delete obj.smtpConfig.encryptedPassword;
    } else {
      if (obj.smtpConfig) obj.smtpConfig.hasPassword = false;
    }

    if (obj.resendConfig?.encryptedApiKey) {
      obj.resendConfig.hasApiKey = true;
      obj.resendConfig.apiKeyMasked = maskCredential(decryptCredential(obj.resendConfig.encryptedApiKey));
      delete obj.resendConfig.encryptedApiKey;
    } else {
      if (obj.resendConfig) obj.resendConfig.hasApiKey = false;
    }

    return obj;
  });
};

/**
 * Tests connection to an email provider
 */
export const testProviderConnectivity = async (providerId) => {
  const provider = await EmailProvider.findById(providerId);
  if (!provider) throw new Error('Provider not found');

  const startTime = Date.now();

  try {
    if (provider.providerType === 'smtp') {
      const cfg = provider.smtpConfig || {};
      const rawPassword = decryptCredential(cfg.encryptedPassword);

      if (!cfg.host || !cfg.username) {
        throw new Error('SMTP host and username are required for connection test.');
      }

      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.encryptionMode === 'ssl',
        auth: {
          user: cfg.username,
          pass: rawPassword,
        },
        connectionTimeout: 8000,
      });

      await transporter.verify();

      provider.stats.healthStatus = 'healthy';
      provider.stats.lastPingAt = new Date();
      provider.stats.lastError = '';
      await provider.save();

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: `Successfully connected to SMTP server ${cfg.host}:${cfg.port}`,
      };
    } else if (provider.providerType === 'resend') {
      const rawKey = decryptCredential(provider.resendConfig?.encryptedApiKey);
      if (!rawKey) throw new Error('Resend API key is missing.');

      const response = await fetch('https://api.resend.com/api-keys', {
        headers: { Authorization: `Bearer ${rawKey}` },
      });

      if (!response.ok) {
        throw new Error(`Resend verification failed with status: ${response.status}`);
      }

      provider.stats.healthStatus = 'healthy';
      provider.stats.lastPingAt = new Date();
      provider.stats.lastError = '';
      await provider.save();

      return {
        success: true,
        latencyMs: Date.now() - startTime,
        message: 'Resend API authentication verified successfully.',
      };
    } else {
      // Simulation mode
      return { success: true, latencyMs: 5, message: 'Simulation gateway ready.' };
    }
  } catch (err) {
    provider.stats.healthStatus = 'offline';
    provider.stats.lastPingAt = new Date();
    provider.stats.lastError = err.message;
    await provider.save();

    return {
      success: false,
      error: err.message,
      message: `Provider health check failed: ${err.message}`,
    };
  }
};
