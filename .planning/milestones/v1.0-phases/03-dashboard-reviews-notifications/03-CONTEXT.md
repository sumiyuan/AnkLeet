# Phase 3: Dashboard, Reviews, and Notifications - Context

**Gathered:** 2026-03-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Full popup UI with three tabs (Dashboard, Reviews, Settings), browser notifications when reviews are due, and extension icon badge showing due count. Covers DASH-01, DASH-02, DASH-03, NOTF-01, NOTF-02. AI feedback (AIFB-01, AIFB-02) is deferred to v2.

</domain>

<decisions>
## Implementation Decisions

### Popup layout & navigation
- Tabbed navigation: Dashboard, Reviews, and Settings (gear icon) as separate tabs
- Fixed popup size (~350-400px wide, ~500px tall), content scrolls within each tab
- No popup exists yet — needs `action.default_popup` in manifest.json plus popup.html/css/js

### Dashboard tab
- Stats bar (retention rate, review count, streak) at the top of the Dashboard tab, always visible
- Today's activity list below stats showing problems attempted with attempt counts
- Empty state: just show the stats bar and an empty activity list — no special messaging

### Review workflow
- Inline rating in the review list: each due problem shows title, difficulty, link, and 4 rating buttons (Again/Hard/Good/Easy) in the same row
- "Open on LeetCode" link always opens a new tab (no tab reuse)
- After rating: card removed from list immediately (fade/slide animation), due count updates
- Empty review queue: "All caught up!" — clean done state, no extra actions

### Settings tab
- OpenRouter API key input field (for v2 AI feedback — store now, use later)
- Notification preferences (on/off, time of day)

### Notifications & badge
- Browser notification when reviews become due
- Extension icon badge shows current due count (number)
- Requires adding `notifications` and `alarms` permissions to manifest.json

### Claude's Discretion
- Exact tab styling, colors, typography, and spacing
- Animation details for card removal after rating
- Notification scheduling strategy (alarm interval, check frequency)
- Badge update frequency and logic
- Settings page layout and validation
- How to query today's submissions for the Dashboard tab (new message handler or extend existing)

</decisions>

<specifics>
## Specific Ideas

- Tab navigation should feel like a standard Chrome extension popup — clean, not cluttered
- Rating buttons should be immediately accessible without extra clicks (no expand/collapse)
- Stats at top of dashboard for motivational quick-glance

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `background.js`: Message handlers ready — `GET_DUE_TODAY` returns due cards, `GET_STATS` returns {totalReviews, retentionRate, streak}, `RATE_REVIEW` updates card state
- IndexedDB stores: `submissions` (with titleSlug, capturedAt indexes), `cards` (with due, state indexes), `reviewLogs`
- `content-toast.js`: Shadow DOM toast pattern — could inform popup component isolation approach

### Established Patterns
- All storage operations happen in service worker via message passing (`chrome.runtime.sendMessage`)
- IndexedDB at version 2 with cards and reviewLogs stores
- ISO string dates for due/reviewedAt fields
- `store.add()` with ConstraintError for deduplication

### Integration Points
- Popup sends messages to background.js: `GET_DUE_TODAY`, `GET_STATS`, `RATE_REVIEW`
- Need new message handler for today's submissions (DASH-01): query submissions store by capturedAt for today
- manifest.json needs: `action.default_popup`, `notifications` permission, `alarms` permission
- Badge updates via `chrome.action.setBadgeText` in service worker

</code_context>

<deferred>
## Deferred Ideas

- AI feedback on wrong submissions (v2 — AIFB-01, AIFB-02) — OpenRouter API key stored in settings but not used yet
- Cards-by-state dashboard visualization (New/Learning/Review/Relearning breakdown)
- Next review date display in empty queue state
- Tab reuse for LeetCode links (navigate existing tab instead of opening new)

</deferred>

---

*Phase: 03-dashboard-reviews-notifications*
*Context gathered: 2026-03-13*
