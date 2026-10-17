import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import User from '../models/User.js';
import Server from '../models/Server.js';
import Metric from '../models/Metric.js';
import AlertRule from '../models/AlertRule.js';
import Incident from '../models/Incident.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { parse, registerSchema, loginSchema, serverSchema, alertSchema } from '../services/validation.js';
import { collectDemoMetrics } from '../services/demoMonitor.js';
import { evaluateMetric } from '../services/alertEngine.js';
const router = Router();
const authLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 25, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many authentication attempts. Please try again later.' } });
const tokenFor = user => jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '1d' });
const cleanUser = user => ({ id: user._id, name: user.name, email: user.email, preferences: user.preferences, createdAt: user.createdAt });
const ownedServer = async (id, owner) => Server.findOne({ _id: id, owner });

router.get('/health', (req, res) => res.json({ success: true, status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', timestamp: new Date().toISOString() }));
router.post('/auth/register', authLimit, asyncHandler(async (req, res) => {
  const input = parse(registerSchema, req.body);
  if (await User.exists({ email: input.email.toLowerCase() })) return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
  const user = await User.create({ name: input.name, email: input.email.toLowerCase(), passwordHash: await bcrypt.hash(input.password, 12) });
  res.status(201).json({ success: true, token: tokenFor(user), user: cleanUser(user) });
}));
router.post('/auth/login', authLimit, asyncHandler(async (req, res) => {
  const input = parse(loginSchema, req.body);
  const user = await User.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ success: false, message: 'Email or password is incorrect.' });
  res.json({ success: true, token: tokenFor(user), user: cleanUser(user) });
}));
router.use(requireAuth);
router.get('/auth/me', (req, res) => res.json({ success: true, user: cleanUser(req.user) }));
router.patch('/settings', asyncHandler(async (req, res) => {
  const patch = {};
  if (req.body.name !== undefined) { if (typeof req.body.name !== 'string' || req.body.name.trim().length < 2 || req.body.name.length > 80) return res.status(400).json({ success: false, message: 'Name must be 2–80 characters.' }); patch.name = req.body.name.trim(); }
  if (req.body.preferences) {
    const p = req.body.preferences;
    if (p.theme !== undefined && !['light','dark'].includes(p.theme)) return res.status(400).json({ success: false, message: 'Invalid theme.' });
    if (p.monitoringInterval !== undefined && (!Number.isInteger(p.monitoringInterval) || p.monitoringInterval < 10 || p.monitoringInterval > 3600)) return res.status(400).json({ success: false, message: 'Monitoring interval must be 10–3600 seconds.' });
    if (p.demoMode !== undefined && typeof p.demoMode !== 'boolean') return res.status(400).json({ success: false, message: 'demoMode must be boolean.' });
    for (const key of ['theme','monitoringInterval','demoMode']) if (p[key] !== undefined) patch[`preferences.${key}`] = p[key];
  }
  const user = await User.findByIdAndUpdate(req.user._id, { $set: patch }, { new: true, runValidators: true });
  res.json({ success: true, user: cleanUser(user) });
}));

router.get('/servers', asyncHandler(async (req, res) => {
  const filter = { owner: req.user._id };
  if (req.query.status && ['healthy','warning','critical','offline'].includes(req.query.status)) filter.status = req.query.status;
  if (req.query.environment && ['Development','Staging','Production'].includes(req.query.environment)) filter.environment = req.query.environment;
  if (req.query.search) filter.$or = [{ name: { $regex: String(req.query.search).slice(0, 80), $options: 'i' } }, { hostname: { $regex: String(req.query.search).slice(0, 120), $options: 'i' } }];
  const servers = await Server.find(filter).sort({ updatedAt: -1 }).limit(200);
  res.json({ success: true, servers });
}));
router.post('/servers', asyncHandler(async (req, res) => {
  const input = parse(serverSchema, req.body);
  const server = await Server.create({ ...input, owner: req.user._id, monitoringMode: input.monitoringMode || 'demo' });
  if (server.monitoringMode === 'demo') await collectDemoMetrics();
  res.status(201).json({ success: true, server });
}));
router.get('/servers/:id', asyncHandler(async (req, res) => { const server = await ownedServer(req.params.id, req.user._id); if (!server) return res.status(404).json({ success: false, message: 'Server not found.' }); res.json({ success: true, server }); }));
router.patch('/servers/:id', asyncHandler(async (req, res) => {
  const input = parse(serverSchema.partial(), req.body);
  const server = await Server.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { $set: input }, { new: true, runValidators: true });
  if (!server) return res.status(404).json({ success: false, message: 'Server not found.' }); res.json({ success: true, server });
}));
router.delete('/servers/:id', asyncHandler(async (req, res) => {
  const server = await Server.findOneAndDelete({ _id: req.params.id, owner: req.user._id });
  if (!server) return res.status(404).json({ success: false, message: 'Server not found.' });
  await Promise.all([Metric.deleteMany({ server: server._id, owner: req.user._id }), AlertRule.updateMany({ server: server._id, owner: req.user._id }, { $set: { enabled: false } }), Incident.updateMany({ server: server._id, owner: req.user._id, status: { $ne: 'resolved' } }, { $set: { status: 'resolved', resolvedAt: new Date() } })]);
  res.json({ success: true, message: 'Server deleted.' });
}));

router.get('/metrics', asyncHandler(async (req, res) => {
  const server = req.query.serverId ? await ownedServer(req.query.serverId, req.user._id) : null;
  if (req.query.serverId && !server) return res.status(404).json({ success: false, message: 'Server not found.' });
  const range = ({ '1h': 60, '24h': 1440, '7d': 10080 })[req.query.range] || 1440;
  const since = new Date(Date.now() - range * 60000);
  const filter = { owner: req.user._id, collectedAt: { $gte: since } };
  if (server) filter.server = server._id;
  const metrics = await Metric.find(filter).sort({ collectedAt: 1 }).limit(5000).lean();
  res.json({ success: true, range: req.query.range || '24h', metrics, sourceLabel: 'Simulated metrics are labeled as simulated; agent metrics require an installed authorized agent.' });
}));
router.post('/metrics/ingest', asyncHandler(async (req, res) => {
  const { serverId, cpu, memory, disk, networkIn = 0, networkOut = 0 } = req.body;
  const server = await ownedServer(serverId, req.user._id);
  if (!server) return res.status(404).json({ success: false, message: 'Server not found or not owned by this account.' });
  if (server.monitoringMode !== 'agent') return res.status(400).json({ success: false, message: 'This server is in demo mode. Switch it to agent mode before ingesting agent metrics.' });
  for (const [key, value] of Object.entries({ cpu, memory, disk, networkIn, networkOut })) if (!Number.isFinite(value) || value < 0 || (['cpu','memory','disk'].includes(key) && value > 100)) return res.status(400).json({ success: false, message: `Invalid ${key} metric.` });
  const metric = await Metric.create({ owner: req.user._id, server: server._id, cpu, memory, disk, networkIn, networkOut, source: 'agent' });
  await evaluateMetric(metric);
  res.status(201).json({ success: true, metric });
}));
router.post('/demo/initialize', asyncHandler(async (req, res) => {
  const existing = await Server.countDocuments({ owner: req.user._id });
  if (existing > 0) return res.status(409).json({ success: false, message: 'Your account already has servers. Demo initialization only runs on an empty account.' });
  const servers = await Server.create([
    { owner: req.user._id, name: 'Production API', hostname: 'api-prod.example.internal', environment: 'Production', description: 'Primary application API (simulated)', monitoringMode: 'demo' },
    { owner: req.user._id, name: 'Web Frontend', hostname: 'web-prod.example.internal', environment: 'Production', description: 'Customer-facing frontend (simulated)', monitoringMode: 'demo' },
    { owner: req.user._id, name: 'Staging Worker', hostname: 'worker-stg.example.internal', environment: 'Staging', description: 'Background job worker (simulated)', monitoringMode: 'demo' },
    { owner: req.user._id, name: 'Development DB', hostname: 'db-dev.example.internal', environment: 'Development', description: 'Development database host (simulated)', monitoringMode: 'demo' }
  ]);
  await AlertRule.create([
    { owner: req.user._id, name: 'High CPU usage', metric: 'cpu', threshold: 85, severity: 'critical', consecutiveEvaluations: 3 },
    { owner: req.user._id, name: 'Memory pressure', metric: 'memory', threshold: 80, severity: 'warning', consecutiveEvaluations: 2 },
    { owner: req.user._id, name: 'Disk usage warning', metric: 'disk', threshold: 85, severity: 'warning', consecutiveEvaluations: 2 }
  ]);
  await collectDemoMetrics();
  res.status(201).json({ success: true, message: 'Demo environment initialized with simulated resources.', servers });
}));

router.get('/alerts', asyncHandler(async (req, res) => { const rules = await AlertRule.find({ owner: req.user._id }).populate('server', 'name').sort({ createdAt: -1 }); res.json({ success: true, rules }); }));
router.post('/alerts', asyncHandler(async (req, res) => {
  const input = parse(alertSchema, req.body);
  if (input.server && !(await ownedServer(input.server, req.user._id))) return res.status(404).json({ success: false, message: 'Server not found.' });
  const rule = await AlertRule.create({ ...input, server: input.server || null, owner: req.user._id });
  res.status(201).json({ success: true, rule });
}));
router.patch('/alerts/:id', asyncHandler(async (req, res) => {
  const input = parse(alertSchema.partial(), req.body);
  if (input.server && !(await ownedServer(input.server, req.user._id))) return res.status(404).json({ success: false, message: 'Server not found.' });
  const rule = await AlertRule.findOneAndUpdate({ _id: req.params.id, owner: req.user._id }, { $set: input }, { new: true, runValidators: true }).populate('server', 'name');
  if (!rule) return res.status(404).json({ success: false, message: 'Alert rule not found.' }); res.json({ success: true, rule });
}));
router.delete('/alerts/:id', asyncHandler(async (req, res) => { const rule = await AlertRule.findOneAndDelete({ _id: req.params.id, owner: req.user._id }); if (!rule) return res.status(404).json({ success: false, message: 'Alert rule not found.' }); res.json({ success: true, message: 'Alert rule deleted.' }); }));

router.get('/incidents', asyncHandler(async (req, res) => {
  const filter = { owner: req.user._id };
  if (['open','acknowledged','resolved'].includes(req.query.status)) filter.status = req.query.status;
  if (['warning','critical'].includes(req.query.severity)) filter.severity = req.query.severity;
  if (req.query.serverId) { if (!(await ownedServer(req.query.serverId, req.user._id))) return res.status(404).json({ success: false, message: 'Server not found.' }); filter.server = req.query.serverId; }
  if (req.query.search) filter.title = { $regex: String(req.query.search).slice(0, 100), $options: 'i' };
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10)); const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '50', 10)));
  const [incidents, total] = await Promise.all([Incident.find(filter).populate('server', 'name hostname').sort({ triggeredAt: -1 }).skip((page - 1) * limit).limit(limit), Incident.countDocuments(filter)]);
  res.json({ success: true, incidents, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));
router.get('/incidents/:id', asyncHandler(async (req, res) => { const incident = await Incident.findOne({ _id: req.params.id, owner: req.user._id }).populate('server', 'name hostname'); if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' }); res.json({ success: true, incident }); }));
router.patch('/incidents/:id', asyncHandler(async (req, res) => {
  const { action, note = '' } = req.body;
  if (!['acknowledge','resolve','reopen'].includes(action)) return res.status(400).json({ success: false, message: 'Action must be acknowledge, resolve, or reopen.' });
  const incident = await Incident.findOne({ _id: req.params.id, owner: req.user._id });
  if (!incident) return res.status(404).json({ success: false, message: 'Incident not found.' });
  if (action === 'acknowledge' && incident.status === 'open') incident.status = 'acknowledged';
  else if (action === 'resolve' && incident.status !== 'resolved') { incident.status = 'resolved'; incident.resolvedAt = new Date(); }
  else if (action === 'reopen' && incident.status === 'resolved') { incident.status = 'open'; incident.resolvedAt = null; }
  else return res.status(409).json({ success: false, message: `Cannot ${action} an incident that is ${incident.status}.` });
  incident.history.push({ action, note: String(note).slice(0, 500), by: req.user._id }); await incident.save();
  res.json({ success: true, incident });
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
  const [servers, incidents, metrics, recentIncidents] = await Promise.all([
    Server.find({ owner: req.user._id }).lean(),
    Incident.countDocuments({ owner: req.user._id, status: { $in: ['open','acknowledged'] } }),
    Metric.find({ owner: req.user._id, collectedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }).sort({ collectedAt: -1 }).limit(1200).lean(),
    Incident.find({ owner: req.user._id }).populate('server', 'name').sort({ triggeredAt: -1 }).limit(6).lean()
  ]);
  const average = key => metrics.length ? Math.round(metrics.reduce((sum, m) => sum + m[key], 0) / metrics.length) : 0;
  const health = { healthy: 0, warning: 0, critical: 0, offline: 0 }; servers.forEach(s => health[s.status]++);
  res.json({ success: true, summary: { totalServers: servers.length, healthyServers: health.healthy, warningServers: health.warning, criticalServers: health.critical, offlineServers: health.offline, activeIncidents: incidents, avgCpu: average('cpu'), avgMemory: average('memory'), avgDisk: average('disk') }, health, servers: servers.slice(0, 8), recentIncidents, metrics: metrics.slice(-120), demoOnly: metrics.every(m => m.source === 'simulated') });
}));
export default router;
