# Roadmap: LeetReminder

## Milestones

- **v1.0 MVP** — Phases 1-3 (shipped 2026-03-13)
- **v1.1 AI Feedback** — Phases 4-5 (in progress)

## Phases

<details>
<summary>v1.0 MVP (Phases 1-3) — SHIPPED 2026-03-13</summary>

- [x] **Phase 1: Foundation and Capture** - MV3 scaffold, IndexedDB schema, submission interception
- [x] **Phase 2: FSRS Scheduling Engine** - Card creation, FSRS rating, due-today queue
- [x] **Phase 3: Dashboard, Reviews, and Notifications** - Popup UI tabs, alarm badge, browser notifications

</details>

### v1.1 AI Feedback (In Progress)

**Milestone Goal:** Give users AI-powered feedback on wrong submissions — hint or full solution via OpenRouter API — displayed inline on the LeetCode page.

- [x] **Phase 4: API Integration** - Background service worker calls OpenRouter, reads existing API key, handles errors (completed 2026-03-14)
- [ ] **Phase 5: Wrong Submission Dialog** - Shadow DOM dialog with Hint/Full Solution buttons and inline AI response

## Phase Details

### Phase 4: API Integration
**Goal**: The extension can call the OpenRouter API from the background service worker and return structured feedback
**Depends on**: Phase 3 (v1.0 complete)
**Requirements**: API-01, API-02, API-03
**Success Criteria** (what must be TRUE):
  1. A wrong submission triggers a background handler that fetches from OpenRouter and returns a text response
  2. The handler reads the API key from the existing `openRouterApiKey` settings field without prompting the user to reconfigure
  3. When the API key is absent, invalid, or rate-limited, the handler returns a descriptive error string instead of throwing or silently failing
  4. `manifest.json` permits the fetch — no Chrome network block occurs
**Plans:** 1/1 plans complete
Plans:
- [ ] 04-01-PLAN.md — OpenRouter API handler, error handling, manifest permissions

### Phase 5: Wrong Submission Dialog
**Goal**: Users see a persistent wrong-submission dialog on the LeetCode page with AI feedback buttons that render the response inline
**Depends on**: Phase 4
**Requirements**: AIFB-01, AIFB-02, AIFB-03, AIFB-04
**Success Criteria** (what must be TRUE):
  1. After a wrong submission, a dialog appears on the LeetCode page with "Hint" and "Full Solution" buttons (replacing the auto-dismiss toast)
  2. Clicking "Hint" shows a loading state, then renders a nudge toward the solution without revealing the answer
  3. Clicking "Full Solution" shows a loading state, then renders a complete solution with explanation and code
  4. The AI response appears inside the dialog on the LeetCode page — no popup or new tab required
  5. Accepted submissions still show the FSRS rating dialog unchanged (no regression)
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Capture | v1.0 | 2/2 | Complete | 2026-03-13 |
| 2. FSRS Scheduling Engine | v1.0 | 2/2 | Complete | 2026-03-13 |
| 3. Dashboard, Reviews, and Notifications | v1.0 | 3/3 | Complete | 2026-03-13 |
| 4. API Integration | 1/1 | Complete   | 2026-03-14 | - |
| 5. Wrong Submission Dialog | v1.1 | 0/? | Not started | - |
