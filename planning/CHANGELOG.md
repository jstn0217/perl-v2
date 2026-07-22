# Changelog

All notable changes to the PERL platform's plan and codebase are documented here, in [Keep a Changelog](https://keepachangelog.com/) format. This file exists so an AI coding agent (or a new human contributor) can understand what happened and why without reading every prior diff or PRD revision.

**Format for every entry going forward:**
- Group changes under `### Added`, `### Changed`, `### Fixed`, `### Removed`, `### Deferred`
- One bullet per logical change, in plain language, referencing the phase and file(s) touched
- Never delete or rewrite past entries — if something is superseded, say so explicitly in the new entry
- Keep unreleased work under `## [Unreleased]` until an actual deploy/release, then move it under a dated heading

---

## [Unreleased]

### Added
- Phase 0: scaffolded `perl-api/` and `perl-rfid-frontend/` with TypeScript app shells, mock-by-default backend repository composition, lint/test/build tooling, environment examples, and a placeholder frontend shell that boots without any database dependency.
- Planning: updated `planning/PLAN.md` from the legacy security review to capture secure-session, device-auth, realtime-auth, tenant-isolation, rate-limiting, upload-hardening, and audit-logging requirements for the rebuild.
- Planning: consolidated `planning/existing-app-summary-and-simplification-plan.md` and `planning/phase-0-execution-plan.md` into `planning/PLAN.md` as the single planning source of truth, preserving the legacy-app inventory, rebuild mapping, and Phase 0 execution details.
- Planning: updated `planning/PLAN.md` to make PostgreSQL the planned Phase 6 database and added a legacy-to-new data migration strategy covering ETL import flow, schema mapping, password handling, device-key rotation, and cutover validation.
- Planning: updated `planning/PLAN.md` to add a Phase 3 scan-to-display latency requirement, specifying a single-roundtrip realtime payload, in-process broadcast path, thumbnail-oriented image delivery, and no second frontend fetch before showing the scanned student.
- Planning: updated `planning/PLAN.md` to add school-scoped user-management import/export requirements, including CSV-first bulk admin workflows, row-level validation, matching rules, and separation from the legacy migration process.
- Planning: updated `planning/PLAN.md` to require pagination by default for all list-fetching APIs and list UIs, with bounded page sizes and pagination metadata as a baseline contract.
- Planning: created `planning/existing-app-summary-and-simplification-plan.md` to inventory the legacy implementation under `existing/`, summarize the real current architecture, and map the simplification/rebuild path to `AGENTS.md` Phases 0–6.
- Planning: created `planning/phase-0-execution-plan.md` to translate `AGENTS.md` Phase 0 into a concrete scaffold sequence, definition of done, and phased Docker approach for the simplified rebuild.

### Changed
- Phase 0: removed the premature root `docker-compose.yml`, updated [README.md](/Users/jmendoza/Desktop/Documents/Work_Code/sandbox/perl-v2/README.md), and realigned `planning/PLAN.md` to keep Docker and MySQL persistence deferred until Phase 6, superseding the earlier PostgreSQL planning drift and broken schema mount.
- Phase 0: updated [perl-api/jest.config.cjs](/Users/jmendoza/Desktop/Documents/Work_Code/sandbox/perl-v2/perl-api/jest.config.cjs) to allow an empty starter test suite and removed [perl-api/tests/smoke.test.ts](/Users/jmendoza/Desktop/Documents/Work_Code/sandbox/perl-v2/perl-api/tests/smoke.test.ts) so the scaffold matches `AGENTS.md`'s "test runner with zero starter tests" requirement.
- Planning: moved `CHANGELOG.md` from the repo root to `planning/CHANGELOG.md` so the planning reference documents live together, and updated `AGENTS.md` plus `planning/PLAN.md` to reference the new path.
- Planning baseline now explicitly treats `existing/` as reference material rather than the codebase to evolve in place, based on concrete findings including MD5 password hashing, `localStorage` auth persistence, query-string device keys, and mismatched Docker/database setup across the legacy apps.

### Removed
- Planning: removed the split files `planning/existing-app-summary-and-simplification-plan.md` and `planning/phase-0-execution-plan.md` after moving their contents into `planning/PLAN.md`.

---

## [3.0.0] - 2026-07-22 — Planning revision: mock-first, feature-by-feature rebuild

### Changed
- Replaced the severity-based "Sprint 1/2/3 + Sprint 0/4/5" roadmap from `AGENTS.md` v2.0 with ten sequential, feature-scoped phases (Phase 0 through Phase 8), each independently demoable. See `AGENTS.md` Section 6.
- Re-architected around a Ports & Adapters (repository interface) pattern so every feature can be built and demoed against an **in-memory mock data layer** before any real database exists. Real persistence is now Phase 6, not Phase 0. See `AGENTS.md` Section 3.
- Pulled tenant/school UI branding (`SchoolProfile`: name, logo, theme colors) forward to **Phase 1**, ahead of auth and persistence, since visibly-different-per-school UI is the core SaaS differentiator and is cheap to validate against mock data. See `AGENTS.md` Section 4.
- Simplified the role model: dropped the `SUPER_ADMIN` / `platform_users` split introduced in v2.0 Sprint 0 until an actual multi-tenant support workflow exists. Four roles only (`ADMIN`, `STAFF`, `STUDENT`, `GUARDIAN`), scoped by `schoolId`. See `AGENTS.md` Section 5.
- Testing philosophy clarified: mock only the data-access boundary and true external services (payment provider, SMTP, S3); business logic (attendance admit/deny rules, role scoping, theming resolution) is tested against real implementations, not stubbed. See `AGENTS.md` Section 7.

### Deferred
(Previously scheduled early in v2.0; explicitly pushed later — see `AGENTS.md` Section 8 for full rationale)
- Stripe billing service (`perl-billing`) — was v2.0 Sprint 4, now post-Phase 8, gated on having an actual paying school.
- Redis pub/sub for the WebSocket layer — was mandatory from v2.0 Sprint 0, now deferred until real multi-tenant concurrent load is observed; Phase 3 uses a single in-process event emitter instead.
- Platform admin console + audited `SUPER_ADMIN` impersonation — was v2.0 Sprint 5, now deferred until there's a real support workload.
- Database-per-tenant / schema isolation option, custom domains beyond subdomain, multi-region infrastructure — all deferred until a concrete customer or compliance requirement demands them.

### Unchanged from v2.0 (carried forward as-is)
- The requirement for a Data Privacy Impact Assessment (DPIA) and Data Processing Agreement (DPA) under RA 10173 (Philippine Data Privacy Act) before public launch with real students' data — now Phase 8 instead of Sprint 5, same substance.
- The non-negotiable security baseline (bcrypt not MD5, HttpOnly cookies not `localStorage`, no wildcard CORS, no credentials in URLs or source) — reframed in `AGENTS.md` Section 10 as day-one defaults for a fresh build, rather than a remediation backlog, since v3.0 assumes we are building new rather than patching v1.0's legacy codebase.

---

## [2.0.0] - 2026-07-22 — SaaS conversion from single-tenant PRD

### Added
- Multi-tenancy model: shared database with `tenant_id` row-level scoping on all tenant-owned tables.
- Subscription plans (Starter, Growth, Enterprise) and a `perl-billing` service (Stripe Checkout, Customer Portal, webhooks, usage metering).
- Tenant onboarding flow (self-serve signup, trial period) and a device-provisioning-code flow binding devices to one tenant.
- `perl-ws` rebuilt around Redis pub/sub with tenant-scoped channels, replacing the original global-broadcast design.
- Platform-level `SUPER_ADMIN` role, separated from tenant `users` table, with an audited support-access grant flow.
- Compliance section: RA 10173 (Philippine Data Privacy Act) requirements — DPO designation, DPIA, DPA template, breach notification runbook — given the platform processes minors' attendance data across many schools on shared infrastructure.
- New sprint tracks: Sprint 0 (multi-tenancy foundation), Sprint 4 (billing & onboarding), Sprint 5 (platform ops & compliance), layered on top of the original v1.0 Sprint 1–3 security/quality work.

### Changed
- Re-scoped the whole product from "one school, one VPS" to "many schools, shared infrastructure, subscription SaaS."
- Elevated several v1.0 findings (notably C-09/C-11 WebSocket auth gaps and H-04's hardcoded `deviceId: 1`) from "production bug" to "cross-tenant data leak risk," since the multi-tenant context makes them more severe, not less.

---

## [1.0.0] - 2025 — Original single-tenant PRD

### Added
- Initial PERL RFID attendance system PRD for a single Philippine school: `perl-api`, `perl-rfid-frontend`, `perl-rfid-device`, `perl-ws` components.
- Full security and stability audit: 13 CRITICAL, 12 HIGH, 7 MEDIUM, and 10 LOW findings across all four repos (see original document Section 5).
- Three-sprint remediation plan (Sprint 1 Critical, Sprint 2 High, Sprint 3 Quality/Tech Debt).
- Development standards (linting, testing, git hygiene, build process).
- Non-destructive data migration policy, including a silent MD5→bcrypt password migration path.
- Deployment checklist and full local Docker development environment spec.
