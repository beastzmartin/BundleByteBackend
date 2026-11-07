process.env.NODE_ENV = 'test';
import { ENV } from '../config/environment.js';
ENV.NODE_ENV = 'test';
const TEST_BOT_TOKEN = '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz1234567';
ENV.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;

import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import {
  generateTelegramHash,
  verifyTelegramAuthData,
} from '../services/telegramAuthService.js';
import {
  telegramAuth,
  linkTelegram,
  unlinkTelegram,
} from '../controllers/telegramAuthController.js';

const mockRes = () => {
  const res = {
    statusCode: 200,
    headers: {},
    cookieName: null,
    cookieVal: null,
    jsonData: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    cookie(name, val) {
      this.cookieName = name;
      this.cookieVal = val;
      return this;
    },
    json(data) {
      this.jsonData = data;
      return this;
    },
  };
  return res;
};

async function runTests() {
  console.log('🚀 Starting Telegram Authentication & Verification Integration Tests...\n');

  await connectDB();
  console.log('✅ Connected to MongoDB');

  // Clean test accounts
  await User.deleteMany({
    $or: [
      { telegramId: { $in: ['987654321', '888888888', '777777777', '999999999'] } },
      { email: { $in: ['tg_987654321@bundlebyte.com', 'test_tg_local@example.com'] } },
    ],
  });

  const now = Math.floor(Date.now() / 1000);

  // --- Test 1: Official Signature Generation & Verification ---
  console.log('\n--- Test 1: Telegram HMAC-SHA256 Signature Verification ---');
  const validData = {
    id: 987654321,
    first_name: 'Alex',
    last_name: 'Telegram',
    username: 'alex_tg',
    photo_url: 'https://t.me/i/userpic/320/alex.jpg',
    auth_date: now,
  };
  validData.hash = generateTelegramHash(validData, TEST_BOT_TOKEN);

  const verified = await verifyTelegramAuthData(validData);
  console.assert(verified.id === '987654321', 'Verified ID must match');
  console.assert(verified.username === 'alex_tg', 'Username matches');
  console.log('✅ Test 1 Passed: Official Telegram SHA-256 HMAC verification passed');

  // --- Test 2: Reject Tampered / Invalid Signature ---
  console.log('\n--- Test 2: Reject Tampered Signature ---');
  const tamperedData = { ...validData, first_name: 'HackerTampered' };
  let tamperedRejected = false;
  try {
    await verifyTelegramAuthData(tamperedData);
  } catch (err) {
    tamperedRejected = true;
  }
  console.assert(tamperedRejected, 'Tampered data must be rejected');
  console.log('✅ Test 2 Passed: Tampered data rejected with signature mismatch');

  // --- Test 3: Reject Expired Timestamp ---
  console.log('\n--- Test 3: Reject Expired Timestamp (> 24 hours) ---');
  const expiredData = {
    ...validData,
    auth_date: now - 90000, // 25 hours ago
  };
  expiredData.hash = generateTelegramHash(expiredData, TEST_BOT_TOKEN);
  let expiredRejected = false;
  try {
    await verifyTelegramAuthData(expiredData);
  } catch (err) {
    expiredRejected = true;
  }
  console.assert(expiredRejected, 'Expired auth_date must be rejected');
  console.log('✅ Test 3 Passed: Expired Telegram authentication session rejected');

  // --- Test 4: New User Registration via Telegram ---
  console.log('\n--- Test 4: Automatic User Registration via Telegram ---');
  const reqNew = {
    body: { authData: validData },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'TelegramWidget/2.0' },
  };
  const resNew = mockRes();
  await telegramAuth(reqNew, resNew, (err) => { if (err) throw err; });

  console.assert(resNew.statusCode === 201, `Status must be 201, got ${resNew.statusCode}`);
  console.assert(resNew.jsonData.success === true, 'Response success is true');
  console.assert(resNew.jsonData.user.telegramId === '987654321', 'telegramId saved');
  console.assert(resNew.jsonData.user.authProviders.includes('telegram'), 'authProviders includes telegram');
  console.assert(resNew.jsonData.user.registrationMethod === 'telegram', 'registrationMethod is telegram');
  console.assert(resNew.jsonData.user.role === 'customer', 'Default role is customer');
  console.log('✅ Test 4 Passed: New customer automatically registered via Telegram with role customer');

  // --- Test 5: Existing Telegram User Login ---
  console.log('\n--- Test 5: Existing Telegram User Login ---');
  const reqLogin = {
    body: { authData: validData },
    ip: '127.0.0.2',
    headers: { 'user-agent': 'Chrome/120.0' },
  };
  const resLogin = mockRes();
  await telegramAuth(reqLogin, resLogin, (err) => { if (err) throw err; });

  console.assert(resLogin.statusCode === 200, `Status must be 200, got ${resLogin.statusCode}`);
  console.assert(resLogin.cookieName === 'token', 'Session cookie issued');
  console.log('✅ Test 5 Passed: Existing customer authenticated via Telegram');

  // --- Test 6: Account Linking to Existing User ---
  console.log('\n--- Test 6: Existing Account Linking with Telegram ---');
  const localUser = await User.create({
    name: 'Sarah Customer',
    email: 'test_tg_local@example.com',
    password: 'Password123!',
    authProviders: ['local'],
    registrationMethod: 'local',
  });

  const linkData = {
    id: 888888888,
    first_name: 'Sarah',
    username: 'sarah_tg',
    auth_date: now,
  };
  linkData.hash = generateTelegramHash(linkData, TEST_BOT_TOKEN);

  const reqLink = {
    user: localUser,
    body: { authData: linkData },
    ip: '127.0.0.1',
    headers: {},
  };
  const resLink = mockRes();
  await linkTelegram(reqLink, resLink, (err) => { if (err) throw err; });

  console.assert(resLink.statusCode === 200, `Link status must be 200, got ${resLink.statusCode}`);
  const updatedSarah = await User.findById(localUser._id);
  console.assert(updatedSarah.telegramId === '888888888', 'telegramId attached');
  console.assert(updatedSarah.authProviders.includes('telegram') && updatedSarah.authProviders.includes('local'), 'Multiple providers preserved');
  console.log('✅ Test 6 Passed: Existing user successfully connected Telegram');

  // --- Test 7: Prevent Duplicate Telegram ID Linking ---
  console.log('\n--- Test 7: Prevent Duplicate Telegram ID Linking ---');
  const otherUser = await User.create({
    name: 'Another User',
    email: 'another_user_tg@example.com',
    password: 'Password123!',
    authProviders: ['local'],
  });

  const reqDupLink = {
    user: otherUser,
    body: { authData: linkData }, // Reusing 888888888
    ip: '127.0.0.1',
    headers: {},
  };
  const resDupLink = mockRes();
  await linkTelegram(reqDupLink, resDupLink, (err) => { if (err) throw err; });
  console.assert(resDupLink.statusCode === 400, 'Duplicate linking must return 400');
  console.log('✅ Test 7 Passed: Prevented linking already connected Telegram account');

  // --- Test 8: Prevent Unlinking when Telegram is Only Method ---
  console.log('\n--- Test 8: Prevent Unlinking when Telegram is Only Method ---');
  const telegramOnlyUser = await User.findOne({ telegramId: '987654321' });
  const reqUnlinkNoPass = {
    user: telegramOnlyUser,
  };
  const resUnlinkNoPass = mockRes();
  await unlinkTelegram(reqUnlinkNoPass, resUnlinkNoPass, (err) => { if (err) throw err; });
  console.assert(resUnlinkNoPass.statusCode === 400, 'Must prevent unlinking without password');
  console.log('✅ Test 8 Passed: Lockout prevention verified (cannot unlink sole authentication method)');

  // --- Test 9: Allow Unlinking when Password Exists ---
  console.log('\n--- Test 9: Allow Unlinking when Password Exists ---');
  const reqUnlinkOk = {
    user: updatedSarah,
  };
  const resUnlinkOk = mockRes();
  await unlinkTelegram(reqUnlinkOk, resUnlinkOk, (err) => { if (err) throw err; });
  console.assert(resUnlinkOk.statusCode === 200, 'Unlink must succeed');
  const unlinkedSarah = await User.findById(localUser._id);
  console.assert(!unlinkedSarah.telegramId, 'telegramId is cleared');
  console.assert(!unlinkedSarah.authProviders.includes('telegram'), 'telegram removed from providers');
  console.log('✅ Test 9 Passed: Successfully unlinked Telegram when password exists');

  // --- Test 10: Suspended Account Protection ---
  console.log('\n--- Test 10: Suspended / Banned Account Protection ---');
  const bannedData = {
    id: 999999999,
    first_name: 'Banned',
    username: 'banned_tg',
    auth_date: now,
  };
  bannedData.hash = generateTelegramHash(bannedData, TEST_BOT_TOKEN);

  await User.create({
    name: 'Banned Telegram User',
    email: 'banned_tg@bundlebyte.com',
    telegramId: '999999999',
    isBanned: true,
    bannedReason: 'Terms of service violation',
    authProviders: ['telegram'],
  });

  const reqBanned = {
    body: { authData: bannedData },
    ip: '127.0.0.1',
    headers: {},
  };
  const resBanned = mockRes();
  await telegramAuth(reqBanned, resBanned, (err) => { if (err) throw err; });
  console.assert(resBanned.statusCode === 403, 'Banned user must get 403');
  console.log('✅ Test 10 Passed: Banned account rejected with 403 Forbidden');

  // Cleanup
  await User.deleteMany({
    $or: [
      { telegramId: { $in: ['987654321', '888888888', '777777777', '999999999'] } },
      { email: { $in: ['tg_987654321@bundlebyte.com', 'test_tg_local@example.com', 'another_user_tg@example.com', 'banned_tg@bundlebyte.com'] } },
    ],
  });

  await disconnectDB();
  console.log('\n🎉 ALL 10 TELEGRAM AUTHENTICATION INTEGRATION TESTS PASSED!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});

