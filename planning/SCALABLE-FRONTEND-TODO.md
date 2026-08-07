# Scalable Frontend TODO

This backlog records the next design and architecture steps required as PERL grows beyond the current mock-sized school data. It complements `planning/PLAN.md`; it does not change the phase order in `CLAUDE.md`.

## Current UI contracts

- Routed screens live in `src/pages/`, composed reusable sections live in `src/modules/`, and atomic reusable UI lives in `src/components/`.
- Full record collections use the shared `Pagination` component. Small dashboard and live-monitor collections are explicitly bounded previews and link to a full paginated screen.
- Create and edit actions from record lists open in the shared `Modal` component. A dedicated settings page can keep a single settings form inline when it is the page's only task.
- Primary application destinations live in the hamburger navigation drawer.

## P0 — before large school datasets

- [ ] Replace client-side people and device pagination with repository-backed API pagination using `page`, bounded `pageSize`, `total`, and stable sort metadata. The current frontend pagination limits rendering but still downloads the entire collection.
- [ ] Define one list-query contract for pagination, search, filters, and sort, and persist that state in URL parameters so filtered views can be shared and restored.
- [ ] Add server-side indexes for the actual list sort/filter fields after query shapes are proven: `school_id`, status, role, name, scan timestamp, and device name/location.
- [ ] Extract modal user and device forms into reusable modules once a second consumer appears; keep field controls atomic and keep API mutation state at the page/module boundary.
- [ ] Add dirty-form protection and explicit discard confirmation to modal editors before forms gain more fields.
- [ ] Establish dataset thresholds: standard pagination for ordinary lists, cursor pagination for rapidly changing attendance logs, and virtualization only after measured DOM/render cost justifies it.
- [ ] Verify keyboard navigation, dialog focus return, screen-reader names, and school-theme contrast for every new reusable component.

## P1 — as list capabilities expand

- [ ] Create a reusable responsive data-list module for shared loading, empty, error, table/card, bulk-selection, and pagination states without forcing every domain into one oversized component API.
- [ ] Add debounced search, role/status filters, and stable sorting to people and devices, with results announced accessibly.
- [ ] Centralize permission-aware navigation in a typed route registry so route guards and hamburger menu visibility cannot drift.
- [ ] Standardize mutation feedback with reusable inline alerts or toasts, including retry behavior and error details that are safe to expose.
- [ ] Add reusable confirmation dialogs for destructive actions instead of browser `window.confirm`, with the affected record named and focus restored afterward.
- [ ] Define image thumbnail variants, lazy loading, aspect-ratio rules, and fallback behavior for user photos and school logos.
- [ ] Add route-level lazy loading when measured bundle growth makes it useful; keep the initial live-attendance path small.
- [ ] Define SSE reconnect, stale-state, event ordering, and bounded in-memory history behavior for long-running attendance displays.

## P2 — when component and team count justify it

- [ ] Add a component catalog such as Storybook for shared primitives and modules, including representative school themes and long-content states.
- [ ] Add focused interaction and accessibility tests for reusable components with meaningful behavior; avoid snapshot-only coverage.
- [ ] Add visual regression coverage for the live attendance stage, modal editors, pagination, and navigation drawer at agreed desktop and mobile viewports.
- [ ] Prepare localization-safe copy, date/time formatting, and layouts for longer translated labels.
- [ ] Split global CSS into design tokens, component styles, and page/module styles when ownership or stylesheet size starts slowing changes.
- [ ] Instrument anonymous performance measures for scan-to-display latency, list response time, image load failures, and route bundle size.

## Definition of scalable for a new record surface

A new record surface is ready when it has tenant-scoped data access, bounded retrieval, stable ordering, loading/empty/error states, pagination or an explicitly documented bounded-preview limit, accessible create/edit behavior, responsive containment, and a clear path from preview content to the full collection.
