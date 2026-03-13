---
phase: 02-fsrs-scheduling-engine
plan: 01
subsystem: database
tags: [ts-fsrs, indexeddb, fsrs, spaced-repetition, chrome-extension, service-worker]

# Dependency graph
requires:
  - phase: 01-foundation-and-capture
    provides: IndexedDB v1 submissions store and saveSubmission() capture flow
provides:
  - Vendored ts-fsrs@5.2.3 UMD library at extension/lib/ts-fsrs.umd.js
  - IndexedDB v2 schema with cards and reviewLogs stores
  - FSRS card auto-creation on first Accepted submission (maybeCreateCard)
  - getCard, putCard, addReviewLog helper functions for future plans
affects:
  - 02-02 (review rating handler needs putCard + addReviewLog)
  - 02-03 (due-today query uses cards.due index)
  - 02-04 (stats computation reads reviewLogs store)

# Tech tracking
tech-stack:
  added:
    - "ts-fsrs@5.2.3 (vendored UMD bundle, ~72KB)"
  patterns:
    - "importScripts() for vendored UMD libraries in MV3 service worker"
    - "IndexedDB version migration guards using oldVersion < N"
    - "Fire-and-forget card creation with .catch() for non-blocking submission saves"
    - "ConstraintError guard on store.add() for idempotent card creation"
    - "ISO string dates in IndexedDB for portable key-range queries"

key-files:
  created:
    - extension/lib/ts-fsrs.umd.js
  modified:
    - extension/background.js

key-decisions:
  - "UMD global name is FSRS (not tsfsrs) — confirmed by inspecting bundle header: factory(global.FSRS = {})"
  - "maybeCreateCard is fire-and-forget from saveSubmission — card creation failure must not break submission capture"
  - "Both tasks implemented in a single background.js write; committed together in f10613a"

patterns-established:
  - "Pattern: ts-fsrs UMD via importScripts — const { createEmptyCard, fsrs, Rating, State } = FSRS"
  - "Pattern: IndexedDB upgrade guard — if (oldVersion < N) { createObjectStore(...) }"
  - "Pattern: idempotent card creation — getCard check before add, ConstraintError fallback for race"

requirements-completed: [FSRS-01]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 2 Plan 01: FSRS Data Layer Summary

**ts-fsrs@5.2.3 vendored as UMD bundle, IndexedDB migrated from v1 to v2 adding cards and reviewLogs stores, with FSRS card auto-creation hooked into saveSubmission for first Accepted submissions**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T06:06:25Z
- **Completed:** 2026-03-13T06:08:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Vendored ts-fsrs@5.2.3 UMD bundle (73,405 bytes) to extension/lib/ — no bundler needed
- Migrated IndexedDB from version 1 to version 2: added `cards` (keyPath=titleSlug, indexes: due, state) and `reviewLogs` (autoIncrement id, indexes: titleSlug, reviewedAt) stores
- Hooked `maybeCreateCard()` into `saveSubmission()` — every first Accepted submission now creates an FSRS card with due=now and state=New(0)

## Task Commits

Each task was committed atomically:

1. **Task 1 + Task 2: Vendor ts-fsrs, migrate DB to v2, and add card creation** - `f10613a` (feat)

**Plan metadata:** (docs commit — see below)

_Note: Both tasks were authored together in a single file write and committed as one atomic unit._

## Files Created/Modified

- `extension/lib/ts-fsrs.umd.js` — Vendored ts-fsrs@5.2.3 UMD bundle; exposes global `FSRS`
- `extension/background.js` — importScripts, DB v2 migration, getCard/putCard/addReviewLog helpers, maybeCreateCard, saveSubmission hook

## Decisions Made

- **UMD global is `FSRS`**: Confirmed by inspecting the bundle header. The file exposes `factory(global.FSRS = {})` — not `tsfsrs` as the research doc suggested as a possibility.
- **Fire-and-forget card creation**: `maybeCreateCard` is called with `.catch()` inside `saveSubmission` so a card creation failure never blocks or fails the submission capture.
- **saveSubmission notify logic**: Changed `if (saved && tabId !== null)` to `if (saved !== null)` for the card creation branch — submission key `0` would be falsy, though IndexedDB autoIncrement starts at 1 in practice.

## Deviations from Plan

None — plan executed exactly as written. Both tasks were implemented in the same file-write pass and committed together; this is noted but doesn't represent a deviation from the intended behavior.

## Issues Encountered

- The research doc listed the UMD global as `self.tsfsrs` (uncertain). Actual bundle inspection showed `FSRS` as the global. Corrected in implementation before committing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- IndexedDB v2 schema is live; all stores and indexes required by subsequent plans are in place
- `getCard`, `putCard`, `addReviewLog` helpers are available for plan 02-02 (review rating)
- `cards.due` and `cards.state` indexes are ready for plan 02-03 (due-today query)
- `reviewLogs.reviewedAt` index is ready for plan 02-04 (stats computation)

## Self-Check: PASSED

All created files confirmed on disk. Commit f10613a verified in git log.

---
*Phase: 02-fsrs-scheduling-engine*
*Completed: 2026-03-13*
