import mongoose from 'mongoose';
import { ENV } from './environment.js';

export const connectDB = async () => {
  try {
    const uri = ENV.MONGODB_URI || 'mongodb://127.0.0.1:27017/bundlebyte_db';
    const conn = await mongoose.connect(uri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`🚀 MongoDB Connected: ${conn.connection.host}:${conn.connection.port} / ${conn.connection.name}`);

    mongoose.connection.on('error', (err) => {
      console.error('⚠️ MongoDB error:', err.message);
    });

    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error disconnecting DB:', err.message);
  }
};
