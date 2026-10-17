# CloudPulse — Cloud Resource Monitoring & Alert System

A full-stack Computer Science mini-project for monitoring server CPU, memory, disk, network activity, alert thresholds, and incidents. Demo metrics are explicitly labeled as simulated; registering a hostname alone never claims to monitor a real machine.

## Technology stack

- **Frontend:** React 18, Vite, JavaScript, Recharts, Lucide icons, responsive CSS design system
- **Backend:** Node.js 20+, Express 4, JWT authentication, bcrypt password hashing, Zod validation
- **Database:** MongoDB / MongoDB Atlas through Mongoose
- **Security:** Helmet, CORS allowlist, authentication rate limit, request validation, per-user ownership filters, no production secrets in source

## Project structure

```text
cloud-resource-monitoring/
├── backend/
│   ├── src/
│   │   ├── config/db.js
│   │   ├── middleware/       # JWT auth and centralized errors
│   │   ├── models/           # User, Server, Metric, AlertRule, Incident
│   │   ├── routes/api.js     # REST API
│   │   ├── services/         # Demo collector, alert engine, validation
│   │   ├── app.js
│   │   ├── server.js
│   │   └── seedDemo.js
│   ├── tests/validation.test.js
│   └── .env.example
├── frontend/
│   ├── src/App.jsx
│   ├── src/lib/api.js
│   ├── src/styles.css
│   ├── .env.example
│   └── vite.config.js
├── package.json
└── README.md
```

## Requirements

- Node.js 20 or newer and npm
- MongoDB local instance or a MongoDB Atlas database
- A browser with modern JavaScript support

## Run locally

1. Open a terminal in this project folder.
2. Install the root and workspace dependencies:

   ```bash
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```

3. Create backend environment configuration:

   ```bash
   cp backend/.env.example backend/.env
   ```

   On Windows PowerShell, use `Copy-Item backend/.env.example backend/.env`.

4. Edit `backend/.env`. At minimum set `MONGODB_URI` and a unique `JWT_SECRET` of 32+ characters. Keep the database URI and JWT secret private.
5. Create frontend environment configuration if needed:

   ```bash
   cp frontend/.env.example frontend/.env
   ```

6. Start MongoDB, then run both applications from the project root:

   ```bash
   npm run dev
   ```

7. Open **http://localhost:5173**. Create an account. Use **Load demo data** to create four simulated servers and default alert rules. The API is at **http://localhost:5000/api** and health check at **http://localhost:5000/api/health**.

For Windows, copy the example env files using PowerShell's `Copy-Item` command. Never commit `.env` files.

## Optional seeded demo account

With `MONGODB_URI` configured, run:

```bash
npm --prefix backend run seed:demo
```

Credentials created by the seed script: `demo@example.com` / `DemoPass123!`. This is a development-only demo account. Change or delete it before any public deployment. The seed script does not delete existing data and skips adding sample servers if that account already has servers.

## REST API overview

All endpoints are prefixed with `/api`. Except `/health`, `/auth/register`, and `/auth/login`, endpoints require `Authorization: Bearer <JWT>`.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/health` | API/database readiness status |
| POST | `/auth/register` | Create account and issue token |
| POST | `/auth/login` | Authenticate and issue token |
| GET | `/auth/me` | Current user profile |
| PATCH | `/settings` | Update profile/preferences |
| GET, POST | `/servers` | List and register owned servers |
| GET, PATCH, DELETE | `/servers/:id` | Read/update/delete an owned server |
| GET | `/dashboard` | Dashboard summary, health counts, recent metrics and incidents |
| GET | `/metrics?serverId=<id>&range=1h\|24h\|7d` | Historical metric samples |
| POST | `/metrics/ingest` | Ingest metrics for an owned server in agent mode |
| POST | `/demo/initialize` | Create sample resources and alert rules on an empty account |
| GET, POST | `/alerts` | List/create alert rules |
| PATCH, DELETE | `/alerts/:id` | Update/delete an alert rule |
| GET | `/incidents?status=open&severity=critical&page=1&limit=50` | List and filter incidents |
| GET | `/incidents/:id` | Read incident details/history |
| PATCH | `/incidents/:id` | Acknowledge, resolve, or reopen an incident |

Successful responses use JSON with `success: true`. Errors use a suitable HTTP status and a JSON `message`. Incident and metric queries are bounded; incidents support pagination.

## Monitoring behavior

### Demo mode

- The backend collector periodically creates realistic, randomized CPU, memory, disk, and network samples for servers in demo mode.
- Metrics are persisted in MongoDB and historical charts read persisted samples.
- The dashboard refreshes periodically without a full page reload.
- Demo metrics are labeled `source: simulated`; they are not measurements from a real server.
- Alert rules are evaluated on each newly collected metric. Thresholds must be exceeded for the configured number of consecutive evaluations before an incident is created. Active incidents are deduplicated for the same rule/server and automatically resolved when the metric falls below the threshold.

### Real monitoring mode

A registered server is **not** monitored automatically. For actual readings, install and configure a monitoring agent on a server you own or are authorized to monitor. Configure the agent to send CPU, memory, disk, and optional network metrics to `POST /api/metrics/ingest` using a valid user JWT and the server's MongoDB ID. The server must be switched to `monitoringMode: "agent"`. The endpoint validates ownership and numeric ranges. For a production-grade agent, use a dedicated revocable per-server ingestion token rather than a user's interactive JWT, enforce TLS, and apply stricter agent-specific rate limits before exposing it publicly. Cloud provider metrics (AWS, Azure, GCP) require separate provider APIs, credentials, and permissions; no provider integration is claimed here.

## Environment variables

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | API port; defaults to 5000 |
| `NODE_ENV` | `development` or `production` |
| `MONGODB_URI` | Local MongoDB URI or Atlas connection string |
| `JWT_SECRET` | Random secret, 32+ characters; never share/commit |
| `JWT_EXPIRES_IN` | Token lifetime, defaults to `1d` |
| `CLIENT_ORIGIN` | Comma-separated allowed frontend origin(s) |
| `METRIC_INTERVAL_SECONDS` | Demo collection interval, minimum 10 seconds |
| `METRIC_RETENTION_DAYS` | Documented retention preference; the current TTL index is fixed at 30 days |
| `DEMO_MODE` | Set `false` to disable background demo collector startup |

### Frontend (`frontend/.env`)

- `VITE_API_URL` — API base URL, e.g. `http://localhost:5000/api` locally or `https://your-api-host.example.com/api` in production.

Only public API URLs belong in frontend variables. Never place database credentials, JWT signing secrets, or provider secrets in `VITE_*` variables.

## Database setup

For MongoDB Atlas: create a cluster, create a database user with only the required database permissions, allow network access only from your development/deployment environment where possible, and copy the application connection string into `MONGODB_URI`. Replace the password placeholder and URL-encode special characters. Do not publish the URI. The application creates collections and indexes via Mongoose models. Metric samples have a 30-day TTL index to limit historical storage.

## Test and build

```bash
npm test
npm run build
```

The automated Node tests cover input validation. Run API integration tests against a disposable test database before a production release; live MongoDB, hosted deployment, and agent telemetry require configured external services and are not assumed to have been verified just by building the source.

## Deployment

Deploy the frontend and backend separately, and provision MongoDB Atlas independently.

### Backend (Render, Railway, or another Node host)

- Root directory: `backend`
- Build command: `npm install`
- Start command: `npm start`
- Add `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `NODE_ENV=production`, `CLIENT_ORIGIN=https://<your-frontend-domain>`, `METRIC_INTERVAL_SECONDS`, and `DEMO_MODE` in the host's environment settings.
- Use the host-provided port (`PORT` is supported). Ensure `/api/health` reports database `connected` after deployment.
- Set a strong unique secret; the development fallback is not used for production.

### Frontend (Vercel, Netlify, or another static host)

- Root directory: `frontend`
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_URL=https://<your-backend-domain>/api` before building.
- Add the deployed frontend's exact origin to backend `CLIENT_ORIGIN`, then redeploy the backend.

### Production checklist

- Set all secrets only in the hosting provider's secret/environment manager.
- Use HTTPS for both frontend and API.
- Restrict MongoDB network access and database permissions.
- Replace the demo account password or remove the seeded account.
- Verify CORS origin, API health, registration/login, server CRUD, metrics history, alert evaluation, incident state changes, and cross-account access isolation.
- Use a dedicated agent credential and a production-grade authenticated telemetry pipeline before connecting real servers.
- Configure backup/restore and monitor the host's logs and resource usage.

## Known limitations

- This is a deployable project implementation, not a claim that it has already been deployed to a public URL.
- MongoDB is required for persistence and most API operations. When no `MONGODB_URI` is supplied in development, the server can start but data-backed routes cannot operate.
- Cloud provider APIs, email/SMS notifications, and a packaged production agent are not included.
- The current telemetry ingest endpoint uses a user JWT for authorization; use dedicated per-server credentials before public production use.
- The collector uses an in-process timer. On horizontally scaled backend instances, use a single worker or distributed job/lock to avoid duplicate collection.
- Metric retention is currently fixed at 30 days by the MongoDB TTL index; `METRIC_RETENTION_DAYS` is reserved for configurable retention work.
- Theme preference is stored per user, while the current theme toggle is a frontend session preference.

## Optional Docker Compose

Docker is not required for the simplest local setup. If Docker Desktop is installed, you can start MongoDB, the API, and a built frontend together:

```bash
docker compose up --build
```

Then open `http://localhost:8080`; the API health check is at `http://localhost:5000/api/health`. The Compose JWT secret is only a local placeholder and must be replaced before any deployment. The frontend API URL is supplied at image build time. To stop the stack, run `docker compose down`; add `-v` only if you intentionally want to delete the local MongoDB volume.
