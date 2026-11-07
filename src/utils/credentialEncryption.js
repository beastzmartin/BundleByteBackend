import crypto from 'crypto';
import { ENV } from '../config/environment.js';

// Derive 32-byte encryption key from JWT_SECRET or fallback
const MASTER_SECRET = process.env.CREDENTIAL_ENCRYPTION_KEY || ENV.JWT_SECRET || 'bundlebyte-super-secure-encryption-key-2026';
const ALGORITHM = 'aes-256-gcm';
const KEY = crypto.createHash('sha256').update(MASTER_SECRET).digest();

/**
 * Encrypt sensitive credential using AES-256-GCM authenticated encryption
 * @param {string} plainText
 * @returns {string} iv:tag:ciphertext
 */
export const encryptCredential = (plainText) => {
  if (!plainText || typeof plainText !== 'string') return '';

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);

  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypt sensitive credential using AES-256-GCM and verify authenticity
 * @param {string} encryptedPayload iv:tag:ciphertext
 * @returns {string} plainText
 */
export const decryptCredential = (encryptedPayload) => {
  if (!encryptedPayload || typeof encryptedPayload !== 'string') return '';

  // If not in encrypted format (e.g. legacy plain text), return as-is
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    return encryptedPayload;
  }

  const [ivHex, tagHex, cipherHex] = parts;

  try {
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(cipherHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Credential decryption/auth verification failed:', error.message);
    return '••••••••••••';
  }
};

/**
 * Mask string for secure API display
 */
export const maskCredential = (str, visibleStart = 2, visibleEnd = 2) => {
  if (!str) return '••••';
  if (str.length <= visibleStart + visibleEnd) return '••••••••';
  const start = str.slice(0, visibleStart);
  const end = str.slice(-visibleEnd);
  return `${start}••••••••${end}`;
};

