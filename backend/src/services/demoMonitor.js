import Server from '../models/Server.js';
import Metric from '../models/Metric.js';
import { evaluateMetric } from './alertEngine.js';
let timer = null;
let busy = false;
function bounded(n) { return Math.max(2, Math.min(99, Math.round(n * 10) / 10)); }
export async function collectDemoMetrics() {
  if (busy) return;
  busy = true;
  try {
    const servers = await Server.find({ monitoringMode: 'demo' });
    for (const server of servers) {
      const drift = (base) => bounded(base + (Math.random() - 0.5) * 12);
      const prev = server.currentMetrics || {};
      const metric = await Metric.create({ owner: server.owner, server: server._id, cpu: drift(prev.cpu || 35), memory: drift(prev.memory || 48), disk: drift(prev.disk || 42), networkIn: Math.round(20 + Math.random() * 800), networkOut: Math.round(10 + Math.random() * 500), source: 'simulated', collectedAt: new Date() });
      await evaluateMetric(metric);
    }
  } finally { busy = false; }
}
export function startMonitor() {
  if (timer) return;
  const interval = Math.max(10, Number(process.env.METRIC_INTERVAL_SECONDS || 30)) * 1000;
  timer = setInterval(() => collectDemoMetrics().catch((e) => console.error('Metric collection failed:', e.message)), interval);
  timer.unref?.();
  console.log(`Demo metric collector enabled (${interval / 1000}s interval)`);
}
export function stopMonitor() { if (timer) clearInterval(timer); timer = null; }
