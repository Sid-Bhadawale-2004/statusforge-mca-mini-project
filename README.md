# StatusForge ⚡

> **High-Reliability Incident Management, On-Call Scheduling, and Real-Time Status Communication Platform**

StatusForge is a production-grade, completely decoupled incident management platform architected for modern engineering teams. It connects directly to a real local MongoDB instance with strict multi-tenant boundary isolation, automated escalation workers, predictive on-call shift rotations, and live Socket.IO status broadcasting.

---

## 🏛️ System Architecture

StatusForge is decoupled into an Express + Mongoose REST & WebSocket backend and a React + Vite + Tailwind CSS obsidian-themed web client.

```
statusforge/
├── docker-compose.yml              # Local MongoDB 7.0 container on port 27017
├── README.md                       # Complete setup, seeding, and execution guide
│
├── backend/                        # Node.js / Express / Mongoose API Server (Port 5000)
│   ├── package.json
│   ├── tsconfig.json               # NodeNext / ES2022 TypeScript configuration
│   ├── .env.example
│   └── src/
│       ├── config/
│       │   └── db.ts               # Mongoose connection with lifecycle event logging
│       ├── models/                 # Pure Mongoose Schema definitions
│       │   ├── Organization.ts     # Multi-tenant organization entities
│       │   ├── User.ts             # User profiles, passwords, and RBAC roles
│       │   ├── Service.ts          # Monitored microservices and webhook secrets
│       │   ├── OnCallSchedule.ts   # Rotation rosters (daily / weekly)
│       │   ├── EscalationPolicy.ts # Multi-step escalation ladders & timeouts
│       │   ├── Incident.ts         # Active & resolved incidents (P1-P4)
│       │   ├── IncidentEvent.ts    # Immutable incident timeline events
│       │   ├── Notification.ts     # Email paging alerts
│       │   └── AuditLog.ts         # Administrative security audit trail
│       ├── middleware/
│       │   ├── auth.ts             # JWT Bearer token authentication
│       │   ├── rbac.ts             # Role-based access control (Admin, Responder, Viewer)
│       │   └── errorHandler.ts     # Centralized error handler (Zod, Mongoose, CastError)
│       ├── services/
│       │   ├── oncall.service.ts   # Shift math & 5-shift forecast generator
│       │   ├── escalation.worker.ts# Background worker checking unacknowledged alerts
│       │   └── realtime.service.ts # Socket.IO room manager ('org:<id>', 'status:<slug>')
│       ├── routes/
│       │   ├── auth.routes.ts      # Signup, login, session, demo role switcher
│       │   ├── user.routes.ts      # Team roster management (POST /api/v1/users)
│       │   ├── service.routes.ts   # Microservice health overrides & secret rotation
│       │   ├── schedule.routes.ts  # On-call rotation management
│       │   ├── policy.routes.ts    # Multi-tier escalation chains
│       │   ├── incident.routes.ts  # War-room, acknowledge, resolve, comments
│       │   ├── webhook.routes.ts   # Ingestion with secret auth & deduplication
│       │   ├── public.routes.ts    # Unauthenticated public status page (/status/:slug)
│       │   └── index.ts            # Route aggregator mounted under /api/v1
│       ├── scripts/
│       │   └── seed.ts             # Connects to MongoDB and seeds Acme Engineering
│       └── server.ts               # Express + HTTP + Socket.IO server on port 5000
│
└── frontend/                       # React 18 + Vite + Tailwind CSS Single Page App (Port 3000)
    ├── package.json
    ├── vite.config.ts              # Proxy /api and /socket.io to backend port 5000
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── index.css               # Tailwind CSS setup with dark obsidian theme
        ├── types/                  # Typed interfaces matching backend models
        ├── services/
        │   └── api.ts              # Fetch client with JWT authorization handling
        ├── context/
        │   └── AuthContext.tsx     # Session state, Socket.IO client, demo role switcher
        ├── components/
        │   ├── AppShell.tsx        # Obsidian navigation, sidebar, role switcher
        │   └── WebhookSimulatorModal.tsx # In-app modal with cURL previews and test alert sender
        ├── pages/
        │   ├── DashboardPage.tsx   # Command center: unacked alerts, MTTA/MTTR, triage
        │   ├── IncidentsPage.tsx   # War-room: timeline, escalation ladder visualizer
        │   ├── ServicesPage.tsx    # Microservice cards, health overrides, webhook keys
        │   ├── SchedulesPage.tsx   # On-call roster, active primary, 5-shift forecast
        │   ├── PoliciesPage.tsx    # Multi-step escalation chain builder
        │   ├── UsersPage.tsx       # Team management: add users, assign RBAC roles
        │   ├── PublicStatusPage.tsx# No-auth status page for visitors with live WebSockets
        │   └── AuthPage.tsx        # Login, signup, and password reset
        ├── App.tsx                 # React Router routing table
        └── main.tsx
```

---

## 🚀 Quick Start Guide

### 1. Database Setup (MongoDB)

StatusForge connects directly to a real local MongoDB instance listening on port `27017`.

#### Option A: Native MongoDB (Windows / macOS / Linux)
If MongoDB Server is already installed and running as a local service on `mongodb://localhost:27017/statusforge`, no additional setup is required.

#### Option B: Docker Compose
If you prefer running MongoDB in Docker:
```bash
docker compose up -d
```
Verify the container is healthy:
```bash
docker ps
```

---

### 2. Backend Setup & Seeding

Open a terminal and navigate to the backend directory:

```bash
cd backend

# 1. Install backend dependencies
npm install

# 2. Copy backend/.env.example to backend/.env, then replace the JWT_SECRET
#    and SEED_DEFAULT_PASSWORD placeholders with your own unique values.
#    Keep backend/.env private; it is excluded from Git.

# 3. Seed MongoDB with Acme Engineering demo data
npm run seed

# 4. Start the backend server
npm run dev
```

The backend starts listening on `http://localhost:5000` and initializes:
- Direct Mongoose connection to `statusforge` database
- Background Escalation Worker running every 15 seconds
- Real-time Socket.IO gateway

---

### 3. Frontend Setup

Open a second terminal and navigate to the frontend directory:

```bash
cd frontend

# 1. Install frontend dependencies
npm install

# 2. Launch Vite dev server
npm run dev
```

Open your browser to:
👉 **`http://localhost:3000`**

---

## 🔑 Pre-Seeded Demo Accounts

The database seed script (`npm run seed`) populates the **Acme Engineering** organization with 4 user profiles across all RBAC roles. Set `SEED_DEFAULT_PASSWORD` in `backend/.env` before running it; use a unique password of at least 12 characters. All seeded accounts use that password.

| Role | Name | Email | Password | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Admin** | Alex Rivera | `admin@acme.com` | Value configured in `SEED_DEFAULT_PASSWORD` | Full organization control, user creation, service deletion, secret rotation |
| **Responder 1** | Sarah Chen | `sarah.ops@acme.com` | Value configured in `SEED_DEFAULT_PASSWORD` | Primary SRE on-call; can acknowledge, resolve, and trigger incidents |
| **Responder 2** | David Kim | `david.dev@acme.com` | Value configured in `SEED_DEFAULT_PASSWORD` | Backend Lead; can acknowledge, resolve, and comment in war-room |
| **Viewer** | Elena Rostova | `stakeholder@acme.com` | Value configured in `SEED_DEFAULT_PASSWORD` | Read-only access to dashboard, war-room timelines, and schedules |

> Seeded accounts no longer have shared or hard-coded passwords. Sign in with the account email and the password you configured locally. The authenticated role switcher is available from the header.

---

## 🔍 Inspecting MongoDB Data

You can inspect all persisted documents using **MongoDB Compass** or **mongosh**:

### Using mongosh
```bash
mongosh "mongodb://localhost:27017/statusforge"
```

Useful inspection queries:
```javascript
// List all collections
show collections;

// View organizations
db.organizations.find().pretty();

// View users in organization
db.users.find({}, { name: 1, email: 1, role: 1 }).pretty();

// View active unacknowledged incidents
db.incidents.find({ status: "triggered" }).pretty();

// Inspect immutable incident timeline events
db.incidentevents.find().sort({ timestamp: -1 }).limit(5).pretty();

// Inspect paging notifications
db.notifications.find().sort({ sentAt: -1 }).limit(5).pretty();

// Inspect security audit log
db.auditlogs.find().sort({ timestamp: -1 }).limit(5).pretty();
```

### Using MongoDB Compass
1. Open MongoDB Compass.
2. Connect to URI: `mongodb://localhost:27017`.
3. Select database: `statusforge`.
4. Inspect collections: `organizations`, `users`, `services`, `oncallschedules`, `escalationpolicies`, `incidents`, `incidentevents`, `notifications`, `auditlogs`.

---

## 📡 Webhook Integration & Alert Ingestion

StatusForge supports inbound webhook alerts from monitoring tools such as Datadog, Prometheus Alertmanager, Grafana, AWS CloudWatch, and PagerDuty.

### Endpoint:
```http
POST http://localhost:5000/api/v1/webhooks/services/:serviceId
```

### Required Header:
```http
X-Webhook-Secret: <SERVICE_WEBHOOK_SECRET>
```

### Sample cURL Alert:
```bash
curl -X POST "http://localhost:5000/api/v1/webhooks/services/<SERVICE_ID>" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: <SERVICE_WEBHOOK_SECRET>" \
  -d '{
    "title": "CRITICAL: Envoy Ingress Rate-Limiter Segfaulting on Edge Cluster",
    "description": "503 error rate currently at 48% across edge clusters in us-east-1.",
    "severity": "P1",
    "status": "firing",
    "externalId": "dd-alert-99214",
    "source": "datadog_webhook"
  }'
```

### Webhook Capabilities:
1. **Deduplication:** Repeated alert pings with identical `externalId` append a timeline event rather than duplicating open incidents.
2. **Auto-Assignment:** Automatically resolves the service's active on-call responder and pages them.
3. **Health State Transition:** P1 alerts transition the service to `outage`, and P2 alerts transition it to `degraded`.
4. **Auto-Recovery:** An incoming webhook with `"status": "resolved"` automatically resolves the open incident and restores the service status to `operational`.

---

## ⚡ Automated Escalation Engine

StatusForge runs a background escalation worker (`backend/src/services/escalation.worker.ts`) every 15 seconds:
1. Scans MongoDB for any incident with `status: 'triggered'`.
2. Evaluates the service's `EscalationPolicy` step ladder and timeout settings.
3. If an incident remains unacknowledged beyond the step's `timeoutMinutes`:
   - Advances to the next escalation step (`currentEscalationStep + 1`).
   - Reassigns the incident to the next user in the chain.
   - Appends an immutable `IncidentEvent` (`type: 'escalated'`).
   - Dispatches a new `Notification` document.
   - Emits a real-time WebSocket event to the organization room (`org:<id>`).
4. **Halting Escalation:** When a responder clicks **Acknowledge** (`POST /api/v1/incidents/:id/acknowledge`), the incident status changes to `'acknowledged'`, which immediately halts the timer.

---

## 🌐 Public Status Page

StatusForge generates an unauthenticated, zero-PII status page for each organization:

👉 **`http://localhost:3000/status/acme-engineering`**

- **Real-Time WebSockets:** Automatically joins `status:acme-engineering` and updates whenever an incident or service status changes.
- **Privacy Protection:** Displays only sanitized public service states, uptime metrics, and public incident updates without leaking internal emails, phone numbers, or user IDs.

---

## 🔒 Multi-Tenant Boundary Enforcement

Every authenticated backend route scopes database read and write operations using `req.user.organizationId`:
- Incidents: `Incident.find({ organizationId: req.organizationId })`
- Services: `Service.find({ organizationId: req.organizationId })`
- Users: `User.find({ organizationId: req.organizationId })`
- Schedules & Policies: Scoped strictly to the authenticated organization.
- Cross-tenant data leakage is strictly prohibited at both the database and routing layers.
