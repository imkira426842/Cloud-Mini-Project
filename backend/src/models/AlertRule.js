import mongoose from 'mongoose';
const alertRuleSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  server: { type: mongoose.Schema.Types.ObjectId, ref: 'Server', default: null },
  metric: { type: String, enum: ['cpu', 'memory', 'disk'], required: true },
  threshold: { type: Number, required: true, min: 1, max: 100 },
  severity: { type: String, enum: ['warning', 'critical'], default: 'warning' },
  consecutiveEvaluations: { type: Number, default: 1, min: 1, max: 20 },
  enabled: { type: Boolean, default: true },
  evaluationState: { type: Map, of: Number, default: {} }
}, { timestamps: true });
export default mongoose.model('AlertRule', alertRuleSchema);
