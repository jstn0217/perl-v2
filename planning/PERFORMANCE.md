# Performance: load-test results and optimization plan

Measured 2026-08-20 with `perl-api/scripts/load-test.ts` (boots the real Express
app in-process, injects synthetic records at the repository layer with one
shared bcrypt hash, times hot endpoints via supertest).

Run it: `NODE_ENV=test DATA_LAYER=mock npx tsx scripts/load-test.ts 20000`
(argument = student count; guardians = half, attendance = 3x, submissions =
1/10th). For the db layer, set `DATA_LAYER=db` plus `DB_*` variables against a
disposable Postgres.

## Measurements

Latency in ms per request, single in-process caller, Apple Silicon dev machine.

| Endpoint | mock 2k | mock 20k | mock 50k | Postgres 20k |
|---|---|---|---|---|
| Login (bcrypt cost 12, by design) | 639 | 608 | 604 | 491 |
| Users list page 1 (size 25) | 21 | 65 | 67 | 18 |
| Users deep page | 5 | 42 | 40 | 64 |
| Users search (ILIKE) | 3 | 13 | 27 | 111 |
| Users all=true STUDENT (directory feed) | 10 / 2k rows | 314 / 20k rows | 250 / 50k rows | 170 / 20k rows |
| Attendance logs page 1 | 3 | 15 | 69 | 101 |
| Attendance export CSV, 7-day range | n/a | n/a | 1613 | 1645 |
| Submissions page 1 | 2 | 3 | 10 | 23 |
| Bulk status, 100 users | 2 | 3 | 6 | 110 |
| Device scan (gate write path) | 39 | 38 | 44 | 239 |
| School summary (dashboard) | 2 | 8 | 22 | 328 |

## Verdict

Server-side pagination holds: every paginated list stays well under 150 ms at
50k students on both layers. Nothing user-facing "falls over". Four real
hotspots exist, all with identified root causes (code-read, not guessed):

## Optimization plan (priority order — do when the trigger fires, not before)

1. **Attendance export builds in memory from a full-table read.**
   `AttendanceService.getFilteredLogs` calls `listAllBySchool` (every log row
   for the school, 60k+ rows) and filters from/to/verdict in JS — 1.6 s on both
   layers for a 7-day export. The existing `ATTENDANCE_UNBOUNDED_READ_CAP`
   400-guard correctly stops unbounded exports, but ranged exports still pay
   full-table cost. **Fix:** push `from`/`to`/`verdict`/`direction` into the
   repository query (SQL `WHERE` on the existing `(school_id, scanned_at)`
   index; equivalent filter in the mock), and stream the CSV rather than
   buffering. **Trigger:** schools with >100k attendance rows or export
   latency complaints. Effort: small-medium.

2. **Dashboard summary counts in JS over a full user fetch.**
   `AdminService.getSchoolSummary` loads every user row (30k) to compute seven
   counts — 328 ms on Postgres, on every dashboard load. **Fix:** add
   `IUserRepository.countsBySchool` doing `SELECT role, is_active, COUNT(*)
   GROUP BY` (single indexed query); mock computes the same shape. **Trigger:**
   schools >5k users. Effort: small.

3. **Full-directory `all=true` fetch feeding the People page link picker and
   guardian-address map.** 50k rows / multi-MB JSON shipped to the browser on
   page load; server time is fine (250 ms) but browser parse/memory and
   per-keystroke filtering degrade. **Fix:** replace the eager directory fetch
   with server-side typeahead (the paginated endpoint already supports
   `search`; LinkPicker debounces and queries per keystroke, keeping selected
   chips resolved via a by-ids lookup), and compute the guardian-address
   fallback server-side on the paged rows instead of client-side from the full
   guardian list. **Trigger:** any school >2k students (browser-side, so this
   is the first one real users would feel). Effort: medium — touches
   LinkPicker, UserManagementPage, and adds one small by-ids endpoint.

4. **Device scan at 239 ms on Postgres** (gate hardware path; mock 44 ms shows
   it's round-trip count, not logic). ~7 sequential queries: device lookup,
   `touchLastSeen` write, card lookup, school/timezone fetch, today's-logs
   read, log insert, notification insert. **Fix:** batch the reads (single
   join or parallel `Promise.all` for the independent ones), make
   `touchLastSeen` fire-and-forget, move notification queueing off the
   response path. Sub-second is already fine for a gate; do this only if real
   deployments report queueing at the scanner. **Trigger:** p95 scan latency
   >500 ms in production. Effort: small.

Deliberately not planned: users `search` ILIKE at 111 ms (fine until ~50k+;
`pg_trgm` index if it ever matters), login bcrypt cost (security floor, not a
perf bug), submissions CSV export 100-row cap (known limitation, separate
product decision).
