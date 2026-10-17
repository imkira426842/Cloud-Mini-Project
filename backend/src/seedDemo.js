import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Server from './models/Server.js';
import AlertRule from './models/AlertRule.js';
import Metric from './models/Metric.js';
import { collectDemoMetrics } from './services/demoMonitor.js';
if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding demo data.');
await mongoose.connect(process.env.MONGODB_URI);
let user = await User.findOne({ email: 'demo@example.com' });
if (!user) user = await User.create({ name: 'Demo Operator', email: 'demo@example.com', passwordHash: await bcrypt.hash('DemoPass123!', 12) });
if (!(await Server.exists({ owner: user._id }))) {
  const servers = await Server.create([
    { owner: user._id, name: 'Production API', hostname: 'api-prod.example.internal', environment: 'Production', description: 'Simulated API server', monitoringMode: 'demo' },
    { owner: user._id, name: 'Web Frontend', hostname: 'web-prod.example.internal', environment: 'Production', description: 'Simulated web server', monitoringMode: 'demo' },
    { owner: user._id, name: 'Staging Worker', hostname: 'worker-stg.example.internal', environment: 'Staging', description: 'Simulated worker', monitoringMode: 'demo' }
  ]);
  await AlertRule.create([{ owner: user._id, name: 'CPU critical', metric: 'cpu', threshold: 90, severity: 'critical', consecutiveEvaluations: 3 }, { owner: user._id, name: 'Memory warning', metric: 'memory', threshold: 80, severity: 'warning', consecutiveEvaluations: 2 }]);
  for (const server of servers) for (let i = 0; i < 24; i++) await Metric.create({ owner: user._id, server: server._id, cpu: 25 + Math.random() * 55, memory: 35 + Math.random() * 45, disk: 30 + Math.random() * 40, networkIn: Math.round(Math.random() * 600), networkOut: Math.round(Math.random() * 300), source: 'simulated', collectedAt: new Date(Date.now() - (23 - i) * 60 * 60 * 1000) });
}
console.log('Demo account: demo@example.com / DemoPass123!');
console.log('Seed is non-destructive and skips accounts that already have servers.');
await mongoose.disconnect();
