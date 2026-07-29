# PERL — Multi-Tenant SaaS Attendance Platform — AGENTS.md

**Version:** 3.0 (Mock-First, Feature-by-Feature Rebuild)
**Supersedes:** v2.0 (SaaS conversion), v1.0 (single-tenant PRD)
**Status:** Active development plan
**Last Updated:** 2026

> **Read this first if you are an AI coding agent working on this repo.** This file is the source of truth for *how* we build, not just *what* we build. Every phase below is scoped to be completable and demoable on its own. Do not jump ahead to a later phase's work while an earlier phase is incomplete. Every change you make must get an entry in `planning/CHANGELOG.md` (see [Section 9](#9-changelog-policy)) — that file is how other agents (and humans) reconstruct what happened without re-reading every diff.

---

## Table of Contents

1. [What Changed and Why (Senior Review of v2.0)](#1-what-changed-and-why-senior-review-of-v20)
2. [Engineering Principles](#2-engineering-principles)
3. [Architecture: Ports & Adapters](#3-architecture-ports--adapters)
4. [Tenant / School Customization Model](#4-tenant--school-customization-model)
5. [Roles (kept intentionally simple)](#5-roles-kept-intentionally-simple)
6. [Development Phases](#6-development-phases)
7. [Testing Strategy — Don't Over-Mock](#7-testing-strategy--dont-over-mock)
8. [Deferred Work (explicitly not built yet, and why)](#8-deferred-work-explicitly-not-built-yet-and-why)
9. [Changelog Policy](#9-changelog-policy)
10. [Non-Negotiable Standards From Day One](#10-non-negotiable-standards-from-day-one)

---

## 1. What Changed and Why (Senior Review of v2.0)

v2.0 was directionally right (multi-tenant SaaS, not a single-school deployment) but it was written like a launch spec, not a build plan — it front-loaded work that has no business being early:

| v2.0 called for, upfront | Problem | What we do instead |
|---|---|---|
| Stripe billing service (`perl-billing`) in Sprint 4 | No paying customer yet exists to bill. Building this before the core product is validated is speculative work — YAGNI. | Billing is a phase near the *end*, gated on "we have a school that wants to pay us." |
| Redis pub/sub for `perl-ws` from Sprint 0 | Solves a scaling/isolation problem we don't have yet with zero tenants. Adds an infra dependency before there's a feature to scale. | Start with a single in-process event emitter. Introduce Redis only when we actually have concurrent multi-tenant WS load (see [Section 8](#8-deferred-work-explicitly-not-built-yet-and-why)). |
| Platform admin console + `SUPER_ADMIN` impersonation in Sprint 5 | Support tooling was premature before a concrete cross-school support workflow existed. | Activated as Phase 9 after the product owner requested tenant provisioning, cross-school support, and globally-audited support changes. |
| MySQL + full tenant-isolation test suite as a day-one requirement | You cannot validate "does the core attendance feature even work and feel right" without first standing up a full database and isolation layer. That's backwards — it's expensive to change data models once real data and migrations exist. | **Mock data first.** Build and demo every core feature against an in-memory data layer. Swap to a real database only once the feature set and shape of the data are proven (Phase 6). |
| DPIA / NPC registration / DPA templates in Sprint 5 | Real, necessary, but compliance work belongs right before public launch with real student data — not before we know the product works. | Moved to the final pre-launch phase, unchanged in substance. |

**The core correction: build feature by feature, prove each one works against mock data, and only bring in infrastructure (database, cache, payment provider, compliance paperwork) when a concrete, current need forces it.** This is YAGNI applied to a roadmap, not just to code.

The other correction: v2.0 said "school details and UI" only in passing (subdomain + optional custom domain). The user-facing differentiator of this SaaS product is that **each school's interface reflects that school** — its name, logo, and colors — from the very first UI screen. That's pulled forward into Phase 1, before auth, before persistence, before anything else, because it's cheap to prove with mock data and it's core to the pitch.

---

## 2. Engineering Principles

- **Mock-first.** Every feature is built and demoed against an in-memory/mock data layer before a real database is introduced. This lets us validate the feature and the shape of its data cheaply, and iterate fast without migrations.
- **SOLID, applied practically:**
  - **Single Responsibility** — a controller handles HTTP concerns only; a service holds business logic; a repository holds data access. Don't blend them.
  - **Open/Closed** — new attendance rules or new tenant settings should be addable without editing unrelated code paths.
  - **Liskov Substitution** — a mock repository and a real database repository implementing the same interface must be fully interchangeable. Business logic and controllers never know or care which one is wired in.
  - **Interface Segregation** — narrow, feature-specific repository interfaces (`IUserRepository`, `IAttendanceRepository`, `ITenantRepository`), not one god `IDataAccess`.
  - **Dependency Inversion** — services depend on repository *interfaces*, injected at startup (via a small factory/config switch, not a DI framework we don't need yet). Swapping mock → real is a one-line config change, not a rewrite.
- **YAGNI.** If a phase's checklist item isn't needed to ship the *current* feature, it doesn't belong in the current phase. Push it to [Section 8](#8-deferred-work-explicitly-not-built-yet-and-why) instead of building it "while we're in there."
- **Feature-by-feature, not layer-by-layer.** Each phase delivers one demoable, end-to-end feature (UI → API → data), not "all the backend" then "all the frontend."
- **Every change is logged.** See [Section 9](#9-changelog-policy).

---

## 3. Architecture: Ports & Adapters

This is what makes "mock first, real database later" actually cheap instead of a rewrite.

```
[Controllers / Routes]  →  [Services (business logic)]  →  [Repository Interface]
                                                                     │
                                                     ┌───────────────┴───────────────┐
                                                     │                               │
                                          [Mock Repository]                [Real Repository]
                                          (in-memory / JSON,                (MySQL via Sequelize
                                           used Phases 1–5)                  or Prisma, Phase 6+)
```

- Repository interfaces live in `src/repositories/interfaces/` (e.g. `ITenantRepository.ts`, `IUserRepository.ts`, `IAttendanceRepository.ts`).
- Mock implementations live in `src/repositories/mock/` — plain in-memory arrays/objects seeded with realistic sample data (a couple of sample schools, a handful of students each). These are **not test stubs** — they are a real, working implementation of the interface, usable to run the whole app locally with no database.
- Real implementations (added in Phase 6) live in `src/repositories/db/` and satisfy the exact same interfaces.
- Which implementation gets wired up is controlled by one config flag (`DATA_LAYER=mock|db`), read once at app startup in a small composition-root file. No other code branches on this.
- Services (`AttendanceService`, `TenantService`, `AuthService`, `DeviceService`) depend only on the interfaces, never on a concrete repository or an ORM.

**Acceptance bar for every phase:** if a feature works against the mock repository, it must work identically against the real repository once Phase 6 swaps it in, with zero changes to service or controller code.

---

## 4. Tenant / School Customization Model

Each school ("tenant") has a `SchoolProfile`:

```ts
interface SchoolProfile {
  id: string;
  slug: string;             // subdomain-safe identifier, e.g. "st-marys"
  name: string;              // "St. Mary's Academy"
  logoUrl: string | null;
  theme: {
    primaryColor: string;    // hex, e.g. "#0F4C81"
    secondaryColor: string;
    accentColor: string;
  };
  contactEmail: string;
}
```

- The public homepage and login stay platform-generic and never expose a school selector or client list. After authentication, the backend resolves the school from the account, stores its `schoolId` in the signed JWT, and returns the corresponding `SchoolProfile` before rendering the authenticated app shell.
- A `ThemeProvider` component applies `theme.*` as CSS variables and swaps in `logoUrl` and `name` wherever branding appears (header, login page, email templates later).
- This is proven in **Phase 1**, against two or three mock schools with visibly different names/logos/colors, specifically so we catch "did we hardcode the school name somewhere" mistakes immediately, while it's cheap to fix.
- Nothing here requires a database — mock `SchoolProfile` records are enough to build and demo the entire theming system.

---

## 5. Roles

School users stay in the tenant-scoped user repository. The concrete support and school-provisioning requirement introduced in Phase 9 adds a separate platform-user repository for `SYSTEM_ADMIN` and `SUPPORT`; platform users have no home `schoolId` and must select an explicit, audited support context before working inside a school.

| Role | Description |
|---|---|
| `ADMIN` | Full access within their own school |
| `STAFF` | Non-student card holder |
| `STUDENT` | RFID card holder, attendance subject |
| `GUARDIAN` | Notification recipient, scoped to their linked student(s) |
| `SYSTEM_ADMIN` | Platform administrator who can provision schools and manage any selected school through the audited platform workspace |
| `SUPPORT` | Read-only cross-school support user who can inspect records, view global logs, and use monitor diagnostics without changing school data |

Every school-user record carries a `schoolId` (the mock-data-era name for what becomes `school_id` once the DB is introduced). The signed JWT also carries this value, and ordinary backend requests derive their school from the verified session rather than client-supplied school input. Platform-user JWTs carry `schoolId: null`; their explicit target school is authorized separately and all support access and system-admin mutations are audited.

---

## 6. Development Phases

Each phase = one feature, demoable end-to-end, with its own checklist. Do not start a phase until the previous one's checklist is fully checked off and committed with a changelog entry.

### Phase 0 — Project Scaffolding

**Goal:** an empty-but-running app with the ports-and-adapters skeleton in place, no features yet.

- [ ] Initialize `perl-api` (Express) and `perl-rfid-frontend` (React/Vite) repos/folders
- [ ] Create `src/repositories/interfaces/` with placeholder interfaces (empty methods, just signatures)
- [ ] Create `src/repositories/mock/` with a composition root that wires mocks by default
- [ ] Add `DATA_LAYER` config flag (defaults to `mock`)
- [ ] Set up linting (ESLint) and a test runner (Jest) with zero starter tests — no feature to test yet
- [ ] Confirm both apps boot locally with no database running
- [ ] `planning/CHANGELOG.md` created (see [Section 9](#9-changelog-policy))

### Phase 1 — School Branding & Tenant Context (mock)

**Goal:** prove the core SaaS differentiator — the UI visibly changes per school — before building anything else.

- [ ] Define `SchoolProfile` interface ([Section 4](#4-tenant--school-customization-model))
- [ ] Mock repository seeded with 2–3 sample schools with distinct name/logo/colors
- [ ] `GET /api/school/current` resolves a school from a dev-mode selector (query param or local dropdown)
- [ ] Frontend `ThemeProvider` applies theme + logo + name before rendering the app shell
- [ ] Manual demo: switching the school selector visibly re-skins the whole app with no page-specific hardcoded branding left behind
- [ ] Unit tests for `TenantService.getCurrentSchool()` against the mock repository (real logic, not a stub)
- [ ] Changelog entry

> Superseded by Phase 9: the Phase 1 selector was useful for proving mock branding, but it is no longer public product UX. The authenticated account/JWT now resolves school context.

### Phase 2 — Auth & Roles (mock)

**Goal:** login, session, and role-based access, scoped per school, still no database.

- [ ] `IUserRepository` interface + mock implementation, seeded with a few users per sample school across all four roles
- [ ] `AuthService`: login, session issuance (JWT, HttpOnly cookie **from day one** — see [Section 10](#10-non-negotiable-standards-from-day-one))
- [ ] Passwords hashed with bcrypt **from day one** — there is no "insecure first, fix later" step in a fresh build
- [ ] Role-check middleware scoped by `schoolId`, unit-tested against mock data including a negative case (User from School A cannot hit a School-B-scoped route)
- [ ] Frontend: login page (school-branded, using Phase 1's `ThemeProvider`), protected routing
- [ ] Changelog entry

### Phase 3 — Attendance Scan Flow (mock)

**Goal:** the core product feature — recording and viewing attendance — proven without any physical device or database.

- [ ] `IAttendanceRepository` interface + mock implementation
- [ ] `POST /api/device/scan` — accepts a simulated card UID via `curl`/Postman (no firmware yet), resolves student + school, records attendance
- [ ] `AttendanceService` enforces the "admitted vs denied" business rule cleanly as a pure, testable function (this is the piece v1.0 got wrong in firmware — get it right once, in one place, in the service layer, and both the API and any future firmware simply trust its verdict)
- [ ] Frontend: real-time-feeling scan monitor (in-process event emitter → simple polling or a single WS connection; **no Redis**, see [Section 8](#8-deferred-work-explicitly-not-built-yet-and-why))
- [ ] Attendance log table view, paginated from the start (pagination is cheap to add now, expensive to retrofit — this is not scope creep, it's a two-line default `limit`)
- [ ] Unit tests for `AttendanceService` admit/deny logic (table-driven, real logic, no mocking beyond the repository)
- [ ] Changelog entry

### Phase 4 — School Admin Management (mock)

**Goal:** a school admin can manage their own school's profile and users.

- [ ] Admin UI: edit `SchoolProfile` (name, logo, theme colors) — read-modify-write against the mock repository, confirms Phase 1's theming updates live
- [ ] Admin UI: list/add/edit/deactivate users within their own school only (enforce `schoolId` scoping in the service layer, not just the UI)
- [ ] Admin UI: filter/export the current People roster and import up to 500 users from the versioned CSV template with row-level validation
- [ ] Changelog entry

### Phase 5 — Device Registration (mock)

**Goal:** an admin can register a device for their school; no physical hardware required yet — a mock/simulated device client stands in.

- [ ] `IDeviceRepository` interface + mock implementation
- [ ] Admin UI: "Add Device" generates a device key scoped to `schoolId`
- [ ] A small CLI or script that simulates a device (posts scans using the generated key) — used for demoing and for Phase 3's integration tests, not a permanent product feature
- [ ] Device key validated per-school at the scan endpoint (a device from School A cannot be used to post scans that get attributed to School B, even in mock data — the isolation habit starts here)
- [ ] Changelog entry

### Phase 6 — Real Persistence (swap mock → database)

**Goal:** everything built in Phases 1–5 keeps working, unchanged at the service/controller layer, on a real database.

- [ ] Stand up MySQL (Docker Compose for local dev)
- [ ] Implement `db/` repositories satisfying the exact interfaces used by mock repositories
- [ ] Migration: create real tables (`schools`, `users`, `devices`, `attendance_logs`) with `school_id` foreign keys everywhere a mock repo used `schoolId`
- [ ] Flip `DATA_LAYER=db`; run the full existing test suite unchanged against the new repositories — this is the acceptance test for whether the ports-and-adapters boundary actually held
- [ ] Seed script recreates the same sample schools/users used in mock data, for continuity of manual testing
- [ ] Changelog entry (this is a significant one — document exactly what "schoolId" became in the schema, for future agents)

### Phase 7 — Security Hardening Pass

**Goal:** close the gap between "works in dev" and "safe with real schools' data." Nothing here should be a surprise — it's the [Section 10](#10-non-negotiable-standards-from-day-one) list, verified.

- [ ] CORS restricted to known frontend origins (never wildcard)
- [ ] JWT expiry validated on every request
- [ ] Cross-school isolation test suite: for every authenticated route, confirm a token from School A cannot read/write School B's data by ID guessing
- [ ] Rate limiting on `/api/auth/login` and `/api/device/scan`
- [ ] `npm audit` clean of HIGH/CRITICAL; CI gate added
- [ ] Changelog entry

### Phase 8 — Pre-Launch Compliance & Ops

**Goal:** ready for a real school with real students to go live.

- [ ] DPIA covering RA 10173 (Philippine Data Privacy Act) — required because this processes minors' attendance data
- [ ] Data Processing Agreement (DPA) template ready for schools to sign
- [ ] Data export and deletion endpoints (portability + right-to-erasure)
- [ ] Backup + restore tested for a single school's data, not just a full-database restore
- [ ] Changelog entry

### Phase 9 — Platform Support, School Provisioning & Role-Scoped Self-Service

**Goal:** provide the now-required multi-school support workflow without exposing the client base publicly or weakening tenant boundaries.

- [x] Add separately persisted `SYSTEM_ADMIN` and `SUPPORT` platform users and seed both initial mock/database accounts
- [x] Keep the homepage/login generic; resolve ordinary users' schools from their accounts and signed JWT `schoolId`
- [x] Protect the school directory, allow only `SYSTEM_ADMIN` to create a new `SchoolProfile`, and keep `SUPPORT` cross-school access read-only
- [x] Require explicit support context for cross-school operations and audit access, provisioning, and support-initiated mutations by actor and school
- [x] Add a global, filterable system action-log page for platform administrators and support
- [x] Keep monitor scan simulation and saved-record diagnostics support-only while school staff/admins retain the live device stream
- [x] Add filters and matching full-result CSV exports to operational record lists
- [x] Let school admins manage tenant-scoped staff, students, guardians, and guardian/student links
- [x] Scope attendance views by role: school-wide for admin/staff, self-only for students, and linked-student-only for guardians
- [x] Add mock/database repository parity and integration coverage
- [x] Changelog entry

*(Billing and Redis-scaled realtime are still intentionally deferred; see [Section 8](#8-deferred-work-explicitly-not-built-yet-and-why).)*

---

## 7. Testing Strategy — Don't Over-Mock

- **Mock the data layer, not the business logic.** The mock *repositories* described above are real, working implementations — they are the thing under test's actual dependency, not a `jest.fn()` stand-in. Services and their business rules (attendance admit/deny, role scoping, theming resolution) are tested for real, with real inputs and real assertions on real outputs.
- **Only mock true external boundaries** — things outside our codebase we don't control and shouldn't hit in tests: a payment provider (once billing exists), an SMTP server, S3. Everything inside our own service/repository boundary runs for real in tests.
- **Integration tests use the actual Express app** (via `supertest`) hitting real routes, wired to the mock repository — not route handlers tested in isolation with mocked `req`/`res`.
- **No snapshot-testing UI pixel output** and no testing implementation details (internal state, private methods) — test behavior and outputs.
- Coverage is a signal, not a target to game: aim for meaningful coverage of business logic (services), not 100% coverage achieved by testing trivial getters.

---

## 8. Deferred Work (explicitly not built yet, and why)

Listed here on purpose, so no agent "helpfully" builds these early — that's exactly the over-engineering this rewrite is correcting for.

| Deferred item | Build when... |
|---|---|
| Stripe billing (`perl-billing` service) | A real school is ready to pay, i.e., right after Phase 8 or when the first paying pilot is confirmed. |
| Redis pub/sub for realtime | We observe actual multi-tenant concurrent WS load that a single in-process broadcaster can't handle — not before. |
| Platform admin console / `SUPER_ADMIN` role / impersonation | **Activated in Phase 9:** the product owner supplied the concrete provisioning and cross-school support workflow. |
| Custom domains per tenant (beyond subdomain) | An Enterprise-tier customer actually asks for it. |
| Database-per-tenant / schema isolation option | A customer's contract or compliance requirement demands it — the shared-DB-with-`school_id`-scoping model is sufficient until then. |
| Multi-region infrastructure | Latency or regulatory requirements actually demand it. |

If a future need arises, add a new phase after Phase 8 — don't retrofit it into an earlier phase's scope.

---

## 9. Changelog Policy

Every merged change — feature, fix, refactor, or phase completion — gets an entry in `planning/CHANGELOG.md`, following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
## [Unreleased]
### Added
- Phase 3: attendance scan endpoint against mock repository (`POST /api/device/scan`)

### Changed
- `AttendanceService.evaluate()` now the single source of truth for admit/deny logic

### Fixed
- N/A
```

Rules for agents:
- **One entry per logical change**, written in plain language — not a copy of the diff.
- Reference the phase and, where relevant, the file(s) touched, so another agent can locate the change without git-blaming the whole repo.
- Never delete prior entries. Move `[Unreleased]` items under a dated version heading only at an actual release/deploy, never mid-phase.
- If a change reverses or supersedes an earlier entry (e.g., Phase 6 replacing a mock repository), say so explicitly: *"Supersedes Phase 3's in-memory attendance store — see Phase 6."*

---

## 10. Non-Negotiable Standards From Day One

Because this is a fresh build (not a legacy fix-up like v1.0/v2.0 assumed), there is no excuse to introduce known-bad patterns "for now." These apply starting Phase 0, even while everything else is mock data:

- Passwords: bcrypt, never MD5 or unsalted hashing.
- Sessions: JWT in an HttpOnly, Secure cookie — never `localStorage`.
- CORS: explicit allow-list, never a wildcard.
- Any credential or key (device keys, API keys): never in a URL query string, never hardcoded in source — env vars or (for firmware, once real devices exist) provisioned secrets.
- Cross-school data access: every service method that touches user, attendance, or device data takes and enforces `schoolId` scoping — even against mock data, even before any of this is "at risk" in production. The habit formed in Phase 1–5 is what makes Phase 7 a verification pass instead of a rewrite.

---

*End of document. Start at Phase 0. Do not skip ahead. Log everything in `planning/CHANGELOG.md`.*
