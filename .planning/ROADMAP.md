# Roadmap: LeetReminder

## Overview

LeetReminder is built in three sequential phases that follow the data dependency chain: capture submissions to have data, schedule that data with FSRS to know when to review, then surface everything in a dashboard with notifications to make reviews unavoidable. Each phase delivers a distinct, verifiable capability; no phase can start until the previous one is complete.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation and Capture** - Working extension that captures LeetCode submissions and stores them locally (completed 2026-03-13)
- [x] **Phase 2: FSRS Scheduling Engine** - Scheduling engine that calculates review intervals and maintains card state (completed 2026-03-13)
- [ ] **Phase 3: Dashboard, Reviews, and Notifications** - Full popup UI with daily review queue, self-assessment rating, and browser notifications

## Phase Details

### Phase 1: Foundation and Capture
**Goal**: Users have a working Chrome extension that automatically records every LeetCode submission — accepted and wrong — locally with no manual input required.
**Depends on**: Nothing (first phase)
**Requirements**: CAPT-01, CAPT-02, STOR-01
**Success Criteria** (what must be TRUE):
  1. After submitting a LeetCode problem, the submission (code, result, timestamp, title, difficulty, tags, URL) appears in storage without any user action
  2. Both accepted and wrong submissions are captured, not just accepted ones
  3. The extension stays functional across browser restarts and service worker idle cycles (no state loss)
  4. Storage uses IndexedDB for submission history and chrome.storage.local for settings, keeping each within quota limits
**Plans:** 2/2 plans complete
Plans:
- [ ] 01-01-PLAN.md — Extension scaffold with MV3 manifest, service worker, and IndexedDB storage layer
- [ ] 01-02-PLAN.md — Submission interception pipeline (fetch override, message relay, toast notification)

### Phase 2: FSRS Scheduling Engine
**Goal**: Every captured submission has an FSRS card that calculates the optimal next review date, persists correctly across sessions, and surfaces a queryable due-today list.
**Depends on**: Phase 1
**Requirements**: FSRS-01, FSRS-02, FSRS-03, FSRS-04
**Success Criteria** (what must be TRUE):
  1. A new FSRS card is created for each problem's first submission and the initial due date is stored correctly in IndexedDB
  2. After a user rates a review (Again / Hard / Good / Easy), the card's next due date updates to a new calculated interval and the old card state is not mutated in place
  3. The due-today queue returns only problems whose FSRS due date is today or earlier (no problems due in the future, no problems that have never been captured)
  4. Review statistics (retention rate, review count, streak) are queryable and reflect the current card states accurately
**Plans:** 2/2 plans complete
Plans:
- [ ] 02-01-PLAN.md — Vendor ts-fsrs, IndexedDB v2 migration, FSRS card creation on first Accepted submission
- [ ] 02-02-PLAN.md — RATE_REVIEW, GET_DUE_TODAY, and GET_STATS message handlers

### Phase 3: Dashboard, Reviews, and Notifications
**Goal**: Users can open the extension popup to see their daily activity and due reviews, rate completed reviews to update scheduling, and receive browser notifications when reviews are due — even on days they don't open LeetCode.
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, NOTF-01, NOTF-02
**Success Criteria** (what must be TRUE):
  1. Opening the extension popup shows today's problems attempted with attempt counts and the count of reviews due
  2. The review queue lists each due problem with a link that opens the LeetCode problem page in a tab
  3. After completing a review on LeetCode and returning to the popup, the user can rate difficulty (Again / Hard / Good / Easy) and the card is updated immediately
  4. A browser notification fires when reviews become due, and the extension icon badge shows the current due count
  5. The settings page accepts and saves an OpenRouter API key and notification preferences without requiring a page reload
**Plans:** 1/3 plans executed
Plans:
- [ ] 03-01-PLAN.md — Manifest wiring, popup shell with tab navigation, GET_TODAY_SUBMISSIONS handler, Dashboard tab
- [ ] 03-02-PLAN.md — Reviews tab with inline rating and card removal, Settings tab with API key and notification prefs
- [ ] 03-03-PLAN.md — Alarm-driven badge updates and browser notifications in service worker

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation and Capture | 2/2 | Complete   | 2026-03-13 |
| 2. FSRS Scheduling Engine | 2/2 | Complete   | 2026-03-13 |
| 3. Dashboard, Reviews, and Notifications | 1/3 | In Progress|  |
