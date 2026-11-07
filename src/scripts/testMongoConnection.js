import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const testConnection = async () => {
  let uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bundlebyte_db';
  
  if (uri.startsWith('mongodb+srv://') && (uri.endsWith('.mongodb.net/') || uri.endsWith('.mongodb.net'))) {
    uri = uri.replace(/\/?$/, '/bundlebyte_db?retryWrites=true&w=majority');
  }

  if (uri.includes('<db_password>')) {
    console.warn('\n⚠️ WARNING: Your MONGODB_URI still contains "<db_password>".');
    console.warn('   Please replace "<db_password>" with your actual MongoDB user password in backend/.env before testing.\n');
  }
  console.log('\n======================================================');
  console.log('🔍 Testing MongoDB Connection from BundleByte');
  console.log('======================================================');
  console.log(`📡 Target URI: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);

  try {
    const startTime = Date.now();
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      autoIndex: true,
    });
    const duration = Date.now() - startTime;

    console.log(`\n✅ Connection SUCCESSFUL in ${duration}ms!`);
    console.log(`🏠 Host: ${conn.connection.host}`);
    console.log(`📁 Database Name: ${conn.connection.name}`);
    console.log(`🔌 Connection ReadyState: ${conn.connection.readyState} (1 = connected)`);

    // Ping database
    const pingResult = await conn.connection.db.admin().ping();
    console.log(`🏓 Database Ping OK:`, pingResult);

    // List collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log(`📚 Found ${collections.length} collections:`, collections.map(c => c.name).join(', ') || 'None yet');

    console.log('\n✨ MongoDB is fully ready and accessible from this project.');
    console.log('======================================================\n');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ Failed to connect to MongoDB: ${error.message}`);
    console.log('\n💡 Troubleshooting Guide:');
    if (uri.includes('mongodb+srv://')) {
      console.log('   1. MongoDB Atlas IP Access:');
      console.log('      - Go to cloud.mongodb.com -> Network Access.');
      console.log('      - Click "Add IP Address" and select "Allow Access From Anywhere" (0.0.0.0/0).');
      console.log('   2. Database Credentials:');
      console.log('      - Go to Database Access and ensure the user exists and the password is typed correctly.');
      console.log('      - Special characters in password must be URL-encoded (e.g. @ becomes %40).');
      console.log('   3. Database Name:');
      console.log('      - Ensure the URI contains the db name, e.g. /bundlebyte_db?retryWrites=true&w=majority\n');
    } else {
      console.log('   1. Local MongoDB daemon is not running.');
      console.log('      - On macOS: brew services start mongodb-community');
      console.log('   2. Or connect to MongoDB Atlas by setting MONGODB_URI in backend/.env:');
      console.log('      MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.abcde.mongodb.net/bundlebyte_db?retryWrites=true&w=majority\n');
    }
    process.exit(1);
  }
};

testConnection();

