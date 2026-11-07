import WebsiteSetting from '../models/WebsiteSetting.js';
import { logAudit } from '../middleware/audit.js';
import { encryptCredential } from '../utils/credentialEncryption.js';

export const getSettings = async (req, res, next) => {
  try {
    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = await WebsiteSetting.create({});
    }

    // Sanitize sensitive credentials before returning to client (Requirement 1 & 4)
    const safeSettings = settings.toObject();
    if (safeSettings.gateways?.binance) {
      const b = safeSettings.gateways.binance;
      safeSettings.gateways.binance = {
        ...b,
        hasApiSecret: !!b.apiSecret,
        hasApiKey: !!b.apiKey,
        apiSecret: b.apiSecret ? '••••••••••••••••' : '',
        apiKeyMasked: b.apiKey ? `${b.apiKey.slice(0, 6)}••••••••` : '',
      };
    }

    if (safeSettings.authConfig?.telegram) {
      const tg = safeSettings.authConfig.telegram;
      safeSettings.authConfig.telegram = {
        ...tg,
        hasBotToken: !!tg.botToken,
        botToken: tg.botToken ? '••••••••••••••••••••••••' : '',
      };
    }

    res.status(200).json({ success: true, settings: safeSettings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    let settings = await WebsiteSetting.findOne();
    if (!settings) {
      settings = await WebsiteSetting.create({});
    }

    const updateData = { ...req.body };

    // Encrypt sensitive Binance credentials at rest if updated
    if (updateData.gateways?.binance) {
      const b = updateData.gateways.binance;
      if (b.apiSecret && !b.apiSecret.includes('••••')) {
        b.apiSecret = encryptCredential(b.apiSecret.trim());
      } else if (b.apiSecret && b.apiSecret.includes('••••')) {
        // Keep existing encrypted secret
        b.apiSecret = settings.gateways?.binance?.apiSecret || '';
      }

      if (b.apiKey && !b.apiKey.includes('••••')) {
        b.apiKey = encryptCredential(b.apiKey.trim());
      } else if (b.apiKey && b.apiKey.includes('••••')) {
        b.apiKey = settings.gateways?.binance?.apiKey || '';
      }
    }

    // Preserve existing Telegram bot token if sent as mask
    if (updateData.authConfig?.telegram?.botToken) {
      if (updateData.authConfig.telegram.botToken.includes('••••')) {
        updateData.authConfig.telegram.botToken = settings.authConfig?.telegram?.botToken || '';
      }
    }

    Object.assign(settings, updateData);
    settings.markModified('gateways');
    if (updateData.authConfig) {
      settings.markModified('authConfig');
    }
    await settings.save();

    await logAudit({
      actor: req.user._id,
      actorEmail: req.user.email,
      actorRole: req.user.role,
      action: 'SETTINGS_UPDATED',
      entity: 'WebsiteSetting',
      entityId: settings._id.toString(),
      details: req.body,
      req,
    });

    const safeSettings = settings.toObject();
    if (safeSettings.gateways?.binance) {
      safeSettings.gateways.binance.apiSecret = safeSettings.gateways.binance.apiSecret ? '••••••••••••••••' : '';
    }
    if (safeSettings.authConfig?.telegram) {
      safeSettings.authConfig.telegram.botToken = safeSettings.authConfig.telegram.botToken ? '••••••••••••••••••••••••' : '';
    }

    res.status(200).json({ success: true, message: 'Settings updated successfully', settings: safeSettings });
  } catch (error) {
    next(error);
  }
};


