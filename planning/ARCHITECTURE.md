# PERL Architecture

This document describes the current, implemented architecture of the rebuilt PERL platform — not the roadmap (see `CLAUDE.md` for phase history and `PLAN.md` for status). It is grounded in the actual code under `perl-api/src/` and `perl-rfid-frontend/src/` as of the PostgreSQL persistence migration (see `planning/CHANGELOG.md`).

## 1. Ports & Adapters Layering

The API follows a strict one-directional dependency chain:

```
routes/  →  controllers/  →  services/  →  repositories/interfaces/  →  repositories/mock/ | repositories/db/
```

- **Routes** (`perl-api/src/routes/*.ts`) wire Express paths to a controller and attach the auth/rate-limit middleware chain. There are seven route groups: `authRoutes`, `attendanceRoutes`, `adminRoutes`, `schoolRoutes`, `supportRoutes`, `roleRoutes`, `publicRoutes` (plus `healthRoutes`), all mounted under `/api` in `perl-api/src/app.ts`. `publicRoutes` is the only unauthenticated group besides login/health: per-school enrollment/inquiry intake resolved by school slug, feature-toggle-gated, per-IP-per-school rate limited.
- **Controllers** (`perl-api/src/controllers/*.ts`) parse/validate HTTP input, call one or more services, and shape the HTTP response. They hold no business rules — e.g. `attendanceController.ts` resolves the request's authorized school, delegates the actual admit/deny decision entirely to `AttendanceService`.
- **Services** (`perl-api/src/services/*.ts`) hold business logic and depend only on repository *interfaces*, never on a concrete mock or database class:
  - `AuthService` — login, session shaping, self-service profile updates, role/schoolId access checks, and (see Section 3) permission-catalog access checks
  - `AttendanceService` — the admit/deny state machine, cooldown/daily-cap rules, log listing/export
  - `TenantService` — school (`SchoolProfile`) resolution, creation, and profile updates
  - `AdminService` — school-scoped user CRUD, CSV import, device/user administration surface, and custom-role assignment validation
  - `DeviceService` — device registration, one-time key issuance, key rotation/revocation, key authentication
  - `AuditService` — writes/reads the `audit_logs` action trail
  - `NotificationService` — turns admitted student scans into guardian SMS delivery attempts
  - `SchoolDataService` — school-scoped export/backup/restore and erasure operations (Phase 8 compliance)
  - `ImageService` — validates and stores uploaded logo/user photos through `IImageStorage`
  - `RoleService` — CRUD for custom `RoleDefinition` rows: create/update/deactivate/reactivate, name uniqueness, and the virtual built-in role list
  - `SubmissionService` — enrollment/inquiry intake: per-type validation, status/notes updates, and the public-create path that enforces the school's `enrollment`/`inquiry` feature toggles
- **Repository interfaces** (`perl-api/src/repositories/interfaces/`) are narrow, feature-specific ports: `ITenantRepository`, `IUserRepository`, `IPlatformUserRepository`, `IAttendanceRepository`, `IDeviceRepository`, `IAuditRepository`, `INotificationRepository`, `IRoleRepository`. Services never see more than the interface they need.
- **Adapters**: `repositories/mock/*` (in-memory, seeded, used for local dev and the default test suite) and `repositories/db/*` (PostgreSQL via the `pg` driver — no ORM) each implement the exact same interfaces.

### The `DATA_LAYER` composition root

`perl-api/src/repositories/index.ts` is the single place that switches on `DATA_LAYER`:

```ts
export const createRepositories = (dataLayer: DataLayer = env.dataLayer): RepositorySet => {
  if (dataLayer === 'mock') return createMockRepositories();
  return createDbRepositories();
};
```

- `env.dataLayer` (`perl-api/src/config/env.ts`) resolves `DATA_LAYER=mock|db` from the environment, defaulting to `mock`.
- `initializeRepositoryLayer()` only runs `initializeDatabase()` (schema creation + seed-if-empty, `perl-api/src/repositories/db/schema.ts`) when `dataLayer === 'db'`; mock mode needs no bootstrap.
- `resetRepositoriesForTests(dataLayer)` gives both layers an identical reset/reseed hook so the same behavioral test suite (`perl-api/tests/`) can run against either backend via `TEST_DATA_LAYERS`.
- No code outside this file branches on `DATA_LAYER` — controllers and services are handed a `RepositorySet` and never know which adapter backs it. This is what makes the mock-to-Postgres swap a config change, not a rewrite.

When `DATA_LAYER=db`, connections are pooled once via `perl-api/src/repositories/db/pool.ts` (`pg.Pool`, max 10 connections, SSL optional per `DB_SSL`).

## 2. Tenant / School Branding Model

Every school is a `SchoolProfile` (`perl-api/src/types/SchoolProfile.ts`), owned by `ITenantRepository`/`TenantService`:

- Identity: `id`, `slug`, `name`, `contactEmail`
- Branding: `logoUrl`, `theme.{primaryColor,secondaryColor,accentColor}` (hex, validated in `TenantService.createSchool`)
- Institution details (added post-launch): `address`, `phone`, `timezone` (default `Asia/Manila`), `academicYearLabel`, `depedSchoolId`
- SMS settings: `smsEnabled`, `smsSenderName`

Resolution never happens client-side: the backend derives `schoolId` from the verified session (JWT), fetches the `SchoolProfile` server-side, and the frontend `ThemeProvider` (`perl-rfid-frontend/src/providers/ThemeProvider.tsx`) applies `theme.*` as CSS custom properties (`--school-primary`, `--school-secondary`, `--school-accent`) before the authenticated shell renders — there is no public school selector or client list.

## 3. Role Model

Two independent role universes, both carried in the signed JWT:

**School-scoped roles** (`schoolId` is non-null, enforced server-side on every request):

| Role | Scope |
|---|---|
| `ADMIN` | Full management of their own school (profile, users, devices, exports) |
| `STAFF` | Non-student card holder; can view the live monitor and school attendance |
| `STUDENT` | RFID card holder; sees only their own attendance |
| `GUARDIAN` | Notification recipient; sees only their linked student(s)' attendance |

**Platform-scoped roles** (`schoolId: null`, must select an explicit, audited target school for any cross-school action — `perl-api/src/routes/supportRoutes.ts`, `perl-api/src/auth/permissions.ts`):

| Role | Scope |
|---|---|
| `SYSTEM_ADMIN` | Provisions new schools, administers any selected school |
| `SUPPORT` | Read-only cross-school inspection, global audit log, monitor diagnostics |

`perl-api/src/auth/permissions.ts` still centralizes the platform-only role sets used by route guards that never change per user (`systemAdministrationRoles`, `platformSupportRoles`, `monitorDiagnosticRoles`, `isPlatformRole`) — those stay hardcoded, unchanged.

### Permission catalog and custom roles

School-scoped access (everything `schoolReadRoles`/`schoolManagementRoles`/`liveMonitorRoles` used to gate directly) is now resolved through a fixed permission catalog instead of a raw role-list check:

- **`perl-api/src/auth/permissionCatalog.ts`** — the fixed registry of permission keys (`school.records.read`, `school.profile.manage`, `school.users.manage`, `school.devices.manage`, `school.data.manage`, `monitor.live`), one per real enforcement point in `adminRoutes.ts`/`attendanceController.ts`. Platform-only capabilities (support workspace, provisioning, role management itself) are intentionally **not** catalog entries — they stay hardcoded to `SYSTEM_ADMIN`/`SUPPORT` via `requireUserRole`.
- **`RoleDefinition`** (`perl-api/src/types/Role.ts`, persisted in `role_definitions` — see `DATA-MODEL.md`) — an admin-editable `{ name, baseRole: 'ADMIN'|'STAFF', permissions[], isActive }` row that a school's `ADMIN`/`STAFF` user can be assigned to via `users.role_definition_id`. Built-in roles (`ADMIN`, `STAFF`, `STUDENT`, `GUARDIAN`, `SYSTEM_ADMIN`, `SUPPORT`) are never persisted rows — they are computed virtual `RoleListItem`s (`perl-api/src/auth/rolePermissions.ts`) so they can never drift or be edited through the API.
- **`resolveUserPermissions(user, roleRepository)`** (`perl-api/src/auth/rolePermissions.ts`) is the single source of truth for a user's effective permission set: `SYSTEM_ADMIN` gets every catalog key, `SUPPORT` gets a fixed read-only subset (`school.records.read`, `monitor.live`), `STUDENT`/`GUARDIAN` get none (their attendance access is role-based and self-scoped, untouched by this catalog), and `ADMIN`/`STAFF` get their assigned `RoleDefinition`'s permissions if one is active and base-role-matching, else the built-in default for their base role (`ADMIN_DEFAULT_PERMISSIONS` = every key, `STAFF_DEFAULT_PERMISSIONS` = `['monitor.live']` — both exact reproductions of the pre-catalog behavior, so an unassigned user's access never changes).
- **`requirePermission(authService, roleRepository, key)`** (`perl-api/src/middleware/authMiddleware.ts`) is `requireRole`'s permission-catalog counterpart: same schoolId-scoping behavior (a token's `schoolId` must match the route's `:schoolId` unless the caller is a platform role), but it checks catalog-key membership in the resolved permission set instead of raw-role membership in a fixed list. `adminRoutes.ts` uses it for every school-scoped route; `attendanceController.streamEvents` calls `resolveUserPermissions` directly (its schoolId comes from the session/query, not a route param, so it doesn't fit the route-middleware shape).
- **Role management API** (`perl-api/src/routes/roleRoutes.ts`, mounted at `/api/support/roles` and `/api/support/permissions/catalog`) — `SYSTEM_ADMIN`-only create/update/deactivate/reactivate, `SYSTEM_ADMIN`+`SUPPORT` read. No hard delete. Deactivation is blocked while any user is still assigned to the role (`IUserRepository.countByRoleDefinitionId`) rather than letting them silently fall back to defaults. Every mutation is audited (`ROLE_CREATED`/`ROLE_UPDATED`/`ROLE_DEACTIVATED`/`ROLE_REACTIVATED`) with `schoolId: null`, since a `RoleDefinition` has no owning school (see `DATA-MODEL.md`'s note on nullable `audit_logs.school_id`).

## 4. Deployment Topology

```mermaid
flowchart LR
    subgraph Client
        Browser["Browser (perl-rfid-frontend\nReact + Vite)"]
        Device["RFID scanner firmware\n(ESP8266, perl-rfid-device)"]
    end

    subgraph API["perl-api (Express + TypeScript)"]
        Routes["routes/ -> controllers/"]
        Services["services/\n(AuthService, AttendanceService,\nTenantService, AdminService,\nDeviceService, AuditService,\nNotificationService, RoleService)"]
        Repos["repository interfaces\n(DATA_LAYER composition root)"]
        Bus["AttendanceEventBus\n(in-process EventEmitter)"]
    end

    PG[("PostgreSQL\n(schools, users, platform_users,\ndevices, attendance_logs,\naudit_logs, notification_transactions)")]
    S3[("Image storage\nAWS S3 (IMAGE_STORAGE=s3)\nor mock in dev/test")]
    SMS["SMS gateway\nSemaphore adapter (ISmsGateway)\nor mock in dev/test"]

    Browser -- "HTTPS + HttpOnly JWT cookie" --> Routes
    Device -- "POST /api/device/scan\nX-Device-Key header" --> Routes
    Routes --> Services
    Services --> Repos
    Repos -- "DATA_LAYER=db" --> PG
    Services -- "publish/subscribe per schoolId" --> Bus
    Bus -- "SSE: text/event-stream" --> Browser
    Services -- "logo/photo upload" --> S3
    Services -- "guardian attendance SMS" --> SMS
```

Runtime pieces:

- **`perl-rfid-frontend`** — React + Vite SPA, served by Vite dev server locally or bundled into the single root Docker image.
- **`perl-api`** — Express + TypeScript API, stateless aside from the in-process `AttendanceEventBus` and rate-limit counters (both per-process, acceptable for a single-instance deployment — see `SYSTEM-DESIGN.md` for why this is not yet Redis-backed).
- **PostgreSQL** — the real persistence engine for `DATA_LAYER=db` (`postgres:16-alpine` in `docker-compose.yml`), accessed directly through the `pg` driver with no ORM.
- **S3 (or mock)** — school logos and user photos, behind `IImageStorage` (`perl-api/src/storage/`); `AwsS3ImageStorage` for `IMAGE_STORAGE=s3`, `MockImageStorage` otherwise.
- **SMS gateway (Semaphore, or mock)** — guardian attendance notifications, behind `ISmsGateway` (`perl-api/src/notifications/`); `SemaphoreSmsGateway` for `SMS_PROVIDER=semaphore`, `MockSmsGateway` otherwise.
- **RFID device firmware** — talks to the API over plain HTTP(S), authenticating with a per-device key sent in the `X-Device-Key` header (never a URL query string), scoped to one school via `DeviceService`.

Both API and frontend run together from one container built off the root `Dockerfile`, orchestrated by `docker-compose.yml` (`perl-app` + `postgres` services); `scripts/docker-start.sh` starts both dev servers in that container and, when `DATA_LAYER=db`, waits for Postgres via `scripts/wait-for-postgres.sh` before booting.
