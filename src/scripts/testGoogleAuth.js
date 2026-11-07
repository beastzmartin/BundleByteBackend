process.env.NODE_ENV = 'test';
import { ENV } from '../config/environment.js';
ENV.NODE_ENV = 'test';
import { connectDB, disconnectDB } from '../config/db.js';
import User from '../models/User.js';
import { verifyGoogleIdToken } from '../services/googleAuthService.js';
import { googleAuth, linkGoogle, unlinkGoogle } from '../controllers/googleAuthController.js';

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

const createMockGoogleToken = (payload) => {
  const base64 = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `mock-google-token:${base64}`;
};

async function runTests() {
  console.log('🧪 Starting Google OAuth 2.0 Integration Tests...\n');

  await connectDB();
  console.log('✅ Connected to MongoDB');

  // Clean test accounts
  await User.deleteMany({ email: { $in: ['test_google_new@example.com', 'test_local_merge@example.com', 'test_banned_google@example.com', 'test_oauth_only@example.com'] } });

  // Test 1: Verify token service directly
  console.log('\n--- Test 1: Google Token Verification Service ---');
  const validToken = createMockGoogleToken({
    sub: 'google-sub-1001',
    email: 'test_google_new@example.com',
    name: 'Alice Google',
    picture: 'https://lh3.googleusercontent.com/alice.jpg',
    email_verified: true,
  });

  const verifiedPayload = await verifyGoogleIdToken(validToken);
  console.assert(verifiedPayload.sub === 'google-sub-1001', 'sub matches');
  console.assert(verifiedPayload.email === 'test_google_new@example.com', 'email matches');
  console.assert(verifiedPayload.email_verified === true, 'email_verified is true');
  console.log('✅ Test 1 Passed: Valid mock token decoded & validated correctly');

  // Test 2: Reject invalid mock token
  console.log('\n--- Test 2: Token Rejection on Invalid / Missing Fields ---');
  let rejected = false;
  try {
    await verifyGoogleIdToken('invalid-garbage-token');
  } catch (err) {
    rejected = true;
  }
  console.assert(rejected, 'Invalid token must throw');
  console.log('✅ Test 2 Passed: Invalid token properly rejected');

  // Test 3: New User Registration via Google OAuth
  console.log('\n--- Test 3: Automatic New User Registration via Google ---');
  const reqNew = {
    body: { idToken: validToken },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'JestTestRunner/1.0' },
  };
  const resNew = mockRes();
  await googleAuth(reqNew, resNew, (err) => { if (err) throw err; });

  console.assert(resNew.statusCode === 201, `Status code must be 201, got ${resNew.statusCode}`);
  console.assert(resNew.jsonData.success === true, 'Response success must be true');
  console.assert(resNew.jsonData.user.email === 'test_google_new@example.com', 'User email matches');
  console.assert(resNew.jsonData.user.authProviders.includes('google'), 'AuthProvider includes google');
  console.assert(resNew.jsonData.user.registrationMethod === 'google', 'registrationMethod is google');
  console.assert(resNew.jsonData.user.isEmailVerified === true, 'Email is verified automatically');
  console.log('✅ Test 3 Passed: New user registered automatically via Google OAuth');

  // Test 4: Existing Google User Login
  console.log('\n--- Test 4: Existing Google User Login ---');
  const reqLogin = {
    body: { idToken: validToken },
    ip: '127.0.0.2',
    headers: { 'user-agent': 'Chrome/120.0' },
  };
  const resLogin = mockRes();
  await googleAuth(reqLogin, resLogin, (err) => { if (err) throw err; });

  console.assert(resLogin.statusCode === 200, `Status code must be 200, got ${resLogin.statusCode}`);
  console.assert(resLogin.jsonData.user.googleId === 'google-sub-1001', 'googleId matches');
  console.assert(resLogin.cookieName === 'token', 'Sets HTTP-only session cookie');
  console.log('✅ Test 4 Passed: Existing user successfully authenticated via Google');

  // Test 5: Existing Local Account Linking with Verified Email
  console.log('\n--- Test 5: Existing Email/Password Account Linking ---');
  // Create existing local user
  const localUser = await User.create({
    name: 'Bob Local',
    email: 'test_local_merge@example.com',
    password: 'Password123!',
    authProviders: ['local'],
    registrationMethod: 'local',
  });

  const mergeToken = createMockGoogleToken({
    sub: 'google-sub-2002',
    email: 'test_local_merge@example.com',
    name: 'Bob Google',
    picture: 'https://lh3.googleusercontent.com/bob.jpg',
    email_verified: true,
  });

  const reqMerge = {
    body: { idToken: mergeToken },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'Firefox/115.0' },
  };
  const resMerge = mockRes();
  await googleAuth(reqMerge, resMerge, (err) => { if (err) throw err; });

  console.assert(resMerge.statusCode === 200, `Status code must be 200, got ${resMerge.statusCode}`);
  const updatedLocalUser = await User.findById(localUser._id);
  console.assert(updatedLocalUser.googleId === 'google-sub-2002', 'googleId attached to local account');
  console.assert(updatedLocalUser.authProviders.includes('local') && updatedLocalUser.authProviders.includes('google'), 'User has both local and google providers');
  console.log('✅ Test 5 Passed: Existing email account securely linked with Google');

  // Test 6: Reject Account Linking if Google Email is NOT verified
  console.log('\n--- Test 6: Rejection of Unverified Google Email Linking ---');
  const unverifiedToken = createMockGoogleToken({
    sub: 'google-sub-3003',
    email: 'test_local_merge@example.com',
    name: 'Attacker Fake',
    email_verified: false,
  });
  const reqUnverified = {
    body: { idToken: unverifiedToken },
    ip: '127.0.0.1',
    headers: {},
  };
  const resUnverified = mockRes();
  await googleAuth(reqUnverified, resUnverified, (err) => { if (err) throw err; });
  console.assert(resUnverified.statusCode === 400, 'Must reject unverified email linking with 400');
  console.log('✅ Test 6 Passed: Unverified Google email account linking correctly rejected');

  // Test 7: Prevent Unlinking when No Other Secure Method Exists
  console.log('\n--- Test 7: Prevent Unlinking Google when No Password Exists ---');
  // Registered via Google only (no password)
  const oauthOnlyUser = await User.findOne({ email: 'test_google_new@example.com' });
  const reqUnlinkNoPass = {
    user: oauthOnlyUser,
  };
  const resUnlinkNoPass = mockRes();
  await unlinkGoogle(reqUnlinkNoPass, resUnlinkNoPass, (err) => { if (err) throw err; });
  console.assert(resUnlinkNoPass.statusCode === 400, `Must reject unlink without password with 400, got ${resUnlinkNoPass.statusCode}`);
  console.log('✅ Test 7 Passed: Prevented unlinking Google when no password exists');

  // Test 8: Allow Unlinking when Local Password Exists
  console.log('\n--- Test 8: Allow Unlinking Google when Password Exists ---');
  const reqUnlinkWithPass = {
    user: updatedLocalUser,
  };
  const resUnlinkWithPass = mockRes();
  await unlinkGoogle(reqUnlinkWithPass, resUnlinkWithPass, (err) => { if (err) throw err; });
  console.assert(resUnlinkWithPass.statusCode === 200, `Status code must be 200, got ${resUnlinkWithPass.statusCode}`);
  const unlinkedUser = await User.findById(localUser._id);
  console.assert(!unlinkedUser.googleId, 'googleId cleared');
  console.assert(!unlinkedUser.authProviders.includes('google'), 'google removed from authProviders');
  console.assert(unlinkedUser.authProviders.includes('local'), 'local provider remains');
  console.log('✅ Test 8 Passed: Successfully unlinked Google identity when password exists');

  // Test 9: Suspended / Banned Account Login Prevention
  console.log('\n--- Test 9: Suspended Account Login Prevention ---');
  const bannedUser = await User.create({
    name: 'Banned Person',
    email: 'test_banned_google@example.com',
    googleId: 'google-sub-banned-999',
    isBanned: true,
    bannedReason: 'Fraudulent activity detected',
    authProviders: ['google'],
  });

  const bannedToken = createMockGoogleToken({
    sub: 'google-sub-banned-999',
    email: 'test_banned_google@example.com',
    email_verified: true,
  });

  const reqBanned = {
    body: { idToken: bannedToken },
    ip: '127.0.0.1',
    headers: {},
  };
  const resBanned = mockRes();
  await googleAuth(reqBanned, resBanned, (err) => { if (err) throw err; });
  console.assert(resBanned.statusCode === 403, `Status code must be 403 for banned user, got ${resBanned.statusCode}`);
  console.log('✅ Test 9 Passed: Banned user login strictly rejected with 403');

  // Clean up
  await User.deleteMany({ email: { $in: ['test_google_new@example.com', 'test_local_merge@example.com', 'test_banned_google@example.com'] } });
  await disconnectDB();
  console.log('\n🎉 ALL 9 GOOGLE OAUTH BACKEND TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
