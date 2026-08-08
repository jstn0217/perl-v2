# PERL Data Model

This documents the real PostgreSQL schema used when `DATA_LAYER=db`, as defined in `perl-api/src/repositories/db/schema.ts` (the single source of truth — tables are created there with `CREATE TABLE IF NOT EXISTS`, and existing databases are migrated forward idempotently via `ensureColumn`). The mock repositories (`perl-api/src/repositories/mock/`) implement the exact same `IUserRepository`/`ITenantRepository`/etc. interfaces and return objects shaped identically to the mapped Postgres rows (see `perl-api/src/repositories/db/mappers.ts`) — there are no mock-only convenience fields that diverge from the real schema.

## Entity-Relationship Diagram

```mermaid
erDiagram
    SCHOOLS ||--o{ USERS : "school_id"
    SCHOOLS ||--o{ DEVICES : "school_id"
    SCHOOLS ||--o{ ATTENDANCE_LOGS : "school_id"
    SCHOOLS ||--o{ AUDIT_LOGS : "school_id"
    SCHOOLS ||--o{ NOTIFICATION_TRANSACTIONS : "school_id"
    USERS ||--o{ ATTENDANCE_LOGS : "user_id"
    DEVICES ||--o{ ATTENDANCE_LOGS : "device_id"
    ATTENDANCE_LOGS ||--o{ NOTIFICATION_TRANSACTIONS : "attendance_log_id"
    USERS ||--o{ NOTIFICATION_TRANSACTIONS : "student_user_id / guardian_user_id"

    SCHOOLS {
        varchar_128 id PK
        varchar_128 slug UK
        varchar_255 name
        text logo_url
        char_7 primary_color
        char_7 secondary_color
        char_7 accent_color
        varchar_255 contact_email
        boolean sms_enabled
        varchar_32 sms_sender_name
        text address
        varchar_32 phone
        varchar_64 timezone "default 'Asia/Manila'"
        varchar_64 academic_year_label
        varchar_64 deped_school_id
        int sort_order
        timestamptz created_at
    }

    USERS {
        varchar_128 id PK
        varchar_128 school_id FK "ON DELETE CASCADE"
        varchar_255 email UK "unique per school: uq_users_school_email(school_id,email); also globally UNIQUE"
        varchar_255 password_hash
        varchar_255 first_name
        varchar_255 last_name
        varchar_20 role "ADMIN|STAFF|STUDENT|GUARDIAN"
        varchar_255 card_uid UK "nullable, globally unique"
        varchar_255 grade_level
        varchar_255 section
        text image_url
        varchar_32 phone_number
        text linked_student_ids "JSON-encoded string[] (guardian -> student ids)"
        boolean is_active
        timestamptz created_at
    }

    PLATFORM_USERS {
        varchar_128 id PK
        varchar_255 email UK
        varchar_255 password_hash
        varchar_255 first_name
        varchar_255 last_name
        varchar_20 role "SYSTEM_ADMIN|SUPPORT, default SUPPORT"
        boolean is_active
        timestamptz created_at
    }

    DEVICES {
        varchar_128 id PK
        varchar_128 school_id FK "ON DELETE CASCADE"
        varchar_255 name
        varchar_255 location
        char_64 key_hash UK "sha256 of the one-time device key"
        char_4 key_last_four
        boolean is_active
        timestamptz created_at
    }

    ATTENDANCE_LOGS {
        varchar_128 id PK
        varchar_128 school_id FK "ON DELETE CASCADE"
        varchar_128 user_id "not a DB-level FK (see note below)"
        varchar_128 device_id "not a DB-level FK"
        varchar_10 direction "IN|OUT"
        varchar_20 verdict "ADMITTED|DENIED"
        varchar_64 denial_reason "nullable: USER_NOT_FOUND|CROSS_SCHOOL_USER|DAILY_LIMIT_REACHED|COOLDOWN_ACTIVE"
        text message
        timestamptz scanned_at "indexed: idx_attendance_school_scanned_at, idx_attendance_user_scanned_at"
        timestamptz created_at
    }

    AUDIT_LOGS {
        varchar_128 id PK
        varchar_128 school_id FK "ON DELETE CASCADE"
        varchar_128 actor_user_id
        varchar_20 actor_role "default ADMIN"
        boolean support_initiated "default FALSE"
        varchar_64 action "e.g. SCHOOL_CREATED, USERS_IMPORTED, ATTENDANCE_EXPORTED"
        varchar_20 target_type
        varchar_128 target_id "nullable"
        text change_summary
        timestamptz occurred_at "indexed: idx_audit_school_occurred_at"
        timestamptz created_at
    }

    NOTIFICATION_TRANSACTIONS {
        varchar_128 id PK
        varchar_128 school_id FK "ON DELETE CASCADE"
        varchar_128 attendance_log_id "indexed: idx_notification_attendance_log"
        varchar_128 student_user_id
        varchar_128 guardian_user_id "nullable"
        varchar_32 recipient "nullable, PH mobile number"
        varchar_8 direction "IN|OUT"
        text message
        varchar_20 provider "SEMAPHORE|MOCK"
        varchar_20 status "queued|sent|failed|skipped"
        varchar_128 provider_message_id "nullable"
        varchar_64 provider_status "nullable"
        varchar_64 network "nullable"
        text error_message "nullable"
        timestamptz created_at "indexed: idx_notification_school_created_at"
        timestamptz completed_at "nullable"
    }
```

## Key Constraints

- **Tenant isolation via foreign key, not application convention alone.** `users`, `devices`, `attendance_logs`, `audit_logs`, and `notification_transactions` all carry `school_id VARCHAR(128) NOT NULL REFERENCES schools(id) ON DELETE CASCADE`. Deleting a school cascades to every row that belongs to it, so there is no dangling cross-tenant data at the database level — this is a hard backstop underneath the service-layer `schoolId` scoping described in `ARCHITECTURE.md` and `SYSTEM-DESIGN.md`.
- **Uniqueness**: `schools.slug` is globally unique (subdomain-safe tenant identifier); `users.email` is globally unique *and* additionally constrained by `uq_users_school_email UNIQUE (school_id, email)` (the global uniqueness is what lets the public login form resolve a user without asking which school first — see the auth flow in `SYSTEM-DESIGN.md`); `users.card_uid` is globally unique so a scanned RFID card UID resolves to exactly one person; `devices.key_hash` is globally unique (the sha256 of a device's one-time key); `platform_users.email` is globally unique.
- **Indexes**: `idx_attendance_school_scanned_at (school_id, scanned_at DESC)` and `idx_attendance_user_scanned_at (user_id, scanned_at DESC)` back the paginated attendance-log and per-user attendance queries; `idx_audit_school_occurred_at (school_id, occurred_at DESC)` backs the paginated audit log; `idx_notification_school_created_at (school_id, created_at DESC)` and `idx_notification_attendance_log (attendance_log_id)` back the SMS delivery-history screen and looking up notifications for a given scan.
- **`attendance_logs.user_id` and `.device_id` are intentionally not database-level foreign keys.** A denied scan (unrecognized card) is recorded with a sentinel `user_id = 'unknown-user'` (`AttendanceService.createDeniedLog`) so every scan attempt — including ones that never resolved to a real person — is auditable; a hard FK to `users.id` would reject that row. Referential integrity for known users/devices is enforced in the service layer instead (`AttendanceService.scanCard` looks up and validates both before writing).
- **`users.linked_student_ids`** is a `TEXT` column holding a JSON-encoded array of student user IDs (guardian → student links), not a join table. `mapUserRow` parses it defensively (invalid/missing JSON falls back to `[]`) rather than failing the read.
- **Schema evolution is additive and idempotent**: new columns (`address`, `phone`, `timezone`, `academic_year_label`, `deped_school_id` on `schools`; `phone_number`, `linked_student_ids` on `users`; `actor_role`, `support_initiated`, `change_summary` on `audit_logs`) are added via `ensureColumn()`, which checks `information_schema.columns` before running `ALTER TABLE ... ADD COLUMN`, so re-running schema initialization against an existing database is always safe.
- **Database bootstrap is concurrency-safe.** `initializeDatabase()` takes a Postgres advisory lock (`pg_advisory_lock`/`pg_advisory_unlock`, fixed key) around table creation and seed-on-empty so multiple API processes booting against the same empty database don't race to seed duplicate rows.

## ID Scheme

Every primary key is a `VARCHAR(128)` string, never a numeric auto-increment column. IDs are generated per-entity in the service layer, not the database:

- Schools: `school-${randomUUID()}` (`TenantService.createSchool`) — seeded schools instead use readable slugs like `school-st-marys`.
- Users: `user-${schoolId}-${Date.now()}` (`AdminService.createUser`).
- Devices: `device-${schoolId}-${Date.now()}` (`DeviceService`).
- Audit records: `audit-${randomUUID()}` (`AuditService`).

This was a deliberate choice, consistent with how the mock repositories already worked before Postgres existed: IDs are assigned by application code so the exact same ID a mock-mode test or seed generates is what a real-mode run would generate too, keeping `IUserRepository`/`ITenantRepository`/etc. fully interchangeable between adapters (Liskov substitution — see `CLAUDE.md` Section 2). A numeric auto-increment primary key would force IDs to be assigned by whichever database is currently wired in, breaking that interchangeability and leaking a database-specific detail (sequence values) into code and tests that are supposed to be storage-agnostic. String IDs also avoid ID collisions across the mock/db swap in tests that seed both layers with the same fixtures.
