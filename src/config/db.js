import mongoose from 'mongoose';
import { ENV } from './environment.js';

let mongodMemory = null;

// Global cache for connection reuse across serverless function invocations
let cached = global._bbMongoose;
if (!cached) {
  cached = global._bbMongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  // Reuse existing connection if open
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }
  if (cached.conn && cached.conn.readyState === 1) {
    return cached.conn;
  }

  const isServerless = process.env.VERCEL === '1' || Boolean(process.env.AWS_LAMBDA_FUNCTION_VERSION);
  let uri = ENV.MONGODB_URI || '';

  if (isServerless && (!uri || uri.includes('127.0.0.1') || uri.includes('localhost'))) {
    throw new Error('A valid remote MongoDB Atlas URI (MONGODB_URI=mongodb+srv://...) is required in Vercel environment variables.');
  }

  uri = uri || 'mongodb://127.0.0.1:27017/bundlebyte_db';
  
  // Auto-append database name if not specified for MongoDB Atlas
  if (uri.startsWith('mongodb+srv://') && (uri.endsWith('.mongodb.net/') || uri.endsWith('.mongodb.net'))) {
    uri = uri.replace(/\/?$/, '/bundlebyte_db?retryWrites=true&w=majority');
  }

  if (uri.includes('<db_password>')) {
    console.warn('\n⚠️ WARNING: Your MONGODB_URI still contains placeholder "<db_password>".');
    console.warn('   Please replace "<db_password>" with your actual MongoDB Atlas user password.\n');
  }

  const isLocalHost = uri.includes('127.0.0.1') || uri.includes('localhost');

  if (!cached.promise) {
    const opts = {
      autoIndex: ENV.NODE_ENV !== 'production',
      serverSelectionTimeoutMS: 8000,
      bufferCommands: false, // In serverless, fail fast rather than hanging on buffering
    };

    cached.promise = mongoose.connect(uri, opts)
      .then((conn) => {
        console.log(`🚀 MongoDB Connected: ${conn.connection.host}:${conn.connection.port || 'default'} / ${conn.connection.name}`);
        return conn.connection;
      })
      .catch(async (error) => {
        cached.promise = null; // Clear cached promise on failure to allow retry

        // If local MongoDB is unavailable, fall back to embedded in-memory MongoDB in dev mode (non-serverless only)
        if (isLocalHost && (ENV.NODE_ENV !== 'production') && !isServerless) {
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
            return conn.connection;
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

        if (!isServerless && ENV.NODE_ENV !== 'test') {
          process.exit(1);
        }
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    throw err;
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
