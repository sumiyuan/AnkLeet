---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planning
stopped_at: Completed 03-dashboard-reviews-notifications-03-01-PLAN.md
last_updated: "2026-03-13T09:50:56.209Z"
last_activity: 2026-03-13 — Roadmap created
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 7
  completed_plans: 5
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-12)

**Core value:** Users never forget a LeetCode problem — every submission is tracked and the FSRS algorithm surfaces problems for review at the optimal time.
**Current focus:** Phase 1 — Foundation and Capture

## Current Position

Phase: 1 of 3 (Foundation and Capture)
Plan: 0 of ? in current phase
Status: Ready to plan
Last activity: 2026-03-13 — Roadmap created

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: —
- Total execution time: —

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: —
- Trend: —

*Updated after each plan completion*
| Phase 01-foundation-and-capture P01 | 1 | 2 tasks | 5 files |
| Phase 01-foundation-and-capture P02 | 1 | 2 tasks | 3 files |
| Phase 01-foundation-and-capture P02 | 30 | 3 tasks | 4 files |
| Phase 02-fsrs-scheduling-engine P01 | 2 | 2 tasks | 2 files |
| Phase 02-fsrs-scheduling-engine P02 | 2 | 2 tasks | 1 files |
| Phase 03-dashboard-reviews-notifications P01 | 2 | 1 tasks | 5 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Local-only storage (chrome.storage.local + IndexedDB — no backend)
- OpenRouter for AI with user-provided API key (v2)
- FSRS over SM-2 for scheduling
- [Phase 01-foundation-and-capture]: Use store.add() (not put()) so unique submissionId index enforces deduplication via ConstraintError
- [Phase 01-foundation-and-capture]: IndexedDB schema locked at version 1 — increment required for any structural change
- [Phase 01-foundation-and-capture]: Open IndexedDB eagerly at worker startup; re-open if null at saveSubmission call time (worker restart guard)
- [Phase 01-foundation-and-capture]: Filter GraphQL intercepts by operationName='submissionDetails' to avoid performance impact from intercepting all LeetCode GraphQL calls
- [Phase 01-foundation-and-capture]: Closed Shadow DOM mode for toast — extension internals inaccessible to LeetCode page scripts
- [Phase 01-foundation-and-capture]: LeetCode uses REST endpoints (POST /submit/ + GET /check/) not GraphQL for submissions — interceptor rewritten after live traffic verification
- [Phase 01-foundation-and-capture]: background.js saveSubmission detects format by presence of data.question to distinguish GraphQL vs REST /check/ shape
- [Phase 02-fsrs-scheduling-engine]: UMD global for ts-fsrs is FSRS (not tsfsrs) — confirmed from bundle header inspection
- [Phase 02-fsrs-scheduling-engine]: maybeCreateCard is fire-and-forget from saveSubmission using .catch() — card failure must not block submission capture
- [Phase 02-fsrs-scheduling-engine]: Both tasks implemented in single file write; committed as 646ae62 (same approach as Plan 01)
- [Phase 02-fsrs-scheduling-engine]: Naive streak (consecutive calendar days) used; fair streak deferred to Phase 3
- [Phase 03-dashboard-reviews-notifications]: capturedAt stored as Date.now() integer ms — IDBKeyRange.bound uses numeric timestamps for GET_TODAY_SUBMISSIONS
- [Phase 03-dashboard-reviews-notifications]: alarms and notifications permissions added in plan 01 alongside popup wiring to avoid a second manifest edit in plan 03

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: LeetCode submission API endpoint (GraphQL operationName or REST path) needs live traffic verification before building the interceptor — do not hard-code without confirming
- [Phase 1]: IndexedDB schema versioning strategy must be locked before any data is written — costly to migrate once in browsers
- [Phase 2]: @openrouter/sdk MV3 compatibility unverified (deferred to v2, but note for Phase 2 if API key storage is wired in Phase 3)

## Session Continuity

Last session: 2026-03-13T09:50:56.205Z
Stopped at: Completed 03-dashboard-reviews-notifications-03-01-PLAN.md
Resume file: None
