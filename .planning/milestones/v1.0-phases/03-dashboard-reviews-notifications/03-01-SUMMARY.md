---
phase: 03-dashboard-reviews-notifications
plan: 01
subsystem: ui
tags: [chrome-extension, popup, indexeddb, manifest-v3, tabs, dashboard]

# Dependency graph
requires:
  - phase: 02-fsrs-scheduling-engine
    provides: GET_STATS and GET_DUE_TODAY message handlers, cards store, reviewLogs store
  - phase: 01-foundation-and-capture
    provides: submissions store with capturedAt index, background.js message passing pattern

provides:
  - Popup UI shell with three-tab navigation (Dashboard, Reviews, Settings)
  - Stats bar displaying retention rate, total reviews, and streak from live data
  - Today's activity list aggregated by titleSlug with attempt counts and difficulty badges
  - GET_TODAY_SUBMISSIONS message handler querying submissions by numeric capturedAt range

affects:
  - 03-02 (Reviews tab — builds on popup.html/popup.js shell and uses GET_DUE_TODAY + RATE_REVIEW)
  - 03-03 (Notifications — uses alarms and notifications permissions added to manifest)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Popup communicates with background via chrome.runtime.sendMessage; all storage in service worker"
    - "Tab switching via data-tab attribute and active CSS class toggling"
    - "Activity aggregation in popup.js: group submissions by titleSlug, count attempts"

key-files:
  created:
    - extension/popup.html
    - extension/popup.css
    - extension/popup.js
  modified:
    - extension/manifest.json
    - extension/background.js

key-decisions:
  - "capturedAt is stored as Date.now() integer ms — IDBKeyRange.bound uses numeric timestamps, not ISO strings"
  - "alarms and notifications permissions added alongside popup wiring to avoid a second manifest edit in plan 03"
  - "popup.js calls GET_STATS and GET_TODAY_SUBMISSIONS in parallel via Promise.all for single render pass"

patterns-established:
  - "No inline scripts in popup.html — MV3 CSP compliance enforced throughout"
  - "aggregateTodayActivity() helper groups by titleSlug before rendering — reusable pattern"

requirements-completed: [DASH-01]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 3 Plan 01: Dashboard Popup Shell Summary

**Chrome extension popup wired with tabbed navigation, stats bar, and today's activity list backed by a new GET_TODAY_SUBMISSIONS handler in background.js**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T09:48:04Z
- **Completed:** 2026-03-13T09:50:08Z
- **Tasks:** 1
- **Files modified:** 5

## Accomplishments

- Manifest updated with `action.default_popup`, `alarms`, and `notifications` permissions
- Popup shell with tab bar (Dashboard / Reviews / Settings) and tab switching logic
- Stats bar renders live retention rate, review count, and streak from GET_STATS
- Today's activity list aggregates submissions by problem and shows attempt counts with color-coded difficulty badges
- `getTodaySubmissions()` queries the submissions store via numeric IDBKeyRange on the `capturedAt` index

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire manifest, create popup shell, and add GET_TODAY_SUBMISSIONS handler** - `ccf691a` (feat)

## Files Created/Modified

- `extension/manifest.json` — Added `action.default_popup`, `alarms`, `notifications` permissions
- `extension/popup.html` — Three-tab popup shell (47 lines, no inline scripts)
- `extension/popup.css` — Tab bar, stats bar, activity list, difficulty badge styles (194 lines)
- `extension/popup.js` — Tab switching, dashboard data loading, activity aggregation (145 lines)
- `extension/background.js` — Added `GET_TODAY_SUBMISSIONS` handler and `getTodaySubmissions()` function

## Decisions Made

- `capturedAt` is stored as `Date.now()` integer milliseconds, so the IDBKeyRange query uses `start.getTime()` and `end.getTime()` (numeric bounds), not ISO string bounds.
- Added `alarms` and `notifications` permissions alongside the popup wiring to avoid a separate manifest edit when plan 03 implements notifications.
- `GET_STATS` and `GET_TODAY_SUBMISSIONS` are called in parallel via `Promise.all` so the dashboard renders in a single pass.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Load unpacked extension in chrome://extensions to test.

## Next Phase Readiness

- Popup shell ready for Reviews tab implementation (plan 03-02)
- `RATE_REVIEW`, `GET_DUE_TODAY`, and existing handlers in background.js remain untouched
- `alarms` and `notifications` permissions in place for plan 03-03 (notification scheduling)

## Self-Check: PASSED

All 5 files confirmed present on disk. Commit `ccf691a` confirmed in git log.

---
*Phase: 03-dashboard-reviews-notifications*
*Completed: 2026-03-13*
