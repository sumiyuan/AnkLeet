# Phase 1: Foundation and Capture - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Working Chrome extension (Manifest V3) that automatically captures every LeetCode submission — accepted and wrong — and stores it locally with no manual input. Covers CAPT-01, CAPT-02, STOR-01. Dashboard, FSRS scheduling, and notifications are separate phases.

</domain>

<decisions>
## Implementation Decisions

### Submission interception
- Network interception via chrome.webRequest or declarativeNetRequest to catch the GraphQL/REST submission call
- Parse problem metadata (title, difficulty, tags, URL) from the submission response itself — no separate API call or DOM scraping
- Scope limited to problem pages only (leetcode.com/problems/*) — contest pages excluded

### User feedback on capture
- Brief toast notification on every captured submission — bottom-right corner of the LeetCode page
- Minimal content: "Submission captured" with a checkmark — no problem details shown
- Same neutral appearance for both accepted and wrong submissions
- Toast auto-dismisses after ~2 seconds

### Claude's Discretion
- Error handling strategy when LeetCode API structure changes (silent fail + log vs user warning)
- Service worker persistence and recovery across browser restarts and idle cycles
- IndexedDB schema design and versioning strategy
- Toast styling and animation details
- Exact network request URL patterns to intercept

</decisions>

<specifics>
## Specific Ideas

- User mentioned wanting difficulty rating prompts after capture — this is the FSRS review flow and belongs in Phase 2/3, not Phase 1

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None yet — Phase 1 establishes the foundational patterns

### Integration Points
- Content script injects into LeetCode problem pages
- Service worker (background.js) handles storage operations
- IndexedDB for submission history, chrome.storage.local for settings

</code_context>

<deferred>
## Deferred Ideas

- Difficulty rating prompt after submission capture — belongs in Phase 2 (FSRS) / Phase 3 (Dashboard UI)
- Contest page submission capture — could be added as a future enhancement

</deferred>

---

*Phase: 01-foundation-and-capture*
*Context gathered: 2026-03-13*
