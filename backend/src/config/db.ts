import mongoose from 'mongoose';

export async function connectDB(): Promise<typeof mongoose> {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/statusforge';

  mongoose.connection.on('connected', () => {
    console.log(`[MongoDB] Connected to database: ${mongoose.connection.name} at ${mongoose.connection.host}:${mongoose.connection.port}`);
  });

  mongoose.connection.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[MongoDB] Disconnected from database');
  });

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    return conn;
  } catch (error) {
    console.error('[MongoDB] Initial connection failure:', error);
    throw error;
  }
}
