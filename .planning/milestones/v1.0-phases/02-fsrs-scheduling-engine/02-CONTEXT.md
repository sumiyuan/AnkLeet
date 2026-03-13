# Phase 2: FSRS Scheduling Engine - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Scheduling engine that creates FSRS cards for captured problems, calculates optimal review intervals, persists card state and review history, and exposes a queryable due-today list with review statistics. Covers FSRS-01, FSRS-02, FSRS-03, FSRS-04. The popup UI for reviews, rating buttons, and notifications belong to Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Card granularity
- One FSRS card per problem (keyed by titleSlug), not per submission
- Card created on first Accepted submission only — wrong-only problems don't get scheduled
- All submissions (wrong + accepted) are linked to the card retroactively, giving a full attempt history per problem
- Re-submitting on LeetCode does NOT auto-complete a review — reviews are explicit only (user must rate Again/Hard/Good/Easy in the Phase 3 popup)

### Review history storage
- Full review log: each review stored as a separate log entry (rating, timestamp, old state, new state)
- Enables retention rate calculation, review count tracking, and streak computation

### IndexedDB schema
- Add `cards` and `reviewLogs` object stores to the existing `leetreminder` database
- Bump schema version from 1 to 2
- Cards reference submissions by titleSlug

### Review statistics
- Retention rate: percentage of reviews rated Good or Easy vs Again
- Review count + consecutive-day streak
- Streak only resets if reviews were due and skipped — no penalty for days with nothing due

### Claude's Discretion
- FSRS library choice (ts-fsrs vs custom implementation) and MV3 bundling approach
- Exact FSRS parameter defaults (desired retention, initial stability, etc.)
- Due-today query API shape and internal data access patterns
- Cards-by-state breakdown (New/Learning/Review/Relearning) — may include if straightforward
- Review log entry schema details

</decisions>

<specifics>
## Specific Ideas

- User wants the deferred idea from Phase 1 fulfilled: difficulty rating prompts belong in Phase 3 UI, but the FSRS card state and rating logic must be ready in Phase 2
- Streak behavior modeled after "fair" streaks — no punishment for days when nothing is due

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `background.js`: Service worker with IndexedDB open/write pattern (`openDatabase()`, `addRecord()`) — extend for cards and review logs
- `openDatabase()` with `onupgradeneeded` handler — add version 2 migration here
- Submissions store has `titleSlug` index — use for card-to-submissions lookup

### Established Patterns
- All storage operations happen in the service worker (background.js)
- Message passing from content scripts to background via `chrome.runtime.sendMessage`
- `store.add()` with ConstraintError handling for deduplication
- Module-scope DB reference with lazy re-open on null

### Integration Points
- Card creation hooks into the existing `saveSubmission()` flow — after storing a submission, check if an Accepted submission triggers card creation
- Phase 3 will call into the scheduling engine via message passing to the service worker
- Due-today query will be consumed by Phase 3's popup UI

</code_context>

<deferred>
## Deferred Ideas

- AI feedback on wrong submissions (v2 — AIFB-01, AIFB-02)
- First-attempt vs multi-attempt tracking as FSRS signal (v2 — DATA-03)
- Cards-by-state dashboard visualization — Phase 3

</deferred>

---

*Phase: 02-fsrs-scheduling-engine*
*Context gathered: 2026-03-13*
