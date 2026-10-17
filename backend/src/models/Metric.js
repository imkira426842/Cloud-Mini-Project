import mongoose from 'mongoose';
const metricSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true, index: true },
  cpu: { type: Number, required: true, min: 0, max: 100 },
  memory: { type: Number, required: true, min: 0, max: 100 },
  disk: { type: Number, required: true, min: 0, max: 100 },
  networkIn: { type: Number, default: 0, min: 0 },
  networkOut: { type: Number, default: 0, min: 0 },
  source: { type: String, enum: ['simulated', 'agent'], default: 'simulated' },
  collectedAt: { type: Date, default: Date.now, index: true }
}, { timestamps: false });
metricSchema.index({ server: 1, collectedAt: -1 });
metricSchema.index({ collectedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });
export default mongoose.model('Metric', metricSchema);
