import mongoose from 'mongoose';
const historySchema = new mongoose.Schema({ action: String, note: String, at: { type: Date, default: Date.now }, by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null } }, { _id: false });
const incidentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', required: true },
  alertRule: { type: mongoose.Schema.Types.ObjectId, ref: 'AlertRule', default: null },
  title: { type: String, required: true }, metric: { type: String, enum: ['cpu', 'memory', 'disk'], required: true },
  threshold: { type: Number, required: true }, observedValue: { type: Number, required: true },
  severity: { type: String, enum: ['warning', 'critical'], required: true },
  status: { type: String, enum: ['open', 'acknowledged', 'resolved'], default: 'open' },
  triggeredAt: { type: Date, default: Date.now }, resolvedAt: { type: Date, default: null },
  history: { type: [historySchema], default: [] }
}, { timestamps: true });
incidentSchema.index({ owner: 1, status: 1, triggeredAt: -1 });
incidentSchema.index({ server: 1, alertRule: 1, status: 1 });
export default mongoose.model('Incident', incidentSchema);
