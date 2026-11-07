import crypto from 'crypto';
import { ENV } from '../config/environment.js';
import WebsiteSetting from '../models/WebsiteSetting.js';

/**
 * Retrieve the active Telegram Bot Token from environment or database settings
 */
export const getTelegramBotToken = async () => {
  if (ENV.TELEGRAM_BOT_TOKEN && ENV.TELEGRAM_BOT_TOKEN.trim()) {
    return ENV.TELEGRAM_BOT_TOKEN.trim();
  }

  try {
    const setting = await WebsiteSetting.findOne();
    if (setting?.authConfig?.telegram?.botToken?.trim()) {
      return setting.authConfig.telegram.botToken.trim();
    }
  } catch (err) {
    console.error('Error fetching Telegram Bot Token from database:', err.message);
  }

  return '';
};

/**
 * Retrieve the active Telegram Bot Username
 */
export const getTelegramBotUsername = async () => {
  if (ENV.TELEGRAM_BOT_USERNAME && ENV.TELEGRAM_BOT_USERNAME.trim()) {
    return ENV.TELEGRAM_BOT_USERNAME.trim();
  }

  try {
    const setting = await WebsiteSetting.findOne();
    if (setting?.authConfig?.telegram?.botUsername?.trim()) {
      return setting.authConfig.telegram.botUsername.trim();
    }
  } catch (err) {
    console.error('Error fetching Telegram Bot Username from database:', err.message);
  }

  return '';
};

/**
 * Generate official Telegram hash for testing/signing
 * @param {object} data Payload excluding hash
 * @param {string} botToken Telegram Bot Token
 */
export const generateTelegramHash = (data, botToken) => {
  const secretKey = crypto.createHash('sha256').update(botToken.trim()).digest();
  const dataCheckString = Object.keys(data)
    .filter((key) => key !== 'hash' && data[key] !== undefined && data[key] !== null)
    .sort()
    .map((key) => `${key}=${data[key]}`)
    .join('\n');

  return crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
};

/**
 * Verify Telegram authentication data using official Telegram HMAC-SHA256 algorithm
 * @param {object} authData The object received from Telegram Login Widget
 * @param {number} maxAgeSeconds Maximum acceptable age in seconds (default: 86400 / 24 hours)
 * @returns {Promise<{ id: string, firstName: string, lastName: string, username: string, photoUrl: string, authDate: Date }>}
 */
export const verifyTelegramAuthData = async (authData, maxAgeSeconds = 86400) => {
  if (!authData || typeof authData !== 'object') {
    throw new Error('Telegram authentication data is required');
  }

  const { hash, id, auth_date } = authData;

  if (!hash || typeof hash !== 'string') {
    throw new Error('Telegram authentication hash is missing');
  }

  if (!id) {
    throw new Error('Telegram user ID is missing');
  }

  if (!auth_date) {
    throw new Error('Telegram auth_date timestamp is missing');
  }

  // 1. Verify Timestamp & Expiration
  const authTimestamp = parseInt(auth_date, 10);
  if (isNaN(authTimestamp) || authTimestamp <= 0) {
    throw new Error('Invalid Telegram auth_date timestamp');
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const timeDifference = currentTimestamp - authTimestamp;

  if (timeDifference > maxAgeSeconds) {
    throw new Error('Telegram authentication session has expired. Please sign in again.');
  }

  // Allow up to 120 seconds of clock drift for future timestamps
  if (authTimestamp > currentTimestamp + 120) {
    throw new Error('Telegram authentication timestamp is invalid (in the future).');
  }

  // 2. Retrieve Bot Token
  const botToken = await getTelegramBotToken();
  if (!botToken) {
    throw new Error('Telegram authentication is not configured on the server (missing bot token).');
  }

  // 3. Construct Data Check String (sorted alphabetically, excluding hash)
  const dataCheckString = Object.keys(authData)
    .filter((key) => key !== 'hash' && authData[key] !== undefined && authData[key] !== null)
    .sort()
    .map((key) => `${key}=${authData[key]}`)
    .join('\n');

  // 4. Calculate HMAC-SHA256 using SHA256(botToken) as secret
  const secretKey = crypto.createHash('sha256').update(botToken).digest();
  const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  // 5. Constant-time comparison to prevent timing attacks
  const hashBuffer = Buffer.from(hash.toLowerCase(), 'utf-8');
  const calculatedBuffer = Buffer.from(calculatedHash.toLowerCase(), 'utf-8');

  if (hashBuffer.length !== calculatedBuffer.length || !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
    throw new Error('Invalid Telegram authentication signature. Data verification failed.');
  }

  return {
    id: String(id),
    firstName: authData.first_name || '',
    lastName: authData.last_name || '',
    username: authData.username || '',
    photoUrl: authData.photo_url || '',
    authDate: new Date(authTimestamp * 1000),
  };
};

