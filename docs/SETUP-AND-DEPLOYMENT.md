# Perfect Learning (AMoS) — Local Setup & Deployment Guide

This document covers running Perfect Learning (AMoS) locally (mock and database modes) and deploying it
safely. **Read the [Required keys for deployment](#required-keys-for-deployment) section
before any non-local deploy** — after the Phase 7 security hardening pass, the API
**refuses to start** in a non-development environment if any required secret is missing,
left at its in-source default, or too short.

- Apps: `perl-api` (Express + TypeScript) and `perl-rfid-frontend` (React + Vite)
- Data layer is swappable via `DATA_LAYER=mock|db` (see `CLAUDE.md` §3)
- Config is read once at startup in `perl-api/src/config/env.ts`

---

## 1. Prerequisites

- Node.js >= 22 (`perl-api` `engines.node`)
- npm (bundled with Node)
- For database mode / container mode: Docker + Docker Compose (bundles PostgreSQL 16)

---

## 2. Local development (mock mode — no database)

This is the default, fastest path. No database, no external services.

```bash
# API
cd perl-api
cp .env.example .env          # leave DATA_LAYER=mock, NODE_ENV=development
npm install
npm run dev                   # http://localhost:4000

# Frontend (separate terminal)
cd perl-rfid-frontend
cp .env.example .env
npm install
npm run dev                   # http://localhost:5173
```

In mock mode the app boots with seeded sample schools/users (see
`perl-api/src/repositories/mock/seeds.ts`). The default dev credentials
(`system@perl.system` / `SystemAdmin123!`, etc.) are fine here and **only** here —
`NODE_ENV=development` is the one setting that skips the production secret validation.
`NODE_ENV` must still be explicitly set (`.env.example` ships `NODE_ENV=development`); an
unset or unrecognized `NODE_ENV` fails to boot rather than silently defaulting to
development (see below).

### Useful scripts (`perl-api`)

| Command | What it does |
|---|---|
| `npm run dev` | Start API with hot reload (tsx watch) |
| `npm run build` | Type-check + compile to `dist/` |
| `npm start` | Run the compiled `dist/server.js` |
| `npm test` | Run the Jest suite (ts-jest ESM; ~a few minutes, this is normal) |
| `npm run lint` | ESLint |
| `npm run audit:check` | `npm audit --audit-level=high` |
| `npm run db:seed` / `npm run db:reset` | Seed / reset the real database (db mode) |

> Tests default to the mock layer. To also exercise the real DB layer, set
> `TEST_DATA_LAYERS=mock,db` with a reachable PostgreSQL (see `tests/helpers/dataLayer.ts`).

---

## 3. Local database mode (Docker Compose)

Runs the API, the frontend, and PostgreSQL 16 together.

```bash
# from the repo root
cp perl-api/.env.example .env         # compose reads root-level env vars
# set DATA_LAYER=db and provide real values for the keys in section 5
docker compose up --build
```

Notes:
- The `perl-app` service waits for Postgres to be healthy before starting when
  `DATA_LAYER=db` (`scripts/wait-for-postgres.sh`, gated by `WAIT_FOR_DB`).
- The Postgres port is **not** published to the host (hardened in Phase 7). Reach the DB
  through the API, or add a `docker-compose.override.yml` with a `ports:` mapping only
  when you explicitly need host-side `psql`.
- The `perl-app` container runs as the unprivileged `node` user, not root.
- Seed the database once it is up: `npm --prefix perl-api run db:seed`.

The Compose file (`docker-compose.yml`) still carries `${VAR:-default}` fallbacks so a
bare `docker compose up` works for local demos. Those fallbacks are the insecure dev
defaults — they are safe only because local runs use `NODE_ENV=development`. For any real
deployment, provide every value explicitly (next section) and set `NODE_ENV=production`.

---

## 4. Building for production

```bash
# API: compile TypeScript
npm --prefix perl-api run build      # emits perl-api/dist/
node perl-api/dist/server.js         # run with the production env vars set

# Frontend: static build
npm --prefix perl-rfid-frontend run build   # emits perl-rfid-frontend/dist/ (serve behind a CDN / static host)
```

Set `VITE_API_URL` (frontend build-time) to the public API origin. Serve the frontend
over HTTPS from an origin that is listed in the API's `ALLOWED_ORIGINS`.

---

## 5. Required keys for deployment

> **Fail-closed.** `validateRuntimeEnvironment()` (`perl-api/src/config/env.ts`) first
> requires `NODE_ENV` to be explicitly set to exactly `development`, `test`, or
> `production` — an unset, empty, or misspelled `NODE_ENV` (e.g. `staging`, a typo, or
> simply forgetting to set it) throws immediately on startup
> (`NODE_ENV must be explicitly set (development|test|production)`) and is never silently
> treated as `development`. Once `NODE_ENV=production`, the same function additionally
> validates the keys below and **throws on startup** if any is missing, still at its
> in-source default, or below its minimum length. This is deliberate: the old in-source
> defaults are public in git history and would otherwise allow session forgery.

Set `NODE_ENV=production` for a real deployment, and provide **all** of the following.

### 5.1 Secrets — must be set, non-default, and strong

| Key | Requirement | Why it matters |
|---|---|---|
| `JWT_SECRET` | Random, **>= 32 chars**, not `dev-phase-2-secret` | Signs session cookies. A known/default value lets anyone forge a `SYSTEM_ADMIN` session and take over every tenant. |
| `DB_PASSWORD` | **>= 16 chars**, not `perl_dev_password` | PostgreSQL password. |
| `INITIAL_SYSTEM_ADMIN_EMAIL` | Real address, not `system@perl.system` | Bootstrap platform-admin account. |
| `INITIAL_SYSTEM_ADMIN_PASSWORD` | **>= 16 chars**, not `SystemAdmin123!` | Bootstrap platform-admin password. |
| `INITIAL_SUPPORT_EMAIL` | Real address, not `support@perl.system`, **different from the admin email** | Bootstrap support account. |
| `INITIAL_SUPPORT_PASSWORD` | **>= 16 chars**, not `Support123!` | Bootstrap support password. |
| `SEMAPHORE_API_KEY` | **>= 16 chars** — required **only if** `SMS_ENABLED=true` and `SMS_PROVIDER=semaphore` | Sends guardian attendance SMS via Semaphore. |

Generate a strong `JWT_SECRET`, e.g.: `openssl rand -base64 48`.

Store all of these in your platform's secret manager (or a `.env` that is **never**
committed — `.env` is gitignored). Never place any secret in a URL, query string, or the
frontend build.

### 5.2 Transport / isolation flags — must be hardened in production

| Key | Production value | Why |
|---|---|---|
| `NODE_ENV` | `production` | Enables the validation above and production behavior. |
| `DATA_LAYER` | `db` | Real PostgreSQL persistence (mock is memory-only). |
| `COOKIE_SECURE` | `true` | Session cookie only sent over HTTPS. |
| `DB_SSL` | `true` | Encrypt the database connection. |
| `ALLOWED_ORIGINS` | Comma-separated **HTTPS** origins only (no wildcard) | CORS allow-list; validation rejects any non-HTTPS or empty origin. |

### 5.3 Database connection

| Key | Notes |
|---|---|
| `DB_HOST` | DB hostname (`postgres` on the Compose network; your managed-DB host otherwise). |
| `DB_PORT` | PostgreSQL port, default `5432`. (Note: `.env.example` ships `3306` — override it to `5432` for Postgres.) |
| `DB_USER` | Database user, default `perl`. |
| `DB_NAME` | Database name, default `perl`. |

### 5.4 Demo tenant

Opt-in flag that seeds one demo school plus a demo `ADMIN` account, works identically
against `DATA_LAYER=mock` and `DATA_LAYER=db`, and is idempotent by slug (re-running it —
including via `npm --prefix perl-api run db:seed` — skips creation if the slug already
exists). See `perl-api/src/repositories/seedDemoTenant.ts`.

| Key | Notes |
|---|---|
| `SEED_DEMO_TENANT` | `true` to create the demo tenant on boot/seed (default `false`). |
| `DEMO_SCHOOL_NAME` | Display name, default `Perfect Learning Demo Academy`. |
| `DEMO_SCHOOL_SLUG` | Unique slug, default `perl-demo`. |
| `DEMO_ADMIN_EMAIL` | Required when `SEED_DEMO_TENANT=true`. |
| `DEMO_ADMIN_PASSWORD` | Required when `SEED_DEMO_TENANT=true`; **>= 12 chars** in production. |

Production first boot never creates the sample schools seeded in `development`/`test`
(see `DEPLOYMENT.md` §3) — the demo tenant is the only non-platform account production
seeding creates, and only with this flag on.

### 5.5 Optional integrations

| Key | When needed |
|---|---|
| `IMAGE_STORAGE` | `s3` to store logos/photos in AWS S3 (default `mock`). |
| `AWS_REGION`, `S3_BUCKET`, `S3_PUBLIC_BASE_URL` | Required when `IMAGE_STORAGE=s3`. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN` | S3 credentials (or use an IAM role in AWS — the SDK's normal credential chain applies). |
| `SMS_ENABLED`, `SMS_PROVIDER`, `SEMAPHORE_SENDER_NAME`, `SEMAPHORE_API_URL` | Guardian SMS. Set `SMS_ENABLED=false` to disable outbound SMS entirely. |
| `JWT_COOKIE_NAME` | Session cookie name, default `perl_session`. |
| `JWT_EXPIRES_IN_SECONDS` | Session lifetime, default `28800` (8h). |
| `PORT` | API listen port, default `4000`. |
| `LOGIN_RATE_LIMIT_*`, `DEVICE_SCAN_RATE_LIMIT_*` | Tune rate-limit windows/attempts (sane defaults provided). |

### 5.6 Minimal production `.env` example

```bash
NODE_ENV=production
DATA_LAYER=db
PORT=4000

# --- secrets (use your secret manager; values below are placeholders) ---
JWT_SECRET=<openssl rand -base64 48>
DB_PASSWORD=<>=16-char random>
INITIAL_SYSTEM_ADMIN_EMAIL=admin@yourschoolgroup.example
INITIAL_SYSTEM_ADMIN_PASSWORD=<>=16-char random>
INITIAL_SUPPORT_EMAIL=support@yourschoolgroup.example
INITIAL_SUPPORT_PASSWORD=<>=16-char random>

# --- transport / isolation ---
COOKIE_SECURE=true
DB_SSL=true
ALLOWED_ORIGINS=https://app.yourschoolgroup.example

# --- database ---
DB_HOST=your-db-host
DB_PORT=5432
DB_USER=perl
DB_NAME=perl

# --- SMS (only if enabled) ---
SMS_ENABLED=true
SMS_PROVIDER=semaphore
SEMAPHORE_API_KEY=<>=16-char key>
SEMAPHORE_SENDER_NAME=YOURSCHOOL
```

---

## 6. Deploy checklist

1. `NODE_ENV=production` and `DATA_LAYER=db` are set.
2. Every secret in §5.1 is set to a strong, non-default value (the API will refuse to boot otherwise — treat a boot failure as a missing/weak key and read the thrown message; it lists each offending key).
3. `COOKIE_SECURE=true`, `DB_SSL=true`, and `ALLOWED_ORIGINS` lists only your HTTPS frontend origin(s).
4. API served over HTTPS behind your load balancer/reverse proxy; frontend served over HTTPS from an allowed origin.
5. Database provisioned and reachable; run `npm --prefix perl-api run db:seed` once to create the bootstrap accounts.
6. `npm --prefix perl-api run build` succeeds and `npm --prefix perl-api run audit:check` is clean of HIGH/CRITICAL.
7. Rotate the bootstrap `SYSTEM_ADMIN`/`SUPPORT` passwords after first login.
8. Devices: provision device keys per school from the admin UI; keep RFID readers on an isolated/trusted network segment (firmware transport is plaintext HTTP today — see the security follow-ups in `planning/CHANGELOG.md`).

---

## 7. Related docs

- `CLAUDE.md` — build plan, architecture (ports & adapters), phases, non-negotiable standards
- `planning/CHANGELOG.md` — change history, including the Phase 7 security hardening entries
- `README.md` — quick app overview and S3/image-upload notes
