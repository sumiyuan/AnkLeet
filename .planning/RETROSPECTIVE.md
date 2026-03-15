# Retrospective

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-13
**Phases:** 3 | **Plans:** 7

### What Was Built
- MV3 Chrome extension with IndexedDB storage and duplicate-safe submission capture
- Fetch/XHR interceptor pipeline capturing LeetCode REST submissions with Shadow DOM toast
- ts-fsrs FSRS scheduling engine with card creation, rating, due-today queue, and stats
- Tabbed popup UI with dashboard stats, today's activity, review queue, and settings
- Alarm-driven badge updates and daily browser notifications for due reviews

### What Worked
- Sequential phase ordering (capture → scheduling → UI) followed the data dependency chain naturally
- Wave-based parallel execution kept plans independent within phases
- IndexedDB version migration (v1 → v2) was smooth with the upgrade handler pattern
- Shadow DOM isolation prevented style conflicts with LeetCode's page

### What Was Inefficient
- FSRS default learning intervals (minutes) didn't suit LeetCode's use case — required post-hoc minimum 1-day interval fix
- Initial assumption that LeetCode used GraphQL for submissions was wrong — required interceptor rewrite after live traffic verification

### Patterns Established
- UMD bundling for MV3 service worker libraries (no ES module support with importScripts)
- store.add() with ConstraintError for idempotent deduplication
- Eager IndexedDB open at worker startup with re-open guard for worker restarts
- Settings merge pattern (spread existing before writing) to preserve unrelated keys

### Key Lessons
- Always verify external API shapes with live traffic before building interceptors
- FSRS parameters need domain-specific tuning — flashcard defaults don't apply to code review

---

## Milestone: v1.1 — AI Feedback

**Shipped:** 2026-03-15
**Phases:** 2 | **Plans:** 2

### What Was Built
- OpenRouter API integration via MV3 service worker with Bearer auth and keepalive
- Non-intrusive bottom-right side panel for wrong submissions with Hint and Full Solution buttons
- Safe markdown renderer for AI code blocks (textContent-only, no XSS)
- AI model selector in Settings (5 models across Claude, Gemini, GPT)
- Socratic hint mode that nudges without revealing the answer

### What Worked
- Phase 4/5 split (backend → UI) kept concerns clean — Phase 5 was a single-file UI change
- Reusing showRatingDialog's Shadow DOM pattern as a template for the new dialog
- textContent-only rendering eliminated XSS concerns without needing a sanitizer library

### What Was Inefficient
- Initial centered overlay dialog was too intrusive — redesigned to side panel after user feedback during checkpoint
- Pre-existing content-isolated.js errors surfaced during testing and needed fixing mid-phase

### Patterns Established
- No-callback sendMessage for fire-and-forget messages (prevents "port closed" warnings)
- chrome.runtime.lastError check before reading sendMessage response
- User-selectable model stored in settings, read in service worker at call time

### Key Lessons
- UI that blocks the user's workflow should be avoided — non-intrusive panels are better for optional features
- Pre-existing bugs surface when you test adjacent features — fix them when found

---

## Cross-Milestone Trends

| Metric | v1.0 | v1.1 |
|--------|------|------|
| Phases | 3 | 2 |
| Plans | 7 | 2 |
| LOC | ~3,869 | ~2,289 (ext/) |
| Timeline | 1 day | 2 days |
