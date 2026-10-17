import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  preferences: { theme: { type: String, enum: ['light', 'dark'], default: 'light' }, monitoringInterval: { type: Number, default: 30, min: 10, max: 3600 }, demoMode: { type: Boolean, default: true } }
}, { timestamps: true });
export default mongoose.model('User', userSchema);
