---
phase: 02-fsrs-scheduling-engine
plan: 02
subsystem: scheduling-api
tags: [ts-fsrs, indexeddb, fsrs, spaced-repetition, chrome-extension, service-worker, message-handlers]

# Dependency graph
requires:
  - phase: 02-fsrs-scheduling-engine
    plan: 01
    provides: getCard, putCard, addReviewLog helpers; cards and reviewLogs IndexedDB stores
provides:
  - RATE_REVIEW message handler (card state transition via fsrs().repeat())
  - GET_DUE_TODAY message handler (cards due <= end of today)
  - GET_STATS message handler (totalReviews, retentionRate, streak)
affects:
  - 03-xx (popup UI consumes all three message types directly)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Chrome message handler async pattern: IIFE + return true for async sendResponse"
    - "if (!db) re-open guard in each message handler for service worker restart resilience"
    - "Date field reconstruction before FSRS scheduler call: new Date(stored.due)"
    - "IDBKeyRange.upperBound on ISO string for due-date range queries"
    - "Naive streak: count consecutive calendar days backward from today using a Set"

key-files:
  created: []
  modified:
    - extension/background.js

key-decisions:
  - "Both tasks implemented in a single file write; committed as one atomic unit (646ae62) — same pragmatic approach as Plan 01"
  - "Streak is naive (consecutive calendar days) — fair streak deferred to Phase 3 per research guidance"
  - "retentionRate rounds to integer via Math.round; returns 0 if no reviews"
  - "rateReview validates ratingName against ['Again','Hard','Good','Easy'] and throws on invalid input"

requirements-completed: [FSRS-02, FSRS-03, FSRS-04]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 2 Plan 02: FSRS Message Handlers Summary

**RATE_REVIEW, GET_DUE_TODAY, and GET_STATS message handlers added to service worker — completing the FSRS scheduling engine API with card state transitions, due-today querying, and statistics (retention rate, count, streak)**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T06:10:41Z
- **Completed:** 2026-03-13T06:12:23Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments

- Implemented `rateReview(database, titleSlug, ratingName)`: reconstructs Date fields (critical FSRS pitfall), calls `fsrs().repeat()`, persists updated card via `putCard` and review log via `addReviewLog`
- Implemented `getDueToday(database)`: queries `cards` store via `IDBKeyRange.upperBound(end.toISOString())` on the `due` index
- Implemented `getAllReviewLogs`, `computeStreak`, `getStats`: computes `totalReviews`, `retentionRate` (Good+Easy / total * 100, rounded), and consecutive calendar-day streak
- All three message handlers (`RATE_REVIEW`, `GET_DUE_TODAY`, `GET_STATS`) added to `onMessage` listener with async `sendResponse` pattern (`return true`) and `if (!db)` re-open guard
- Existing `SUBMISSION_CAPTURED` handler left unchanged

## Task Commits

Both tasks were implemented in the same file write and committed as one atomic unit:

1. **Task 1 + Task 2: RATE_REVIEW, GET_DUE_TODAY, GET_STATS handlers** - `646ae62` (feat)

## Files Created/Modified

- `extension/background.js` — Added rateReview, getDueToday, getAllReviewLogs, computeStreak, getStats functions; updated onMessage listener with three new async message handlers

## Decisions Made

- **Single commit**: Both tasks authored together in one file-write pass; committed as `646ae62` — consistent with Plan 01 approach.
- **Naive streak implementation**: Counts consecutive calendar days backward from today. Fair streak (skip days with nothing due) deferred to Phase 3 per research guidance. All data (reviewedAt timestamps) is captured to enable the enhancement.
- **retentionRate returns 0 for no reviews**: Guard `if (totalReviews > 0)` prevents division by zero; explicit 0 is a clean default.
- **ratingName validation**: Invalid rating strings throw early with a descriptive error so the message handler sends `{ error: ... }` rather than a confusing crash deeper in ts-fsrs.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three message types (`RATE_REVIEW`, `GET_DUE_TODAY`, `GET_STATS`) are live and async-safe
- Phase 3 popup UI can call all three directly via `chrome.runtime.sendMessage`
- Manual verification commands from plan are ready to use in DevTools service worker console

## Self-Check: PASSED

- `extension/background.js` confirmed on disk with all functions and handlers present
- Commit `646ae62` verified in git log

---
*Phase: 02-fsrs-scheduling-engine*
*Completed: 2026-03-13*
