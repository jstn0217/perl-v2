# Perfect Learning (AMoS) — Production Deployment Guide

This is the production deployment runbook for Perfect Learning (AMoS). It extends
`docs/SETUP-AND-DEPLOYMENT.md` (local development and the full environment-variable
reference) with the production-specific steps, the demo-account bootstrap, and the
current known limitations. Where the two documents disagree, this one wins.

**Deployment shape:** one Node.js API process (`perl-api`, Express), one static frontend
bundle (`perl-rfid-frontend`, React/Vite) served from a static host or CDN, and one
PostgreSQL 16 database. There is no production Docker image in this repo — the included
`Dockerfile` and `docker-compose.yml` run dev servers and are for local development only.

---

## 1. Prerequisites

- Node.js >= 22 on the API host
- PostgreSQL 16 (managed service recommended; enable SSL)
- An HTTPS domain for the frontend and one for the API (or one domain with a reverse
  proxy routing `/api` to the API process)
- A static host/CDN for the frontend with SPA fallback support (all paths must rewrite
  to `index.html` — the app uses `BrowserRouter`)

---

## 2. Required environment variables (API)

The API validates its configuration at startup and **refuses to boot** if anything below
is missing, left at a dev default, or too weak. `NODE_ENV` must be **explicitly** set to
`development`, `test`, or `production` — an unset `NODE_ENV` is a hard startup error
(this closes the earlier gap where an unset value silently selected development mode and
skipped all validation).

### Secrets — generate strong values, store in a secret manager

| Variable | Requirement |
|---|---|
| `JWT_SECRET` | Random, >= 32 chars. Generate: `openssl rand -base64 48` |
| `DB_PASSWORD` | >= 16 chars, not the dev default |
| `INITIAL_SYSTEM_ADMIN_EMAIL` | Real address for the platform superadmin |
| `INITIAL_SYSTEM_ADMIN_PASSWORD` | >= 16 chars |
| `INITIAL_SUPPORT_EMAIL` | Real address, different from the admin email |
| `INITIAL_SUPPORT_PASSWORD` | >= 16 chars |
| `SEMAPHORE_API_KEY` | Only if `SMS_ENABLED=true` and `SMS_PROVIDER=semaphore` |

### Hardening flags — all mandatory in production

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` (must be set explicitly) |
| `DATA_LAYER` | `db` |
| `COOKIE_SECURE` | `true` |
| `DB_SSL` | `true` |
| `ALLOWED_ORIGINS` | Comma-separated HTTPS origins of the frontend, no wildcard |

### Database connection

| Variable | Value |
|---|---|
| `DB_HOST` | Postgres hostname |
| `DB_PORT` | `5432` |
| `DB_USER` / `DB_NAME` | Your values (defaults `perl` / `perl`) |

### Demo tenant (the demo school + demo admin account)

| Variable | Value |
|---|---|
| `SEED_DEMO_TENANT` | `true` to create the demo tenant on boot/seed |
| `DEMO_SCHOOL_NAME` | Display name (default `Perfect Learning Demo Academy`) |
| `DEMO_SCHOOL_SLUG` | Unique slug (default `perl-demo`) |
| `DEMO_ADMIN_EMAIL` | Required when seeding is enabled |
| `DEMO_ADMIN_PASSWORD` | Required, >= 12 chars in production |

Optional integrations (S3 image storage, SMS, rate-limit tuning, cookie/port settings)
are documented in `docs/SETUP-AND-DEPLOYMENT.md` §5.5. The demo tenant vars themselves
are covered there in §5.4.

### Frontend build-time variable

| Variable | Value |
|---|---|
| `VITE_API_URL` | Public HTTPS origin of the API. **Baked in at build time** — set it in the build environment, not at runtime. If unset, the build ships pointing at `http://localhost:4000`. |

---

## 3. Database setup, schema, and seeding

There is no separate migration tool. The API applies its schema itself at startup
(idempotent `CREATE TABLE IF NOT EXISTS` DDL plus additive column checks, guarded by a
Postgres advisory lock, so multiple instances can boot concurrently). You only need to
provision an empty database and a user with DDL privileges for first boot.

Seeding behavior by environment:

- **`NODE_ENV=production`:** first boot creates **only** the two platform accounts
  (`SYSTEM_ADMIN` and `SUPPORT`, from the `INITIAL_*` variables) and — if
  `SEED_DEMO_TENANT=true` — one demo school with one demo `ADMIN` user. No sample data.
- **`NODE_ENV=development|test`:** first boot on an empty database also seeds the three
  sample schools with well-known passwords. These never reach a production boot.

`npm --prefix perl-api run db:seed` performs the same seeding manually and is idempotent.
**Never run `db:reset` against production** — it truncates every table.

---

## 4. Deploy steps

```bash
# 1. Build the API
npm --prefix perl-api ci
npm --prefix perl-api run build          # emits perl-api/dist/

# 2. Run the API with the production env vars set (systemd, PM2, or your platform)
node perl-api/dist/server.js
# A clean boot logs the listen port. A config problem aborts with a message
# listing every offending variable — fix and restart.

# 3. Build the frontend with the API origin baked in
VITE_API_URL=https://api.yourdomain.example npm --prefix perl-rfid-frontend ci
VITE_API_URL=https://api.yourdomain.example npm --prefix perl-rfid-frontend run build
# emits perl-rfid-frontend/dist/ — upload to your static host/CDN

# 4. Configure the static host: HTTPS, root-path hosting (no sub-path), SPA
#    fallback rewriting all routes to index.html
```

The frontend registers a service worker (PWA app shell) in production builds; it caches
only static shell assets, never `/api` traffic, so API changes take effect without a
service-worker version dance.

---

## 5. Accounts after first boot

| Account | Source | Purpose |
|---|---|---|
| Superadmin (`SYSTEM_ADMIN`) | `INITIAL_SYSTEM_ADMIN_EMAIL` / `_PASSWORD` | Provision schools, platform administration |
| Support (`SUPPORT`) | `INITIAL_SUPPORT_EMAIL` / `_PASSWORD` | Read-only cross-school support |
| Demo school admin (`ADMIN`) | `DEMO_ADMIN_EMAIL` / `_PASSWORD` (when `SEED_DEMO_TENANT=true`) | Demo tenant walkthroughs |

Log in as each once, verify access, and **rotate all three passwords immediately** via
the in-app profile/password flow. The env values are bootstrap-only.

---

## 6. Post-deploy checklist

1. API boots clean with `NODE_ENV=production` (a boot failure means a missing/weak key —
   the error message lists each one).
2. Frontend loads over HTTPS from an origin present in `ALLOWED_ORIGINS`; login works.
3. Demo admin can log in to the demo school; superadmin can access the platform
   workspace; support account is read-only.
4. All bootstrap passwords rotated.
5. Backups scheduled: `pg_dump` at minimum daily; test a restore once before go-live.
   Per-school export/backup also exists in the admin UI.
6. `npm --prefix perl-api run audit:check` clean of HIGH/CRITICAL (CI enforces this).
7. Device keys provisioned per school from the admin UI; RFID readers on a trusted
   network segment.

---

## 7. Known limitations (accepted for single-instance launch)

- **Single API instance assumed.** Rate limiting and session revocation are in-memory.
  Running more than one API instance silently weakens both — add a shared store (Redis)
  before scaling horizontally.
- **Kiosk device key storage.** The device kiosk page keeps its device key in browser
  `localStorage`. Use dedicated kiosk devices/browsers, and rotate the device key from
  the admin UI if a kiosk machine is compromised. A server-side kiosk session is the
  planned fix.
- **No CI/CD pipeline.** The GitHub Actions workflow is removed for now; run lint, tests,
  build, and `npm run audit:check` locally before deploying with the manual procedure above.
- **School restore is not transactional.** The per-school restore feature deletes and
  recreates records in separate calls; a crash mid-restore can leave partial state. Take
  a `pg_dump` before using restore against production data.

---

## 8. Related documents

- `docs/SETUP-AND-DEPLOYMENT.md` — local development, full env-var reference
- `CLAUDE.md` — architecture and build plan
- `planning/CHANGELOG.md` — change history
