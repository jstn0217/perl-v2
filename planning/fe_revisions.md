# Frontend Audit-and-Fix Pass — impeccable-audit checklist

Date: 2026-08-08
Scope: `perl-rfid-frontend/src/pages/*`, `src/modules/*`, `src/components/*`, `src/styles.css` — current state (after the prior mobile-responsive/PWA pass and the UX-overhaul pass already in the working tree). No revert of that prior work; this is a checklist pass on top of it.

## Method

- Read every page/module file listed in the task plus `Modal.tsx`, `AccountMenu.tsx`, `AppNavigationDrawer.tsx`, `ListToolbar`/`Pagination`/`ExportColumnSelector`.
- Read `src/styles.css` in full (3422 lines).
- Grepped for known tell-signatures: `#000/#111/#888/#333/#666/#999`, purple/indigo hex ranges, `Inter`/`Arial` font references, `icon-tile`/`icon-badge` class names, `min-height` values under 44px.
- Verified visually in Chrome (claude-in-chrome) against the running app: backend `DATA_LAYER=mock npm run dev` (port 4000), frontend `npm run dev` — an existing frontend instance was already running on :5173 from a prior session and was reused (a second instance I started landed on :5174, which failed CORS since perl-api's `ALLOWED_ORIGINS` allow-list only includes :5173 — expected per Phase 7 CORS hardening, not a bug, just a dev-port collision).
- Visual check covered: landing page, login, dashboard overview, admin/users, admin/devices, admin/profile, attendance monitor, attendance logs, navigation drawer, focus-visible state (Tab key), computed contrast on translucent white-on-navy text.
- **Caveat**: the sandboxed Chrome window would not honor `resize_window` past ~492 CSS px (innerWidth stayed 492 regardless of the 1440/1800px requested) — verifiable-in-browser checks only happened at that mobile-ish width. Desktop/tablet breakpoint behavior (900px, 640px media queries) was verified by reading the CSS, not by rendering at those widths. Said plainly: desktop is code-reviewed only, not screenshot-verified.

## Issues found and fixed

All in `perl-rfid-frontend/src/styles.css`.

| # | Tell | Location | Severity | Fix |
|---|---|---|---|---|
| 1 | Touch target under 44px | `.modal__close` (40x40 icon close button, used on every modal/drawer) | Medium | Bumped to 44x44 |
| 2 | Touch target under 44px | `.pagination__controls button` (40x40, page-number/prev-next buttons on every paginated table) | Medium | Bumped `min-width`/`min-height` to 44px |
| 3 | Touch target under 44px | `.secondary-button--compact` (used for "Rotate key" / "Deactivate" on device cards, ~35px effective height, no explicit min-height) | Medium | Added `min-height: 44px` |
| 4 | Touch target under 44px | `.export-columns summary` ("Columns" disclosure toggle, 38px) | Low-medium | Bumped to 44px |
| 5 | Touch target under 44px | `.support-context__field select`, `.audit-filter select` (40px) | Low-medium | Bumped to 44px |
| 6 | Touch target under 44px | `.list-toolbar__search input`, `.compact-field input/select` (42px, used for every list search/filter field across Users/Devices/Audit/Notifications) | Low-medium | Bumped to 44px |

Verified after the fix: rebuilt, re-screenshotted `admin/users` and `admin/devices` — no layout breakage, buttons/inputs render normally at the new heights.

## Checked and judged non-issues (false positives / not worth changing)

- **Overused fonts**: font stack is `"Satoshi", "Avenir Next", "Segoe UI", sans-serif` — a deliberate pairing, not Inter/Arial/system-default. Clean.
- **Purple-to-blue gradients**: grepped for indigo/violet hex ranges — none found. All gradients in `styles.css` are `color-mix()` against `--school-primary`/`--school-accent`, i.e. tenant-branded, not generic decor.
- **Cards nested inside cards**: the stylesheet has an explicit "Minimal surface system" override block (styles.css:2288 on) that flattens every `.preview-panel`, `.admin-link-card`, `.device-card`, `.event-card`, `.stat-panel`, etc. to `border:0; background:transparent`, using border-dividers instead of boxed elevation. Verified in every page read (DashboardHomePage, DeviceManagementPage, UserManagementPage, SchoolProfileAdminPage, EditProfilePage, AttendanceMonitorPage) — single level of surface throughout, no boxed-card-in-boxed-card anywhere.
- **Gray text on colored background**: computed actual contrast for the two translucent-white-on-navy cases in the codebase (`.overview-hero__meta span` and `.live-clock span`, both `rgba(255,255,255,0.64)`): 4.82:1 against the hero gradient's darkest stop, 7.42:1 against the live-monitor stage's darkest stop. Both pass WCAG AA for the text size used. Not gray — tinted white against the same navy family as the background.
- **Pure black/pure gray**: grepped `#000/#111/#333/#666/#888/#999` across all `.css`/`.tsx` — zero matches. Ink colors are `#112033` / `#334861`, both tinted navy.
- **Bounce/elastic easing**: every `transition` in the stylesheet uses linear-ms `ease` (e.g. `transform 160ms ease`). No cubic-bezier bounce/elastic curves anywhere.
- **Side-tab borders / dark glow "premium" decor**: the dark radial-gradient "stage" backgrounds (`.live-attendance-stage`, `.overview-hero`, `.public-scan-preview`) are the product's actual live-monitor gate display and hero banner, tied directly to content (scan status, verdict, clock) — not unrelated premium chrome. Judged in-scope design signature, not a tell.
- **Rounded-square icon tile mechanically above every heading**: checked every `section-heading`/`admin-form__header` pattern across pages — none prefix headings with a generic icon tile. The one recurring "mark" element (`.scope-note__mark`, `.school-mark--fallback`) carries real information (checkmark, school initials), not decorative filler, and isn't applied mechanically to every heading.
- **Heading hierarchy**: grepped `<h[1-6]` across every page component. Pattern is consistently h1 (AppLayout school name) → h2 (page/section title) → h3 (subsection/card title) → h4 (individual item title, e.g. device card name) with no skipped levels anywhere.
- **prefers-reduced-motion**: present at the end of `styles.css`, correctly zeroes animation/transition duration and scroll-behavior.
- **Keyboard focus visible**: verified live in-browser — Tab-ing into the navigation drawer produced a clear amber focus ring (`outline: 3px solid color-mix(school-accent 55%, white)`) on the focused link. Focus-visible rules are declared for every interactive class (buttons, inputs, selects, nav links, pagination, account menu, export columns).
- **Body copy line length**: `.description`, `.section-copy`, `.modal__header p`, `.public-hero p` all cap `max-width` at 55-68ch, which renders around 45-75 characters given the type sizes used. Confirmed visually — landing page and login page body copy wraps well within range.
- **Responsive behavior**: `styles.css` has two well-formed breakpoints (900px, 640px) covering grid-collapse, table→card transform for `.attendance-table`, drawer-nav layout changes, and font-size clamps. Verified rendering correctness at ~492px (effectively the 640px-and-below tier) live; 900px tier verified by reading the rules only (see caveat above), not screenshotted.
- **Text-button touch targets (30px/38px)**: `.export-columns__heading .text-button` (30px, "Clear" link) and the base `.text-button` (38px) are inline text-style links, not block button controls — WCAG 2.5.5 exempts inline text links from the 44px target-size requirement. Left as-is.
- Two backend/API items surfaced during setup (unused `.sign-out-button` CSS class with no `.tsx` reference; the port-5173-vs-5174 CORS mismatch) are noted for completeness but are not frontend-design issues and were not touched — no dead-code removal beyond audit scope, and perl-api was not touched per constraints.

## Verification

```
npm run lint    → passed, no errors/warnings
npm run build   → tsc --noEmit passed, vite build succeeded (52.34 kB CSS / 343.61 kB JS, gzip 9.77 kB / 98.87 kB)
```

Both required by the task; both green after the six touch-target fixes above.

## Next steps (queued, not yet executed)

Two items from this audit weren't actioned here and are queued as a follow-up task, to run after the in-progress `SCALABLE-FRONTEND-TODO.md` execution finishes (same files — `styles.css` and page components — are being actively rewritten by that task, so running both at once risked clobbering edits):

1. **Remove dead CSS**: `.sign-out-button` class in `styles.css` has no corresponding `.tsx` reference (superseded by `AccountMenu`'s sign-out control). Confirm still unused post-SCALABLE-FRONTEND-TODO changes, then delete.
2. **Real breakpoint verification**: the 900px and 640px media queries were code-reviewed only, not screenshot-verified — the sandboxed Chrome window in this audit pass wouldn't honor `resize_window` past ~492 CSS px. Get an actual rendered check (retry `resize_window`/`claude-in-chrome`, or a fresh browser session) at both breakpoints across the key pages (dashboard, admin/users, admin/devices, attendance monitor/logs) before calling responsive coverage confirmed rather than inferred.

Both are small, targeted fixes — not a full re-audit. Re-run `npm run lint && npm run build` after.
