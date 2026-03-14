---
phase: 04-api-integration
plan: "01"
subsystem: api
tags: [openrouter, chrome-extension, mv3, background-service-worker, indexeddb, ai-feedback]

requires: []
provides:
  - GET_AI_FEEDBACK message handler in background.js (returns AI hint or full solution)
  - callOpenRouter() function with Bearer auth, OpenAI-compatible request/response
  - buildPrompt() for hint vs full-solution prompts with injection guard
  - getSubmissionById() IDB helper for submissions store lookup by auto-increment key
  - SHOW_WRONG_SUBMISSION message type replacing SHOW_TOAST for non-Accepted submissions
  - manifest.json host_permissions entry for openrouter.ai
affects:
  - 05-wrong-submission-dialog

tech-stack:
  added: []
  patterns:
    - "OpenRouter API via plain fetch() with Bearer auth from MV3 service worker"
    - "Service worker keepalive: setInterval(() => chrome.storage.local.get('_ping'), 20_000)"
    - "Async IIFE + return true pattern for message handlers (established, now extended)"
    - "IDB read helper: Promise wrapper with readonly transaction and store.get(key)"

key-files:
  created: []
  modified:
    - extension/manifest.json
    - extension/background.js

key-decisions:
  - "Used plain fetch() with Bearer auth — no SDK, no bundler, single POST endpoint"
  - "Non-streaming response only — Haiku 4.5 responds in 1-3s, loading spinner acceptable"
  - "API key read inside service worker only, never forwarded in sendMessage/sendResponse payloads"
  - "Keepalive heartbeat pattern (chrome.storage.local ping every 20s) prevents worker termination during slow API calls"
  - "SHOW_WRONG_SUBMISSION replaces SHOW_TOAST for non-Accepted results, carries submissionId for later GET_AI_FEEDBACK calls"

patterns-established:
  - "Rule: All OpenRouter calls must originate in background.js (never content scripts) — CORS constraint"
  - "Rule: API key never leaves the service worker context"
  - "Pattern: callOpenRouter() returns plain text string; all error cases throw descriptive Error objects"

requirements-completed: [API-01, API-02, API-03]

duration: 12min
completed: 2026-03-14
---

# Phase 4 Plan 01: API Integration Summary

**OpenRouter AI feedback handler in background service worker — GET_AI_FEEDBACK fetches hint or full solution via claude-haiku-4.5 using existing openRouterApiKey storage field**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-14T04:15:21Z
- **Completed:** 2026-03-14T04:27:43Z
- **Tasks:** 2 (1 auto, 1 human-verify)
- **Files modified:** 2

## Accomplishments
- Background service worker can now call OpenRouter API to return AI feedback (hint or full solution) for any wrong submission
- Wrong submissions now send `SHOW_WRONG_SUBMISSION` with `submissionId` instead of generic `SHOW_TOAST`, enabling Phase 5's dialog to trigger `GET_AI_FEEDBACK`
- Error classification covers all expected failure modes: missing key, 401 invalid key, 402 no credits, 429 rate limit, network failure, unexpected response format

## Task Commits

Each task was committed atomically:

1. **Task 1: Add manifest host_permissions and background.js API handler** - `4851bad` (feat)
2. **Task 2: Verify API integration works end-to-end** - human-verified, no commit needed

**Plan metadata:** (docs commit — see below)

## Files Created/Modified
- `extension/manifest.json` — Added `https://openrouter.ai/*` to `host_permissions` (now 3 entries)
- `extension/background.js` — Added `getSubmissionById()`, `buildPrompt()`, `callOpenRouter()`, `GET_AI_FEEDBACK` handler; modified `saveSubmission()` wrong-answer branch

## Decisions Made
- Used plain `fetch()` — no SDK needed for a single POST endpoint, and the project has no bundler
- Non-streaming response: Haiku 4.5 answers in 1-3s; streaming would require `chrome.runtime.connect()` long-lived ports (Rule 4 complexity, deferred)
- Keepalive heartbeat via `chrome.storage.local.get('_ping')` every 20s (documented MV3 pattern to reset 30s idle timer)
- `SHOW_WRONG_SUBMISSION` carries `submissionId` (IDB auto-increment key) not `titleSlug` to avoid race condition if user submits the same problem multiple times rapidly

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. All 17/17 automated verification checks passed. Human verification confirmed SHOW_WRONG_SUBMISSION fires correctly on wrong submissions with no errors.

## User Setup Required

Users must add a valid OpenRouter API key in the extension Settings popup (`openRouterApiKey` field). Without it, `GET_AI_FEEDBACK` returns `{error: 'No API key configured. Add your OpenRouter API key in Settings.'}`.

## Next Phase Readiness

- `GET_AI_FEEDBACK` message handler is live and tested — Phase 5 can call it directly from the wrong-submission dialog
- `SHOW_WRONG_SUBMISSION` is now fired for all non-Accepted submissions with `submissionId`, `titleSlug`, and `title`
- Phase 5 needs to handle `SHOW_WRONG_SUBMISSION` in `content-toast.js` to show the dialog UI with Hint and Full Solution buttons

---
*Phase: 04-api-integration*
*Completed: 2026-03-14*
