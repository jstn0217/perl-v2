# PERL Rebuild Plan

## Purpose

This document consolidates the prior planning documents into one source of truth for the rebuild. It summarizes the current legacy implementation under `existing/`, maps those findings to the mock-first rebuild in [AGENTS.md](/Users/jmendoza/Desktop/Documents/Work_Code/sandbox/perl-v2/AGENTS.md), and turns Phase 0 into an executable starting sequence.

It is intentionally evidence-based. Statements about the legacy app come from the current codebase, not just earlier roadmap text.

## Current Repo State

- The repo root does not yet contain the rebuilt app. It currently contains planning documents plus a legacy implementation under `existing/`.
- `AGENTS.md` says Phase 0 has not started yet.
- `planning/CHANGELOG.md` currently records planning-level history and roadmap revisions.

## Legacy System Inventory

The old app is split into four parts:

1. `existing/perl-api`
   An Express + Sequelize API with MySQL/Postgres-capable config, JWT auth, attendance logging, device endpoints, file upload support, and websocket handling embedded in the API process.
2. `existing/perl-rfid-frontend`
   A React + Vite frontend using MUI, Redux Toolkit, React Router, Axios, and websocket client support.
3. `existing/perl-ws`
   A separate websocket example project that appears to be a standalone experiment, not a coherent production service.
4. `existing/perl-rfid-device`
   Arduino/ESP8266 firmware for scanning RFID cards and calling the API directly over HTTP.

## What The Existing App Already Tells Us About The Domain

Despite the technical debt, the legacy app is useful as domain evidence. It shows that the system already revolves around:

- `School`
  Fields include school name, logo URL, contact info, code, and SMS settings.
- `User`
  Fields include names, email, password, role, student code, student ID, guardian/emergency fields, school scoping, and a self-reference via `leader_user_id`.
- `SchoolDevice`
  Devices belong to a school and have name, description, serial number, and API key.
- `SchoolDeviceUserAttendanceLog`
  Attendance logs connect a user and a device and store a message plus a numeric type.
- `Role`
  A roles table exists, but role usage in the app is still primarily numeric constants in code.

This aligns with the rebuild direction in `AGENTS.md`: schools, users, devices, and attendance logs are the right core entities to preserve.

## Observed Legacy Architecture

### API

From `existing/perl-api/app.js` and related files:

- Express app with route groups for public, authenticated student, admin, device, and attendance access.
- Websocket broadcast is wired directly into the API process with `express-ws` and a global `Set` of connections.
- CORS is currently wide open via `app.use(cors())`.
- Sequelize is initialized eagerly on app startup.
- Controllers talk directly to Sequelize models. There is no service/repository boundary yet.

### Frontend

From `existing/perl-rfid-frontend`:

- React 19 + Vite + MUI application.
- Routing is split into public, admin, and student routers.
- Auth state is stored in Redux, but actual credentials and profile persistence rely on `localStorage`.
- The frontend is not tenant-themed yet. Branding is still effectively global and hardcoded.

### Device / Realtime

- The firmware posts scan events directly to `/device/scan/attendance`.
- Device auth uses an API key passed in the URL query string.
- Attendance events also attempt websocket notification through `WEBSOCKET_API_URL`.
- A second websocket codebase exists in `existing/perl-ws`, but it is just a generic sample app and should not be treated as an architectural foundation.

## Existing Features We Can Reuse Conceptually

These are worth preserving as product behavior, not as code to copy directly:

- School-scoped users and devices
- Admin user management
- Student attendance log viewing
- Device-driven attendance scan flow
- Guardian/emergency contact linkage
- School branding data fields such as `school_name` and `logo_url`
- Multi-school seed data patterns already present in the legacy seeders

## Existing Problems That Justify The Rebuild

The rebuild in `AGENTS.md` is warranted. The old code conflicts with the new standards in multiple concrete ways.

### Security and standards gaps

- Passwords are hashed with MD5 in `existing/perl-api/src/controllers/user/user.controller.js` and `existing/perl-api/src/utils/auth.js`.
- Frontend authentication persists tokens in `localStorage` in `existing/perl-rfid-frontend/src/hooks/API/useLogin.js` and related utilities.
- API auth depends on an `x-token` header rather than an HttpOnly cookie.
- Device auth passes the device key in the query string in `existing/perl-api/src/middleware/deviceAuth.js` and the firmware.
- CORS is currently unrestricted.

These directly contradict Section 10 of `AGENTS.md`.

## Current Security Review

The legacy implementation has several concrete security weaknesses that should directly shape the rebuild plan.

### Authentication and session handling

- Passwords are stored and verified with MD5 rather than a modern password hash.
- Browser auth stores JWTs in `localStorage` and sends them through a custom `x-token` header.
- The current login/token flow does not show a clear short-lived expiry strategy.

### Device and scan security

- Device API keys are passed in URL query parameters.
- Device credentials, Wi-Fi credentials, and host configuration are hardcoded in the legacy firmware.
- The device scan flow does not clearly enforce that the scanned user belongs to the same school as the authenticated device.

### Realtime security

- Websocket connections are effectively unauthenticated in the legacy implementation.
- Messages are broadcast globally instead of being scoped by school.
- Attendance payloads can therefore leak across tenants.

### Authorization and tenant isolation

- Some list endpoints apply school scoping, but single-record fetches and updates are not consistently scoped by school.
- The legacy app mixes authentication with incomplete object-level authorization checks.

### Abuse resistance and operational gaps

- CORS is fully open.
- Login and device scan paths do not show rate limiting.
- File uploads do not show strong size/type constraints.
- Seeded device keys are predictable plaintext values.

## Security Improvements To Carry Into The Rebuild

These should become explicit planning requirements, not just general intentions.

### Auth and session baseline

- Use bcrypt or Argon2 for all new user credentials.
- Use HttpOnly, Secure cookie-based sessions or access tokens with explicit expiry.
- Remove `localStorage` token storage from the rebuilt frontend.
- Define logout, expiry, and forced-reset behavior for migrated legacy users.

### Device authentication baseline

- Never send device credentials in query strings.
- Use headers or an equivalent explicit credential transport for device authentication.
- Rotate device secrets during migration/import.
- Require strict `device.schoolId === user.schoolId` enforcement in the scan flow.
- Treat firmware secrets as provisioned configuration, not source-controlled constants.

### Realtime baseline

- Authenticate websocket or realtime connections.
- Scope all realtime channels and payload routing by `schoolId`.
- Never globally broadcast attendance events across tenants.
- Emit only the minimum display payload needed for the scan monitor.

### Authorization baseline

- Every service method that reads or mutates school-owned data must take and enforce `schoolId`.
- Single-record reads, updates, imports, exports, and device actions must all be protected against cross-school access by ID guessing.
- Cross-school negative tests should exist for every authenticated route category.

### Abuse-resistance baseline

- Add rate limiting for login, device scan, and bulk import endpoints.
- Add request-size and upload-size limits.
- Restrict upload MIME types and validate uploaded content before persistence.
- Add audit logging for sensitive admin actions such as user imports, device registration, and password resets.

### Planning implication

Security hardening should not be treated as a late cleanup pass. Phase 2 through Phase 5 should build on secure defaults, while Phase 7 should verify and deepen those controls rather than introducing them from scratch.

### Architecture issues

- Controllers contain business logic, persistence logic, and side effects together.
- There is no repository interface layer, so mock-first development is not possible without restructuring.
- Realtime behavior is split between in-process websocket code and a separate websocket sample service.
- The API is built on a generic Express boilerplate and still carries boilerplate-era assumptions.

### Product/maintainability issues

- The frontend mixes old and newer page structures.
- Route naming is inconsistent, for example `/api/student`, `/api/admin`, `/api/device`, and `/api/attendance`.
- The dashboard appears mostly empty while other pages are more developed.
- Test coverage is thin and controller-oriented rather than behavior-oriented.
- The codebase includes firmware-library vendor code inside the main repo, which adds noise to routine maintenance.

### Docker/local-run issues

- There is no root-level Docker setup for the current repo.
- The only compose artifact found is `existing/perl-api/docker-compose.template.yml`.
- That template provisions Postgres, while the API readme and config still describe a MySQL-oriented setup and generic dialect switching.
- The current repo is therefore not yet runnable locally via a single coherent Docker workflow.

## Recommended Simplification Direction

The goal should not be to modernize the legacy app in place. It should be to extract the smallest coherent product from it and rebuild that deliberately.

### Keep in scope for the simplified app

- School branding and tenant context
- Login and role-based access
- Admin management of school users
- Device registration
- Attendance scan recording
- Attendance log viewing

### Explicitly drop or defer from the first rebuild passes

- SMS sending integration
- S3 image upload integration
- Standalone websocket service
- Arduino firmware work beyond documenting the future device contract
- Generic boilerplate leftovers
- Any billing, platform-admin, Redis, or enterprise-only work already deferred by `AGENTS.md`

## Mapping To The New Rebuild Phases

### Phase 0

Create the new app structure only. Do not port legacy code directly. Establish:

- `perl-api` and `perl-rfid-frontend`
- repository interfaces
- mock repositories
- `DATA_LAYER=mock`
- lint/test baseline

### Phase 1

Use the legacy `School` model as input for a smaller `SchoolProfile` shape:

- `id`
- `slug`
- `name`
- `logoUrl`
- `theme`
- `contactEmail`

Do not carry forward SMS fields into the Phase 1 frontend contract.

### Phase 2

Carry forward only the role concepts and school scoping:

- `ADMIN`
- `STAFF`
- `STUDENT`
- `GUARDIAN`

Replace:

- MD5 with bcrypt
- `localStorage` token flow with JWT in HttpOnly cookie
- direct model access with `AuthService` + `IUserRepository`

### Phase 3

Preserve the scan-flow product behavior, but simplify the implementation:

- simulate device scan via HTTP
- centralize admit/deny rules in `AttendanceService`
- use in-process eventing or polling only
- do not introduce the legacy standalone websocket server

### Scan-to-Display Latency Requirement

The rebuilt system should explicitly optimize the path from RFID scan to monitor display. The goal is not just correctness, but low perceived latency for the guard/admin screen.

### Preferred event flow

The scan monitor should use a single-roundtrip display path:

1. device posts scan UID to the backend
2. backend validates device and school scope
3. backend resolves the student and evaluates admit/deny in `AttendanceService`
4. backend records attendance
5. backend immediately emits a school-scoped realtime event with the display payload already included
6. frontend updates the scan monitor from that event without making a second fetch for student details

The realtime event should carry enough data for immediate rendering, for example:

- student display name
- attendance verdict
- timestamp
- school-scoped identifiers
- image URL for a thumbnail-sized student photo, or equivalent cached image reference

### Latency optimization rules

- Do not emit only `studentId` and then make the frontend fetch profile details before showing the result.
- Keep HTTP scan handling and realtime broadcast in the same backend process.
- Use in-process event emission first; defer Redis or any external fan-out layer until real load justifies it.
- Keep the synchronous scan path minimal: validate device, resolve student, evaluate, persist, emit. Defer all non-essential side effects.
- Use optimized student thumbnails for the scan monitor rather than original-size images.
- Let the frontend show a fast fallback state immediately, then swap in the image if it is not already cached.
- Scope realtime channels by `schoolId` so broadcasts stay tenant-isolated without extra filtering work on the client.

### Performance target

For the rebuild, the design target should be:

- scan verdict visible almost immediately after backend processing completes
- no extra client roundtrip required to show the student card
- image loading treated as a display optimization problem, not part of the core verdict path

This should be treated as a Phase 3 acceptance concern, not a later optimization pass.

### Phase 4 and 5

Keep admin profile editing, user management, and device registration, but rebuild them with service-layer school scoping from day one.

### User Management Import/Export

User management should include school-scoped import and export capabilities as part of the admin workflow.

### Scope

- school admins can export their own school's user records
- school admins can import user records only into their own school
- import/export must respect `schoolId` scoping in the service layer, not just the UI
- the feature should support bulk admin operations without requiring direct database access

### Recommended format

- Use CSV as the primary admin-facing format because it is simple for schools to edit and review.
- Optionally support JSON later for system-to-system exchange, but CSV should be the first-class format for the admin UI.

### Export requirements

- export only the current school's users
- include the fields needed for school operations, such as role, name, email, student identifiers, guardian linkage fields, and active/inactive status
- exclude secrets and internal-only fields
- use a documented column layout so imports and exports round-trip cleanly

### Import requirements

- validate file structure and required columns before applying changes
- reject cross-school assignment attempts
- support create and update behavior with clear matching rules
- report row-level validation errors back to the admin
- allow dry-run validation before commit when feasible
- never import legacy password hashes or raw device/auth secrets through this admin workflow

### Matching and update rules

The plan should avoid ambiguous bulk updates. Import logic should match users using a stable school-scoped identifier, for example:

- preferred: internal user ID when exporting then re-importing platform-generated files
- fallback: school-scoped student number or staff identifier when explicitly designated
- email alone should not be the only matching key unless the school treats it as unique and required

### Planning note

This is different from the legacy-system migration described later in this plan.

- user management import/export is an admin product feature for a single school
- legacy migration is a controlled platform-level data transition from the old system to the rebuilt one

Both should share validation and mapping utilities where practical, but they are not the same workflow.

### Phase 6

Add real database persistence only after the mock behavior is stable. For local development, this is where Docker becomes a first-class requirement. The rebuild should target MySQL to stay aligned with `AGENTS.md`, and the legacy data import path should be designed before the first production-like seed is loaded.

## Proposed Local Docker Strategy

To stay aligned with `AGENTS.md`, Docker should be introduced in two stages:

1. Phase 0 to Phase 5
   The app should run locally without a database.
   Docker is optional here and can be limited to app containers if helpful, but it should not become a hard dependency before the mock-first flow is working.
2. Phase 6 onward
   Add a root-level `docker-compose.yml` for:
   - `perl-api`
   - `perl-rfid-frontend`
   - `mysql`

Recommendation:

- Use MySQL for the rebuilt real persistence phase.
- Treat the legacy compose/template setup as reference only, not as the new baseline.
- Keep websocket behavior inside the API process initially unless actual load proves otherwise.

## Legacy Data Migration Strategy

The rebuild should not depend on the legacy schema shape, but it should make eventual migration from the old database straightforward.

### Migration goals

- move legacy school, user, device, and attendance data into the new schema with minimal manual cleanup
- preserve tenant boundaries during import
- allow repeatable dry runs in local/dev environments before any real cutover
- keep the new business rules authoritative, even if some legacy records must be normalized during import

### Recommended migration approach

Use an explicit ETL-style import pipeline rather than trying to point the new app directly at the old tables.

1. Extract legacy data from the old database into staging exports or direct read-only queries.
2. Transform the legacy records into the new canonical shapes in code.
3. Load the transformed records into the new MySQL schema through dedicated import scripts.
4. Run validation reports after import to compare record counts, per-school totals, and key relationship integrity.

This is safer than dual-writing or incremental table reuse because the old schema and the rebuilt service boundaries are intentionally different.

### Recommended migration layers

- `src/migration/legacy-read/`
  Read-only accessors for the legacy schema or exported snapshots.
- `src/migration/transforms/`
  Pure mapping functions from legacy records to new entities.
- `src/migration/load/`
  MySQL upsert/import routines for the new schema.
- `src/migration/reports/`
  Verification scripts for counts, missing relationships, and rejected rows.

### Expected entity mapping

- Legacy `School` -> new `schools`
  Keep stable identifiers where possible, generate `slug`, normalize branding/contact fields, and drop deferred fields that are no longer part of the active product contract.
- Legacy `User` -> new `users`
  Preserve school ownership, role, names, and core identity fields. Treat MD5-era passwords as non-portable credentials unless a safe migration path is explicitly defined later.
- Legacy `SchoolDevice` -> new `devices`
  Preserve school ownership and device identity fields, but rotate or re-issue device secrets during import instead of copying insecure legacy patterns forward.
- Legacy `SchoolDeviceUserAttendanceLog` -> new `attendance_logs`
  Preserve school-scoped attendance history, timestamps, device linkage, and user linkage where referential integrity can be established.

### Password and credential handling

Do not copy legacy auth behavior forward blindly.

- Legacy MD5 password hashes should not become the long-term credential format in the rebuilt app.
- Preferred default: import users in a forced-reset state, then issue password setup/reset flows when the new auth system is live.
- If a compatibility migration is ever needed, it should be an explicit one-time bridge with a forced bcrypt rehash on first successful login, not a permanent dual-hash design.
- Device API keys should be rotated on import into the new system.

### Cutover strategy

When the rebuild reaches real persistence:

1. Run the importer repeatedly against sample or staging copies of the legacy database.
2. Fix mapping gaps before any production cutover.
3. Perform a final export/import during a planned maintenance window.
4. Validate counts and school-level totals immediately after import.
5. Keep the legacy system read-only until the new system is accepted.

### Planning implication

`AGENTS.md` is the source of truth and already names MySQL in Phase 6. Planning artifacts should stay aligned with that choice until an explicit roadmap change is made there first.

## Recommended Deliverables Before Development Starts

Before writing feature code, the repo should gain:

- a `planning/` folder with this plan
- a clean root structure for the new app, separate from `existing/`

## Working Assumptions For The Rebuild

- `existing/` is reference material, not the codebase to evolve in place.
- The rebuild should preserve product intent, not legacy implementation details.
- The first usable product should be a simpler multi-tenant demo running on mock data.
- Local Docker support is required eventually, but the first hard requirement is a clean mock-first architecture.

## Cross-Cutting List Pagination Rule

All list-fetching behavior in the rebuilt system should use pagination by default.

### Applies to

- API endpoints that return collections
- admin tables and dashboards
- attendance logs
- user lists
- device lists
- any future school-scoped record listings

### Requirements

- do not ship unbounded list endpoints for normal product flows
- require `limit` and `offset` or an equivalent paginated contract on list APIs
- define sensible default page sizes even when the client does not specify one
- return pagination metadata needed by the frontend, such as total count or next-page indicators
- keep filtering, sorting, and pagination compatible with `schoolId` scoping

### Planning implication

Pagination should be treated as a baseline contract, not a later optimization. New list features should be designed as paginated from the first implementation pass.

## Immediate Recommendation

Start Phase 0 from scratch at the repo root, keep `existing/` untouched as reference, and treat the legacy code as a source for:

- field names worth preserving
- user flows worth preserving
- anti-patterns that the new architecture must not repeat

## Phase 0 Execution Plan

## Purpose

This section turns `AGENTS.md` Phase 0 into an executable sequence for the rebuild.

It is intentionally narrow: this is not the full product roadmap. It is the start plan for creating a clean, maintainable foundation that replaces the legacy structure in `existing/`.

## Phase 0 Goal

Per `AGENTS.md`, Phase 0 is:

> an empty-but-running app with the ports-and-adapters skeleton in place, no features yet

That means Phase 0 is complete only when:

- a new backend app exists at the repo root
- a new frontend app exists at the repo root
- both boot locally without a database
- mock repositories are wired by default
- the code structure already supports the later mock-to-db swap

## Constraints From AGENTS.md

These constraints govern the implementation:

- Do not continue feature work from the legacy app in place.
- Do not jump ahead to Phase 1 or later features.
- Mock data first.
- Repository interfaces must exist before real persistence.
- `DATA_LAYER` must default to `mock`.
- Every change must be logged in `planning/CHANGELOG.md`.

## Deliverables

Phase 0 should create exactly these initial deliverables.

### Backend

- `perl-api/`
- `perl-api/package.json`
- `perl-api/src/app.ts` or `perl-api/src/app.js`
- `perl-api/src/server.ts` or `perl-api/src/server.js`
- `perl-api/src/config/`
- `perl-api/src/repositories/interfaces/`
- `perl-api/src/repositories/mock/`
- `perl-api/src/repositories/index.ts` or equivalent composition root
- `perl-api/src/services/`
- `perl-api/src/routes/`
- `perl-api/src/controllers/`
- backend lint config
- backend Jest config

### Frontend

- `perl-rfid-frontend/`
- `perl-rfid-frontend/package.json`
- `perl-rfid-frontend/src/main.tsx`
- `perl-rfid-frontend/src/App.tsx`
- `perl-rfid-frontend/src/components/`
- `perl-rfid-frontend/src/providers/`
- frontend lint config

### Root-level support files

- root `.gitignore` updates if needed
- root `.env.example` or per-app examples
- documentation for local startup

## Recommended Technology Choices

These choices keep the rebuild simple and aligned with the current repo direction.

### Backend

- Node.js + Express
- TypeScript preferred for the rebuild
- Jest for tests
- `supertest` for API integration tests once routes exist
- no ORM yet in Phase 0

### Frontend

- React + Vite + TypeScript
- minimal routing only if needed for boot verification
- no Redux unless Phase 1 or later proves it necessary

### Why simplify here

The legacy frontend already uses Redux, MUI, websocket helpers, and a larger page structure, but none of that is required to satisfy Phase 0. Pulling those dependencies in immediately would violate the Phase 0 intent.

## Proposed File Structure

Backend target:

```text
perl-api/
  package.json
  tsconfig.json
  src/
    app.ts
    server.ts
    config/
      env.ts
    controllers/
    routes/
      healthRoutes.ts
    services/
    repositories/
      interfaces/
        ITenantRepository.ts
        IUserRepository.ts
        IAttendanceRepository.ts
        IDeviceRepository.ts
      mock/
        MockTenantRepository.ts
        MockUserRepository.ts
        MockAttendanceRepository.ts
        MockDeviceRepository.ts
      index.ts
  tests/
```

Frontend target:

```text
perl-rfid-frontend/
  package.json
  vite.config.ts
  tsconfig.json
  src/
    main.tsx
    App.tsx
    components/
    providers/
```

## Composition Root Requirement

Phase 0 should establish the pattern that later phases rely on:

- app startup reads `DATA_LAYER`
- `DATA_LAYER=mock` is the default
- repository instances are created in one place
- services depend on repository interfaces only

Nothing outside the composition root should switch on `DATA_LAYER`.

## Minimum Runtime Behavior For Phase 0

The system does not need business features yet, but it does need proof of life.

### Backend proof

- API starts successfully without any database process
- health endpoint responds successfully, for example `/ping` or `/health`
- repository composition initializes with mock implementations

### Frontend proof

- Vite app starts successfully
- a basic page renders
- the page can display a placeholder confirming the rebuild shell is active

## Testing Scope For Phase 0

Phase 0 should stay intentionally small.

Required:

- test runner configured for backend
- at least one smoke test or placeholder test proving the test setup runs

Optional:

- frontend test setup

Not required yet:

- business-rule tests
- feature integration tests
- database tests

## Docker Plan Across Phases

The simplified app should run locally on Docker, but that requirement should be satisfied deliberately, not prematurely.

### Phase 0 recommendation

Do not block Phase 0 on a full Docker stack. Instead:

- ensure both apps can run locally without DB dependencies
- keep environment variables simple
- avoid architecture choices that make Docker harder later

### Phase 6 recommendation

Add the first root-level production-like local stack:

- `docker-compose.yml`
- `perl-api` service
- `perl-rfid-frontend` service
- `mysql` service

## Explicit Non-Goals For Phase 0

Do not add the following yet:

- real database models
- migrations
- Sequelize or Prisma wiring
- authentication flows
- attendance business rules
- websocket implementation
- device simulation
- file uploads
- SMS integration
- S3 integration
- admin UI
- controller-heavy business logic
- standalone websocket sample service
- eager database initialization at app startup

## Legacy-to-Rebuild Mapping

Use the legacy app only as input for naming and domain extraction.

### Preserve as concepts

- schools
- users
- devices
- attendance logs
- school scoping

### Do not preserve as implementation

- MD5 password hashing
- `localStorage` token auth
- `x-token` header design
- query-string device keys

## Definition Of Done For Phase 0

Phase 0 is done when all of the following are true:

1. `perl-api` exists and starts locally without a database.
2. `perl-rfid-frontend` exists and starts locally without a database.
3. repository interfaces exist for tenants, users, attendance, and devices.
4. mock repository implementations are wired by default.
5. `DATA_LAYER` defaults to `mock`.
6. linting and backend test runner are configured.
7. `planning/CHANGELOG.md` records the work.

## Recommended Next Action

Start the rebuild by scaffolding:

1. `perl-api`
2. `perl-rfid-frontend`
3. repository interface folders
4. mock composition root
5. boot verification endpoints and placeholder UI
