---
phase: 03-dashboard-reviews-notifications
plan: 03
subsystem: notifications
tags: [chrome-extension, service-worker, chrome.alarms, chrome.notifications, indexeddb, badge]

# Dependency graph
requires:
  - phase: 03-01
    provides: background.js with getDueToday, rateReview, message handlers, popup and DB wiring

provides:
  - Alarm-driven badge updates on extension icon (count of due reviews)
  - Browser notification fired once per day when reviews are due and conditions met
  - GET_DUE_TODAY enriched with title and difficulty joined from submissions store
  - updateBadge() utility function
  - enrichCardsWithSubmissionData() function

affects:
  - popup (Reviews tab consumes enriched GET_DUE_TODAY cards with title/difficulty)
  - future notification preferences (notificationsEnabled, notificationTime wired)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - chrome.alarms.get() + chrome.alarms.create() at module scope for idempotent alarm registration
    - Fixed notification ID 'dueReviews' to prevent notification stacking on repeat alarms
    - lastNotifiedDate as separate chrome.storage.local key (not nested in settings object)
    - IDBKeyRange.only() with getAll() for per-titleSlug submission lookup in enrichment join
    - Immediate badge update in openDatabase().then() chain for zero-gap on startup

key-files:
  created: []
  modified:
    - extension/background.js

key-decisions:
  - "enrichCardsWithSubmissionData picks most recent submission by capturedAt for title/difficulty fallback"
  - "onAlarm listener registered at top level (module scope), not inside any callback"
  - "lastNotifiedDate stored as separate key to avoid overwriting settings object"
  - "Fixed notification ID 'dueReviews' replaces existing notification on re-trigger (no stacking)"

patterns-established:
  - "Pattern 1: Alarm listener at top level — chrome.alarms.onAlarm.addListener registered at module scope alongside onMessage and onInstalled"
  - "Pattern 2: Idempotent alarm creation — chrome.alarms.get() before create() prevents duplicate alarms across worker restarts"

requirements-completed: [NOTF-01, NOTF-02]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 03 Plan 03: Badge Notifications and Card Enrichment Summary

**Alarm-driven extension badge showing due review count, daily browser notification with time/dedup guards, and GET_DUE_TODAY enriched with problem title and difficulty from submissions store**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T09:51:56Z
- **Completed:** 2026-03-13T09:53:19Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Extension icon badge reflects current due review count, updated on startup and every minute via alarm
- Browser notification fires once per calendar day when reviews are due, notifications are enabled, and current time is past `notificationTime`
- GET_DUE_TODAY response now includes `title` and `difficulty` fields joined from the submissions store (latest submission per titleSlug)
- Badge also updates immediately after RATE_REVIEW so the popup rating action reflects the new count

## Task Commits

1. **Task 1: Enhance GET_DUE_TODAY with title/difficulty, add alarm badge notifications** - `5f066b3` (feat)

## Files Created/Modified

- `extension/background.js` - Added `updateBadge()`, `enrichCardsWithSubmissionData()`, alarm creation at module scope, `chrome.alarms.onAlarm.addListener` at top level, badge update on startup and after RATE_REVIEW, title/difficulty join in GET_DUE_TODAY handler

## Decisions Made

- `enrichCardsWithSubmissionData` uses a single `submissions` transaction and picks the most recently captured submission (by `capturedAt`) to source `title` and `difficulty` — avoids multiple transactions and handles multiple submissions per problem
- `lastNotifiedDate` stored as a separate `chrome.storage.local` key rather than nesting it inside `settings`, so the notification system does not risk corrupting the settings object on write
- Fixed notification ID `'dueReviews'` ensures Chrome replaces (not stacks) notifications if an existing one is still visible when the next alarm fires

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 03 complete: badge, notifications, and card enrichment all implemented
- Reviews tab in popup can now render problem titles and difficulty badges from GET_DUE_TODAY
- No blockers for v1.0 milestone

---
*Phase: 03-dashboard-reviews-notifications*
*Completed: 2026-03-13*
