---
phase: 03-dashboard-reviews-notifications
plan: 02
subsystem: ui
tags: [chrome-extension, popup, reviews, settings, fsrs, chrome.storage, animation]

# Dependency graph
requires:
  - phase: 03-01
    provides: Popup shell with tab bar, tab switching logic, popup.html/popup.css/popup.js
  - phase: 03-03
    provides: GET_DUE_TODAY enriched with title/difficulty, RATE_REVIEW handler in background.js

provides:
  - Reviews tab rendering due cards with title, difficulty badge, LeetCode link, and 4 rating buttons
  - Card removal animation on rating (opacity/max-height CSS transition)
  - Review count header updating after each rating
  - Empty state "All caught up!" when queue is exhausted
  - Settings tab with OpenRouter API key input, notification toggle, reminder time picker
  - Settings save/load with merge pattern preserving captureEnabled and other existing fields

affects:
  - Users can now rate due reviews directly in the popup
  - Settings stored in chrome.storage.local available to background.js notification system

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "removeCard() uses CSS class + transitionend { once: true } for clean exit animation"
    - "Settings saved with spread merge: { ...existing, ...newValues } to preserve captureEnabled"
    - "loadReviews() and loadSettings() called on tab switch — data always fresh on tab activation"

key-files:
  created: []
  modified:
    - extension/popup.html
    - extension/popup.css
    - extension/popup.js

key-decisions:
  - "Both tasks committed in a single atomic commit since all three files were modified together for reviews and settings simultaneously"
  - "Tab switch handlers now call loadReviews() and loadSettings() respectively — data always fresh on activation"
  - "After a successful rating, loadDashboard() is called to refresh the stats bar (totalReviews changes)"
  - "notificationsEnabled defaults to true in loadSettings() — consistent with background.js notification guard"

patterns-established:
  - "Pattern 1: Tab-lazy loading — each tab's data function called on tab activation, not on popup open"
  - "Pattern 2: Settings merge — always read existing settings before writing to preserve all keys"

requirements-completed: [DASH-02, DASH-03]

# Metrics
duration: 2min
completed: 2026-03-13
---

# Phase 3 Plan 02: Reviews Tab and Settings Tab Summary

**Review queue popup with FSRS rating buttons and exit animation, plus settings tab persisting API key and notification preferences via a merge-safe chrome.storage.local write**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-13T09:54:46Z
- **Completed:** 2026-03-13T09:56:09Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Reviews tab shows all due cards with problem title (from enriched GET_DUE_TODAY), difficulty badge, and clickable LeetCode link that opens a new tab
- Rating buttons (Again / Hard / Good / Easy) send RATE_REVIEW to background.js and animate the card out with a CSS opacity/max-height transition
- Review count header updates after each rating; "All caught up!" empty state appears when queue is exhausted
- Settings tab stores OpenRouter API key (for v2 AI features), notification toggle, and reminder time, persisted to chrome.storage.local
- Save uses spread merge pattern so captureEnabled and any future fields are never overwritten

## Task Commits

1. **Task 1: Reviews tab with inline rating and card removal animation** - `f52e925` (feat)

Note: Task 2 (Settings tab) HTML/CSS/JS changes were applied in the same commit because all three files were modified for both tasks in one pass — both tasks are fully covered by this commit.

## Files Created/Modified

- `extension/popup.html` — Added reviews header, #review-list, #review-empty; settings form with api-key, notif-enabled, notif-time inputs and save button
- `extension/popup.css` — Added .review-card, .removing animation, .rating-btn styles, settings form/input/checkbox/save-btn/save-status styles
- `extension/popup.js` — Added loadReviews(), renderReviewQueue(), removeCard(), updateReviewCountHeader(), loadSettings(), saveSettings(); wired tab-switch callbacks and save button

## Decisions Made

- Both tasks committed in one atomic commit because all three popup files needed changes for both reviews and settings simultaneously.
- After a successful RATE_REVIEW response, `loadDashboard()` is called to refresh the stats bar so `totalReviews` reflects the new count.
- Settings `notificationsEnabled` defaults to `true` in `loadSettings()` matching the default assumed by the background.js notification check.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Load unpacked extension in chrome://extensions to test.

## Next Phase Readiness

- All three Phase 03 plans (01, 02, 03) are now complete
- v1.0 milestone fully implemented: submission capture, FSRS scheduling, dashboard, reviews, notifications
- No blockers

## Self-Check: PASSED

- `extension/popup.html` — confirmed present with api-key, notif-enabled, notif-time
- `extension/popup.css` — confirmed present with .review-card and .removing
- `extension/popup.js` — confirmed present with RATE_REVIEW, chrome.tabs.create, transitionend, loadReviews, loadSettings
- Commit `f52e925` confirmed in git log

---
*Phase: 03-dashboard-reviews-notifications*
*Completed: 2026-03-13*
