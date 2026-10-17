import mongoose from 'mongoose';

export async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    if (process.env.NODE_ENV === 'production') throw new Error('MONGODB_URI must be configured in production.');
    console.warn('MONGODB_URI is not configured; API will run without database persistence.');
    return false;
  }
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
  console.log('MongoDB connected');
  return true;
}
