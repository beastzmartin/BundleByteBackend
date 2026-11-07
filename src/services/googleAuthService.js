import { OAuth2Client } from 'google-auth-library';
import { ENV } from '../config/environment.js';
import WebsiteSetting from '../models/WebsiteSetting.js';

let cachedClient = null;
let cachedClientId = null;

/**
 * Retrieve the active Google Client ID from environment or settings
 */
export const getGoogleClientId = async () => {
  if (ENV.GOOGLE_CLIENT_ID && ENV.GOOGLE_CLIENT_ID.trim()) {
    return ENV.GOOGLE_CLIENT_ID.trim();
  }

  try {
    const setting = await WebsiteSetting.findOne();
    if (setting?.authConfig?.google?.clientId?.trim()) {
      return setting.authConfig.google.clientId.trim();
    }
  } catch (err) {
    console.error('Error fetching Google Client ID from database:', err.message);
  }

  return '';
};

/**
 * Get or initialize the OAuth2Client instance
 */
const getOAuthClient = async () => {
  const currentClientId = await getGoogleClientId();
  if (!cachedClient || cachedClientId !== currentClientId) {
    cachedClientId = currentClientId;
    cachedClient = new OAuth2Client(currentClientId || undefined);
  }
  return { client: cachedClient, clientId: cachedClientId };
};

/**
 * Verify a Google ID token server-side
 * Validates issuer, audience, expiry, and signature
 *
 * @param {string} idToken Google ID token from frontend
 * @returns {Promise<{ sub: string, email: string, name: string, picture: string, email_verified: boolean }>}
 */
export const verifyGoogleIdToken = async (idToken) => {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('Google ID token is required');
  }

  const trimmedToken = idToken.trim();

  // Allow synthetic tokens only during automated unit/integration test suites
  if (trimmedToken.startsWith('mock-google-token:')) {
    if (ENV.NODE_ENV !== 'test') {
      throw new Error('Test tokens are disabled. Genuine Google ID token required.');
    }
    try {
      const rawJson = Buffer.from(trimmedToken.replace('mock-google-token:', ''), 'base64').toString('utf-8');
      const mockPayload = JSON.parse(rawJson);
      if (!mockPayload.sub || !mockPayload.email) {
        throw new Error('Invalid mock Google token payload');
      }
      return {
        sub: String(mockPayload.sub),
        email: String(mockPayload.email).toLowerCase(),
        name: mockPayload.name || 'Google User',
        picture: mockPayload.picture || '',
        email_verified: mockPayload.email_verified !== false,
      };
    } catch (err) {
      throw new Error(`Mock token decoding failed: ${err.message}`);
    }
  }

  const { client, clientId } = await getOAuthClient();

  const verifyOptions = {
    idToken: trimmedToken,
  };

  if (clientId) {
    verifyOptions.audience = clientId;
  }

  try {
    const ticket = await client.verifyIdToken(verifyOptions);
    const payload = ticket.getPayload();

    if (!payload) {
      throw new Error('Unable to extract payload from Google ID token');
    }

    // Issuer verification
    const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
    if (!validIssuers.includes(payload.iss)) {
      throw new Error(`Invalid Google token issuer: ${payload.iss}`);
    }

    // Expiry check
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throw new Error('Google token has expired');
    }

    // Required fields check
    if (!payload.sub) {
      throw new Error('Google token missing unique user ID (sub)');
    }

    if (!payload.email) {
      throw new Error('Google token missing email address');
    }

    return {
      sub: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name || payload.given_name || 'Google User',
      picture: payload.picture || '',
      email_verified: Boolean(payload.email_verified),
    };
  } catch (error) {
    throw new Error(`Google token verification failed: ${error.message}`);
  }
};

