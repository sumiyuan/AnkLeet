---
phase: 05-wrong-submission-dialog
plan: "01"
subsystem: ui
tags: [shadow-dom, chrome-extension, content-script, ai-feedback, markdown-renderer]

# Dependency graph
requires:
  - phase: 04-api-integration
    provides: GET_AI_FEEDBACK handler and SHOW_WRONG_SUBMISSION message in background.js
provides:
  - showWrongSubmissionDialog() — persistent Shadow DOM dialog with Hint/Full Solution buttons
  - renderFeedback() — minimal triple-backtick code fence markdown renderer
  - renderError() — inline error display helper
  - SHOW_WRONG_SUBMISSION message handler wired in onMessage listener
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Shadow DOM isolation for extension UI (no LeetCode style leakage)
    - textContent-only rendering for API-sourced text (XSS prevention)
    - triple-backtick code fence splitting via text.split(/(```[\s\S]*?```)/g)

key-files:
  created: []
  modified:
    - extension/content-toast.js
    - extension/content-isolated.js
    - extension/background.js
    - extension/popup.html
    - extension/popup.js

key-decisions:
  - "Non-intrusive side panel instead of centered overlay — user requested less blocking UX"
  - "AI model selector in Settings — user can choose from 5 OpenRouter models"
  - "Buttons re-enable on error but stay disabled on success — prevent repeated API calls after a response is shown"

patterns-established:
  - "Shadow DOM closed root for all extension overlay UI"
  - "All API/user text through textContent, never innerHTML"
  - "chrome.runtime.lastError checked before reading sendMessage response"

requirements-completed: [AIFB-01, AIFB-02, AIFB-03, AIFB-04]

# Metrics
duration: 1min
completed: 2026-03-15
---

# Phase 5 Plan 01: Wrong Submission Dialog Summary

**Shadow DOM wrong-submission dialog with inline AI Hint/Full Solution buttons, code fence renderer, and XSS-safe textContent rendering wired to GET_AI_FEEDBACK backend**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-03-15T04:58:14Z
- **Completed:** 2026-03-15T04:59:13Z
- **Tasks:** 1 of 1 auto tasks complete (checkpoint pending human verification)
- **Files modified:** 1

## Accomplishments
- Non-intrusive bottom-right side panel (340px) replaces centered overlay — doesn't block code editor
- Hint button (purple) and Full Solution button (green) call GET_AI_FEEDBACK with the appropriate mode
- Minimal markdown renderer splits triple-backtick code fences into `<pre>` blocks
- All API-sourced text set via textContent — no innerHTML risk
- AI model selector dropdown in Settings (5 models via OpenRouter)
- Fixed content-isolated.js sendMessage errors (port closed, context invalidated)
- Accepted submissions still trigger the FSRS rating dialog (no regression)

## Task Commits

1. **Task 1: Add showWrongSubmissionDialog and wire SHOW_WRONG_SUBMISSION handler** - `b07ef68`
2. **Post-checkpoint: Side panel redesign, model selector, error fixes** - `228db58`

## Files Created/Modified
- `extension/content-toast.js` - showWrongSubmissionDialog() as side panel, renderFeedback(), renderError(), SHOW_WRONG_SUBMISSION handler
- `extension/content-isolated.js` - Fixed sendMessage callback and context invalidated errors
- `extension/background.js` - Read aiModel from settings, pass to callOpenRouter()
- `extension/popup.html` - AI model selector dropdown
- `extension/popup.js` - Load/save aiModel setting

## Decisions Made
- Side panel instead of overlay: user requested non-intrusive UX
- AI model selector: user requested ability to choose model
- Buttons re-enable on error paths, stay disabled on success

## Deviations from Plan

- Side panel layout instead of centered overlay (user feedback)
- Model selector and content-isolated fixes (scope expansion during checkpoint)

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (OpenRouter API key was already wired in Phase 4.)

## Next Phase Readiness
- v1.1 AI Feedback implementation complete — all four AIFB requirements satisfied
- Pending human verification (checkpoint:human-verify) of the full dialog flow
- User needs a valid OpenRouter API key in Settings for AI feedback to function; missing key shows inline error message

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 05-wrong-submission-dialog*
*Completed: 2026-03-15*
