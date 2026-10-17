import mongoose from 'mongoose';
const serverSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  hostname: { type: String, required: true, trim: true, maxlength: 253 },
  environment: { type: String, enum: ['Development', 'Staging', 'Production'], default: 'Development' },
  description: { type: String, maxlength: 500, default: '' },
  monitoringMode: { type: String, enum: ['demo', 'agent'], default: 'demo' },
  status: { type: String, enum: ['healthy', 'warning', 'critical', 'offline'], default: 'offline' },
  lastHeartbeat: { type: Date, default: null },
  currentMetrics: { cpu: { type: Number, default: 0 }, memory: { type: Number, default: 0 }, disk: { type: Number, default: 0 }, networkIn: { type: Number, default: 0 }, networkOut: { type: Number, default: 0 } }
}, { timestamps: true });
serverSchema.index({ owner: 1, name: 1 });
export default mongoose.model('Server', serverSchema);
