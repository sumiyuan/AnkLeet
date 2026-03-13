---
phase: 01-foundation-and-capture
plan: 02
subsystem: capture
tags: [chrome-extension, manifest-v3, fetch-intercept, xhr-intercept, rest-api, shadow-dom, toast, postmessage, indexeddb]

# Dependency graph
requires:
  - phase: 01-01
    provides: Service worker (background.js) with SUBMISSION_CAPTURED handler and SHOW_TOAST relay; IndexedDB 'leetreminder' v1 schema
provides:
  - Fetch + XHR interceptor in MAIN world targeting LeetCode REST submission flow (POST /submit/ + GET /check/)
  - _titleSlug enrichment from window.location at intercept time — no extra API call
  - Message relay in ISOLATED world that forwards postMessage data to service worker via chrome.runtime.sendMessage
  - Shadow DOM toast notification triggered by SHOW_TOAST message from service worker
  - background.js saveSubmission handles both GraphQL submissionDetails and REST /check/ response shapes
  - End-to-end capture pipeline verified on live LeetCode: submission -> IndexedDB -> toast, duplicates prevented
affects:
  - Phase 2 (FSRS engine will read submissions from IndexedDB store built here)
  - Phase 3 (dashboard will query this store; toast infrastructure established)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - MAIN world dual interceptor: both window.fetch and XMLHttpRequest.prototype.send overridden for coverage
    - REST submission detection by body.finished === true && body.submission_id (not operationName)
    - Page context enrichment: _titleSlug extracted from window.location.pathname at intercept time
    - window.postMessage with source identifier for cross-world message passing
    - ISOLATED world validates event.source === window before acting on postMessage
    - chrome.runtime.sendMessage with retry (500ms) for service worker startup latency
    - Dual format saveSubmission: detect by presence of data.question to distinguish GraphQL vs REST shape
    - Closed Shadow DOM for toast — LeetCode styles cannot bleed in
    - all: initial CSS reset inside shadow root

key-files:
  created:
    - extension/content-main.js
    - extension/content-isolated.js
    - extension/content-toast.js
  modified:
    - extension/background.js

key-decisions:
  - "LeetCode uses REST endpoints (POST /submit/ + GET /check/) not GraphQL for submissions — interceptor rewritten after live traffic verification"
  - "Both fetch and XHR intercepted for coverage — LeetCode may use either"
  - "Enrich REST response with _titleSlug from window.location at intercept time — no separate API call (locked decision maintained)"
  - "background.js saveSubmission detects format by presence of data.question (GraphQL has nested question object; REST does not)"
  - "Retry chrome.runtime.sendMessage once after 500ms — handles service worker startup window without losing the submission"
  - "Closed Shadow DOM mode for toast — extension internals inaccessible to LeetCode page scripts"

patterns-established:
  - "Pattern: MAIN world dual interceptor — override both window.fetch and XMLHttpRequest.prototype for full REST coverage"
  - "Pattern: REST result detection — check body.finished === true and presence of submission_id, not URL alone"
  - "Pattern: Page context enrichment — extract _titleSlug from pathname and attach before postMessage (underscore prefix distinguishes injected fields)"
  - "Pattern: Cross-world relay — MAIN posts via window.postMessage with source tag, ISOLATED validates source before forwarding"
  - "Pattern: Dual format saveSubmission — branch on data.question presence to handle GraphQL vs REST shapes"
  - "Pattern: Shadow DOM toast — closed mode, all: initial reset, fixed bottom-right, auto-dismiss with CSS fade"

requirements-completed: [CAPT-01, CAPT-02]

# Metrics
duration: ~30min
completed: 2026-03-13
---

# Phase 1 Plan 02: Submission Capture Pipeline Summary

**Fetch + XHR interceptor in MAIN world capturing LeetCode REST submission results, relayed via postMessage bridge to service worker for IndexedDB storage, with Shadow DOM toast confirming each capture — verified end-to-end on live LeetCode**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-03-13T04:38:07Z
- **Completed:** 2026-03-13T05:10:00Z
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint, approved)
- **Files modified:** 4

## Accomplishments
- Built fetch + XHR dual interceptor in MAIN world detecting LeetCode's REST submission poll (GET /check/ with `finished: true`); enriches payload with `_titleSlug` from `window.location.pathname`
- Implemented two-stage message relay: MAIN world -> `window.postMessage` (source='leetreminder') -> content-isolated.js -> `chrome.runtime.sendMessage(SUBMISSION_CAPTURED)` -> background.js
- Created closed Shadow DOM toast (bottom-right, dark theme, auto-dismiss 2s with CSS fade) triggered by `SHOW_TOAST` from service worker
- Extended background.js `saveSubmission` to handle both GraphQL `submissionDetails` format and REST `/check/` endpoint format
- Human-verified end-to-end on live LeetCode: submissions stored in IndexedDB, toast appears and dismisses, duplicate prevention confirmed

## Task Commits

Each task was committed atomically:

1. **Task 1: Create fetch interceptor and message relay scripts** - `9868d41` (feat)
2. **Task 2: Create Shadow DOM toast notification** - `1251e2f` (feat)
3. **Task 1 rewrite: Rewrite interceptor for LeetCode REST submission flow** - `a6d3e33` (fix)
4. **Task 3: Human verification checkpoint** - approved by user (no commit needed)

**Plan metadata:** `e589482` (docs: complete plan — pre-checkpoint commit)

## Files Created/Modified
- `extension/content-main.js` - MAIN world fetch + XHR interceptor; detects final /check/ response with `finished:true`; enriches with `_titleSlug`; posts to window with source='leetreminder'
- `extension/content-isolated.js` - ISOLATED world message relay; validates source/type; forwards SUBMISSION_CAPTURED to service worker; retry once on failure
- `extension/content-toast.js` - Shadow DOM toast; closed shadow root; fixed bottom-right; dark theme; auto-dismiss 2s with fade transition
- `extension/background.js` - Extended saveSubmission to handle REST /check/ format in addition to GraphQL submissionDetails format

## Decisions Made
- LeetCode uses REST, not GraphQL, for submission results: POST `/problems/{slug}/submit/` returns a submission_id, then GET `/submissions/detail/{id}/check/` is polled until `finished: true`. The original plan assumed GraphQL; rewritten after live traffic observation.
- Both `window.fetch` and `XMLHttpRequest` are intercepted — coverage for both request mechanisms.
- Page context (`_titleSlug`) extracted from `window.location.pathname` at intercept time — no separate API call (locked decision from research phase maintained).
- `saveSubmission` branches on `data.question` presence: GraphQL responses nest question metadata; REST responses do not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Rewrote interceptor from GraphQL-only to REST after live traffic verification**
- **Found during:** Task 1 testing — live LeetCode showed no GraphQL submissionDetails requests firing
- **Issue:** Plan targeted `operationName: "submissionDetails"` in GraphQL request body. Live LeetCode traffic (confirmed via DevTools Network) revealed submission results arrive exclusively via REST: POST `/problems/{slug}/submit/` then polling GET `/submissions/detail/{id}/check/` until `finished: true`. The GraphQL intercept never fires — zero submissions would be captured.
- **Fix:** Rewrote content-main.js to intercept both fetch and XHR on URLs matching `/submit/`, `/check/`, or `submission`. Detects final result by `body.finished === true && body.submission_id`. Enriches with `_titleSlug` from pathname. Updated background.js saveSubmission with a second branch to normalize REST response shape.
- **Files modified:** extension/content-main.js, extension/background.js
- **Verification:** User confirmed end-to-end on live LeetCode — submissions appear in IndexedDB with correct fields, toast shows
- **Committed in:** `a6d3e33` (fix commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Essential fix — without it zero submissions would be captured. Plan's GraphQL assumption was incorrect; REST flow confirmed by live traffic. background.js dual-format handling adds ~15 lines of planned complexity. No scope creep.

## Issues Encountered
- LeetCode's actual submission API differs from what research assumed. Research documented GraphQL `submissionDetails` as the endpoint; in practice, submission results are delivered via REST polling. The fix was straightforward once the correct endpoints were identified from live DevTools Network inspection.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Full capture pipeline operational and verified end-to-end on live LeetCode
- Both accepted and wrong submissions stored in IndexedDB with fields: submissionId, titleSlug, title, difficulty, topicTags, url, code, lang, statusDisplay, capturedAt
- Note: `difficulty` and `topicTags` are null/empty for REST-captured submissions — REST `/check/` endpoint does not return question metadata. Phase 2 or 3 may enrich via LeetCode problem API if needed.
- Phase 1 complete — Phase 2 (FSRS Scheduling Engine) can begin

## Self-Check: PASSED

- extension/content-main.js: FOUND
- extension/content-isolated.js: FOUND
- extension/content-toast.js: FOUND
- extension/background.js: FOUND (modified)
- 01-02-SUMMARY.md: FOUND
- Commit 9868d41: FOUND (feat: fetch interceptor and message relay)
- Commit 1251e2f: FOUND (feat: Shadow DOM toast notification)
- Commit a6d3e33: FOUND (fix: rewrite interceptor for REST flow)

---
*Phase: 01-foundation-and-capture*
*Completed: 2026-03-13*
