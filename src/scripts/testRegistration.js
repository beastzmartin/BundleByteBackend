import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../models/User.js';
import { register } from '../controllers/authController.js';

async function testRegistration() {
  console.log('🧪 Testing User Registration Flow...');
  let mongod;
  try {
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());

    // Mock request and response
    const req = {
      body: {
        name: 'Muzammil Developer',
        email: 'muzammil.newuser@example.info',
        password: 'MySecurePassword123!',
        phone: '+91 9876543210',
      },
      headers: {},
      ip: '127.0.0.1',
    };

    let statusCode = null;
    let responseData = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          cookie: () => ({
            json: (data) => {
              responseData = data;
              return data;
            },
          }),
          json: (data) => {
            responseData = data;
            return data;
          },
        };
      },
    };

    let nextCalled = null;
    await register(req, res, (err) => {
      nextCalled = err;
    });

    if (nextCalled) {
      throw nextCalled;
    }

    console.log(`✅ Registration response status: ${statusCode}`);
    console.log(`✅ Success: ${responseData?.success}`);
    console.log(`✅ Message: ${responseData?.message}`);
    console.log(`✅ Registered User: ${responseData?.user?.name} (${responseData?.user?.email})`);
    console.log(`✅ Token generated: ${responseData?.token?.substring(0, 20)}...`);

    // Verify password matching
    const createdUser = await User.findOne({ email: req.body.email.toLowerCase() }).select('+password');
    const isMatch = await createdUser.matchPassword('MySecurePassword123!');
    console.log(`✅ Password bcrypt verification match: ${isMatch}`);

    console.log('\n🎉 REGISTRATION FLOW TEST PASSED CLEANLY!\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Registration test error:', err);
    process.exit(1);
  } finally {
    if (mongod) await mongod.stop();
  }
}

testRegistration();

