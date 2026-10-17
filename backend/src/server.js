import dns from "node:dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

import 'dotenv/config';
import app from './app.js';
import { connectDatabase } from './config/db.js';
import { startMonitor, stopMonitor } from './services/demoMonitor.js';
const port = Number(process.env.PORT || 5000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET must be at least 32 characters in production.');
  process.env.JWT_SECRET ||= 'local-development-secret-change-this-123456789';
}
await connectDatabase();
const server = app.listen(port, () => console.log(`Cloud Monitoring API listening on port ${port}`));
if (process.env.DEMO_MODE !== 'false' && process.env.MONGODB_URI) startMonitor();
const shutdown = () => { stopMonitor(); server.close(() => process.exit(0)); };
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
