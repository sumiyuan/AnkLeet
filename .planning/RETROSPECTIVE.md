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

## Cross-Milestone Trends

| Metric | v1.0 |
|--------|------|
| Phases | 3 |
| Plans | 7 |
| LOC | ~3,869 |
| Timeline | 1 day |
