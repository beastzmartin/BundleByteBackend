import mongoose from 'mongoose';
import { ENV } from './environment.js';

let mongodMemory = null;

export const connectDB = async () => {
  let uri = ENV.MONGODB_URI || 'mongodb://127.0.0.1:27017/bundlebyte_db';
  
  // Auto-append database name if not specified for MongoDB Atlas
  if (uri.startsWith('mongodb+srv://') && (uri.endsWith('.mongodb.net/') || uri.endsWith('.mongodb.net'))) {
    uri = uri.replace(/\/?$/, '/bundlebyte_db?retryWrites=true&w=majority');
  }

  if (uri.includes('<db_password>')) {
    console.warn('\n⚠️ WARNING: Your MONGODB_URI in backend/.env still contains the placeholder "<db_password>".');
    console.warn('   Please replace "<db_password>" with your actual MongoDB Atlas user password.\n');
  }

  const isLocalHost = uri.includes('127.0.0.1') || uri.includes('localhost');

  try {
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`🚀 MongoDB Connected: ${conn.connection.host}:${conn.connection.port || 'default'} / ${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('⚠️ MongoDB runtime error:', err.message);
    });

    return conn;
  } catch (error) {
    // If local MongoDB is unavailable, fall back to embedded in-memory MongoDB in dev mode
    if (isLocalHost && (ENV.NODE_ENV !== 'production')) {
      console.warn(`⚠️ Could not reach local MongoDB at ${uri}.`);
      console.log('🔄 Launching embedded in-memory MongoDB (mongodb-memory-server) so you can connect right here without manual setup...');
      try {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        mongodMemory = await MongoMemoryServer.create({
          instance: {
            dbName: 'bundlebyte_db',
          },
        });
        const memoryUri = mongodMemory.getUri();
        const conn = await mongoose.connect(memoryUri);
        console.log(`🚀 In-Memory MongoDB Connected successfully: ${memoryUri}`);
        return conn;
      } catch (memErr) {
        console.error(`❌ Failed to start in-memory MongoDB fallback: ${memErr.message}`);
      }
    }

    console.error(`\n❌ MongoDB Connection Error: ${error.message}`);
    if (uri.includes('mongodb+srv://')) {
      console.error('💡 Tip for MongoDB Atlas:');
      console.error('   1. Ensure your IP address is allowed in MongoDB Atlas -> Network Access (add 0.0.0.0/0 for anywhere).');
      console.error('   2. Verify your database username and password in backend/.env MONGODB_URI.');
      console.error('   3. Ensure the user has "Read and write to any database" privileges.\n');
    } else {
      console.error('💡 Tip for Local MongoDB:');
      console.error('   - Start MongoDB service: brew services start mongodb-community');
      console.error('   - Or provide a cloud MongoDB Atlas URI in backend/.env: MONGODB_URI=mongodb+srv://...\n');
    }
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    if (mongodMemory) {
      await mongodMemory.stop();
      mongodMemory = null;
    }
  } catch (err) {
    console.error('Error disconnecting DB:', err.message);
  }
};
