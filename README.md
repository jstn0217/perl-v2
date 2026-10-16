# Perfect Learning (AMoS) Rebuild

This repo contains the mock-first Perfect Learning (AMoS) rebuild described in `CLAUDE.md`.

## Apps

- `perl-api`: Express + TypeScript API scaffold with mock repositories wired by default
- `perl-rfid-frontend`: React + Vite frontend for the school-branded mock shell

Frontend UI organization:

- `src/components/`: small reusable UI primitives
- `src/modules/`: composed reusable interface sections built from components
- `src/pages/`: routed screens that coordinate modules, components, and page-level data

Full record lists use shared pagination, record create/edit flows open in shared modal dialogs, and authenticated destinations are available from the hamburger navigation drawer. Bounded dashboard or live-monitor previews remain short and lead to their full paginated page. See [Scalable Frontend TODO](planning/SCALABLE-FRONTEND-TODO.md) for the API pagination migration and future component thresholds.

## Local development

1. Copy `perl-api/.env.example` to `perl-api/.env`
2. Copy `perl-rfid-frontend/.env.example` to `perl-rfid-frontend/.env`
3. Install dependencies in each app with `npm install`
4. Start the API with `npm run dev` inside `perl-api`
5. Start the frontend with `npm run dev` inside `perl-rfid-frontend`

For the mock-first flow, leave `DATA_LAYER=mock`.

Image uploads default to `IMAGE_STORAGE=mock` for tests and UI development. To store school logos and user photos in AWS S3, configure:

```text
IMAGE_STORAGE=s3
AWS_REGION=ap-southeast-1
S3_BUCKET=your-image-bucket
S3_PUBLIC_BASE_URL=https://your-public-bucket-or-cdn.example.com
```

The AWS SDK uses its normal credential chain, including `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` locally or an IAM role in AWS. `S3_PUBLIC_BASE_URL` is optional; without it, the API stores the bucket's regional S3 URL. Uploaded objects must be readable through the resulting URL. Uploads accept JPEG, PNG, or WebP images up to 5 MB.

There is an optional root Docker setup for the current app:

```bash
docker compose up --build
```

It uses the single root [Dockerfile](/Users/jmendoza/Desktop/Documents/Work_Code/sandbox/perl-v2/Dockerfile) and starts both `perl-api` and `perl-rfid-frontend` inside one container for easier local tracking.

For the current shipped mock-first flow, leave `DATA_LAYER=mock`. Phase 6 API persistence is now wired for PostgreSQL as well, so `DATA_LAYER=db` is runnable end to end for the backend and uses the same seeded schools, users, and devices as the mock layer.

Root runtime environment defaults:

```text
PORT=4000
DATA_LAYER=mock
IMAGE_STORAGE=mock
INITIAL_SYSTEM_ADMIN_EMAIL=system@perl.system
INITIAL_SYSTEM_ADMIN_PASSWORD=SystemAdmin123!
INITIAL_SUPPORT_EMAIL=support@perl.system
INITIAL_SUPPORT_PASSWORD=Support123!
DB_HOST=postgres
DB_PORT=5432
DB_USER=perl
DB_PASSWORD=perl_dev_password
DB_NAME=perl
DB_SSL=false
WAIT_FOR_DB=auto
```

`WAIT_FOR_DB=auto` means the root startup script only waits for the database when `DATA_LAYER=db`. You can also force the wait with `WAIT_FOR_DB=true`.

To run the root stack against PostgreSQL:

```bash
DATA_LAYER=db docker compose up --build
```

The compose stack will:
- start `postgres`
- wait for the database port to become reachable
- initialize the schema and seed the sample schools if the database is empty
- start the single `perl-app` container from the root Dockerfile

API database helpers:

```bash
cd perl-api
npm run db:seed
npm run db:reset
```

`npm run db:seed` creates the Phase 6 schema and seeds the sample data when the database is empty. `npm run db:reset` truncates the Phase 6 tables and reloads the same seed set used by the mock repositories.

Phase 8 compliance and operations references:

- [Privacy Impact Assessment](planning/compliance/DPIA.md)
- [Data Processing Agreement template](planning/compliance/DPA-TEMPLATE.md)
- [Security incident and personal data breach runbook](planning/compliance/INCIDENT-RESPONSE.md)

School-admin data operations are available under `/api/admin/schools/:schoolId`: school export, school backup/restore, school operational-data purge, individual user export/erasure, device-key rotation/revocation, and paginated audit logs. Credential hashes are excluded from portable exports; recovery backups retain hashes and must be handled as sensitive encrypted material.

Record pages provide filters and CSV export using the selected filters. Attendance and action-log
downloads include every matching role-authorized record, not only the current page. The People page
also supports CSV import using `/templates/people-import-template.csv`; imports are limited to 500
rows, report validation errors by source row, and use semicolon-separated student emails for guardian
links.

Student IN/OUT scans can notify every active linked guardian with a valid Philippine mobile number.
Staff and school-admin card scans are recorded without sending guardian messages. Every delivery
attempt is retained under **SMS delivery** with queued, sent, failed, or skipped status, Semaphore
response identifiers, network/status data, and an error reason where applicable. School SMS
subscriptions are managed from **School accounts** by `SYSTEM_ADMIN`; `SUPPORT` can inspect the
subscription state and delivery records but cannot change them.

Local development uses the mock SMS gateway. To use Semaphore:

```text
SMS_ENABLED=true
SMS_PROVIDER=semaphore
SEMAPHORE_API_KEY=replace-with-your-key
SEMAPHORE_SENDER_NAME=SEMAPHORE
SEMAPHORE_API_URL=https://api.semaphore.co/api/v4/messages
```

The school subscription must also be enabled. Production startup rejects an enabled SMS
configuration unless the Semaphore provider and a non-placeholder API key are configured.

School `ADMIN` accounts remain bound to the `schoolId` in their signed session. Platform
`SYSTEM_ADMIN` and `SUPPORT` accounts use a separately protected cross-school workspace.
`SYSTEM_ADMIN` can provision schools and administer a selected school; `SUPPORT` can inspect the
same school records in read-only mode. Both platform roles can use browser scan simulation and the
saved-record diagnostic preview; school staff/admins see the live device stream without those tools.

Production startup is fail-closed. With `NODE_ENV=production`, API requires `DATA_LAYER=db`, HTTPS-only `ALLOWED_ORIGINS`, `COOKIE_SECURE=true`, non-default JWT/DB secrets, `DB_SSL=true`, and non-default, distinct system-admin and support bootstrap credentials. Development defaults remain available only outside production.

## Mock login

The public homepage and login do not expose a school selector or tenant list. The API resolves the
school from the verified account record, stores that `schoolId` in the signed JWT, and uses the
session scope as the backend source of truth. School-user emails are globally unique for this reason.

How to log in with mock data:

1. Open the login page.
   Local Vite frontend: `http://localhost:5173/login`
   Docker runtime: `http://localhost:4000/login`
2. Enter a seeded account email.
3. Use the shared school-account mock password: `Password123!`

Seeded school slugs and sample logins:

- `st-marys`
  - `admin@stmarys.edu` as `ADMIN`
  - `staff@stmarys.edu` as `STAFF`
  - `student@stmarys.edu` as `STUDENT`
  - `guardian@stmarys.edu` as `GUARDIAN`
- `riverside-tech`
  - `admin@riversidetech.edu` as `ADMIN`
  - `staff@riversidetech.edu` as `STAFF`
  - `student@riversidetech.edu` as `STUDENT`
  - `guardian@riversidetech.edu` as `GUARDIAN`
- `golden-harvest`
  - `admin@goldenharvest.edu` as `ADMIN`
  - `staff@goldenharvest.edu` as `STAFF`
  - `student@goldenharvest.edu` as `STUDENT`
  - `guardian@goldenharvest.edu` as `GUARDIAN`

Admin login examples:

```text
Email: admin@stmarys.edu          Password: Password123!
Email: admin@riversidetech.edu    Password: Password123!
Email: admin@goldenharvest.edu    Password: Password123!
```

Platform logins:

```text
Email: system@perl.system         Password: SystemAdmin123!   Role: SYSTEM_ADMIN
Email: support@perl.system        Password: Support123!       Role: SUPPORT
```

The development-only system-admin account opens **School accounts** and uses **Add school** to
provision a school name, unique slug, contact email, and initial theme. The support account opens the
same directory without provisioning or school-mutation controls. Configure non-default
`INITIAL_SYSTEM_ADMIN_EMAIL`, `INITIAL_SYSTEM_ADMIN_PASSWORD`, `INITIAL_SUPPORT_EMAIL`, and
`INITIAL_SUPPORT_PASSWORD` values before initializing an empty production database.

Platform sessions have no home `schoolId`. They select an explicit school inside the protected
workspace; context access and system-admin changes are written to the global action log.

Mock attendance card UIDs currently seeded for the Phase 3 monitor flow:

- `RFID-STMARYS-001`
- `RFID-STMARYS-STAFF`
- `RFID-STMARYS-ADMIN`
- `RFID-RIVERSIDE-001`
- `RFID-RIVERSIDE-STAFF`
- `RFID-RIVERSIDE-ADMIN`
- `RFID-GOLDEN-001`
- `RFID-GOLDEN-STAFF`
- `RFID-GOLDEN-ADMIN`

To simulate a device-authenticated scan after registering a device key:

```bash
node perl-api/scripts/simulate-device-scan.mjs \
  --device-key <issued-device-key> \
  --card-uid RFID-STMARYS-001
```

### Match a scanner to the live attendance screen

The scanner is matched through its registered **device key**, not by putting a scanner ID in the monitor URL.

1. Sign in as an admin for the school that will use the scanner.
2. Open **Devices**, register the scanner, and note both values returned:
   - **Device ID** identifies the scanner in the device roster and attendance records.
   - **Device key** is the one-time credential the physical scanner or simulator must send.
3. Configure the scanner to post the card UID to `POST /api/device/scan` with the key in the `X-Device-Key` header. Do not send the key in a URL or query string.
4. Open **Live monitor** while signed in to the same school. The monitor subscribes to that entire school's attendance stream.
5. When the API validates the key, it resolves the registered Device ID automatically and includes that scanner's name, location, and ID in the attendance event.

For example, the seeded St. Mary's scanner has Device ID `device-stmarys-gate`. Use the one-time key issued for that device:

```bash
node perl-api/scripts/simulate-device-scan.mjs \
  --device-key <key-issued-for-device-stmarys-gate> \
  --card-uid RFID-STMARYS-001
```

The live screen should then show the student result with scanner **St. Mary's Front Gate** and its saved location. A scanner registered under another school will not publish into this monitor, and a revoked or rotated old key will be rejected.

## Demo account

The seeded sample schools above (`st-marys`, `riverside-tech`, `golden-harvest`) are for
local mock-data development only and are cleared outside `development`/`test`. For a
persistent, presentable demo tenant — on either `DATA_LAYER=mock` or `DATA_LAYER=db` —
opt in with `SEED_DEMO_TENANT=true`:

```text
SEED_DEMO_TENANT=true
DEMO_SCHOOL_NAME=Perfect Learning Demo Academy   # default; override to customize
DEMO_SCHOOL_SLUG=perl-demo                       # default; must stay unique
DEMO_ADMIN_EMAIL=demo-admin@example.com          # required when the flag is on
DEMO_ADMIN_PASSWORD=<required; minimum 12 characters in production>
```

Seeding is idempotent by `DEMO_SCHOOL_SLUG` — re-running it (including via
`npm run db:seed` in `perl-api`) skips creation if a school with that slug already
exists, so it's safe to leave the flag set across restarts/redeploys. It works
identically against the mock and database repositories. Production boots never create
the sample schools above; the demo tenant is the only non-platform account production
seeding will create, and only when `SEED_DEMO_TENANT=true`.

See `DEPLOYMENT.md` §2/§5 for the full production bootstrap reference, including the
platform superadmin/support accounts (`INITIAL_SYSTEM_ADMIN_*` / `INITIAL_SUPPORT_*`).

## Current phase

The current implementation covers Phases 0 through 7:

- mock-by-default backend composition root
- school branding via `SchoolProfile` mock data
- Phase 2 auth with school-scoped JWT cookie sessions
- Phase 3 attendance scan flow, SSE monitor, and paginated logs
- Phase 4 admin profile and user-management flows for school-scoped branding updates and account administration
- AWS S3-backed school-logo and user-photo uploads, with mock storage available for local tests
- Phase 5 device registration, school-scoped device keys, keyed scan authorization, and the admin device-management flow
- frontend `ThemeProvider` that resolves school identity before rendering the shell
- API/frontend Docker stack with mock mode as the default

Phase 6 persistence is implemented:

- PostgreSQL-backed repository implementations under `perl-api/src/repositories/db/`
- startup schema initialization plus seed-on-empty behavior for `DATA_LAYER=db`
- a reusable database seed/reset script in `perl-api`
- the same API behavior tests runnable against either `mock` or `db` via `TEST_DATA_LAYERS`

Phase 7 controls cover CORS, JWT expiry, every authenticated route family, login/scan rate limiting, and mock/PostgreSQL parity. The dependency-audit gate is currently open because the published React Router line reports a HIGH advisory and the API development tree reports HIGH advisories through Jest transitive dependencies; production API dependencies audit clean.

Phase 8 remains in progress. Individual and school data operations, audit trails, backup/restore behavior, compliance templates, and the incident runbook exist. School-specific approvals, named incident owners, the tabletop exercise, retention/hosting decisions, and production backup verification remain required before real student data is approved. See [planning/PLAN.md](planning/PLAN.md#remaining-launch-gates).
