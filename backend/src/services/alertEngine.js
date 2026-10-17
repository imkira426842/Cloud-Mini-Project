import AlertRule from '../models/AlertRule.js';
import Incident from '../models/Incident.js';
import Server from '../models/Server.js';

export async function evaluateMetric(metricDoc) {
  const rules = await AlertRule.find({ owner: metricDoc.owner, enabled: true, $or: [{ server: metricDoc.server }, { server: null }] });
  for (const rule of rules) {
    const value = metricDoc[rule.metric];
    const state = rule.evaluationState.get(String(metricDoc.server)) || 0;
    const nextState = value >= rule.threshold ? state + 1 : 0;
    rule.evaluationState.set(String(metricDoc.server), nextState);
    await rule.save();
    const active = await Incident.findOne({ owner: metricDoc.owner, server: metricDoc.server, alertRule: rule._id, status: { $in: ['open', 'acknowledged'] } });
    if (nextState >= rule.consecutiveEvaluations && !active) {
      await Incident.create({ owner: metricDoc.owner, server: metricDoc.server, alertRule: rule._id, title: `${rule.metric.toUpperCase()} utilization exceeded ${rule.threshold}%`, metric: rule.metric, threshold: rule.threshold, observedValue: value, severity: rule.severity, history: [{ action: 'triggered', note: `Observed ${value}% for ${nextState} consecutive evaluation(s).`, by: null }] });
    }
    if (value < rule.threshold && active) {
      active.status = 'resolved'; active.resolvedAt = new Date();
      active.history.push({ action: 'auto-resolved', note: `Condition returned to normal at ${value}%.`, by: null });
      await active.save();
    }
  }
  const all = await Server.find({ _id: metricDoc.server, owner: metricDoc.owner });
  const server = all[0];
  if (server) {
    server.currentMetrics = { cpu: metricDoc.cpu, memory: metricDoc.memory, disk: metricDoc.disk, networkIn: metricDoc.networkIn, networkOut: metricDoc.networkOut };
    server.lastHeartbeat = metricDoc.collectedAt;
    server.status = Math.max(metricDoc.cpu, metricDoc.memory, metricDoc.disk) >= 90 ? 'critical' : Math.max(metricDoc.cpu, metricDoc.memory, metricDoc.disk) >= 75 ? 'warning' : 'healthy';
    await server.save();
  }
}
