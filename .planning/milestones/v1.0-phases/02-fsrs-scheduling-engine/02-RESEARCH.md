# Phase 02: FSRS Scheduling Engine - Research

**Researched:** 2026-03-13
**Domain:** FSRS spaced repetition algorithm, IndexedDB schema migration, Chrome MV3 service worker bundling
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- One FSRS card per problem (keyed by titleSlug), not per submission
- Card created on first Accepted submission only — wrong-only problems don't get scheduled
- All submissions (wrong + accepted) are linked to the card retroactively, giving a full attempt history per problem
- Re-submitting on LeetCode does NOT auto-complete a review — reviews are explicit only (user must rate Again/Hard/Good/Easy in the Phase 3 popup)
- Full review log: each review stored as a separate log entry (rating, timestamp, old state, new state)
- Enables retention rate calculation, review count tracking, and streak computation
- Add `cards` and `reviewLogs` object stores to the existing `leetreminder` database
- Bump schema version from 1 to 2
- Cards reference submissions by titleSlug
- Retention rate: percentage of reviews rated Good or Easy vs Again
- Review count + consecutive-day streak
- Streak only resets if reviews were due and skipped — no penalty for days with nothing due

### Claude's Discretion

- FSRS library choice (ts-fsrs vs custom implementation) and MV3 bundling approach
- Exact FSRS parameter defaults (desired retention, initial stability, etc.)
- Due-today query API shape and internal data access patterns
- Cards-by-state breakdown (New/Learning/Review/Relearning) — may include if straightforward
- Review log entry schema details

### Deferred Ideas (OUT OF SCOPE)

- AI feedback on wrong submissions (v2 — AIFB-01, AIFB-02)
- First-attempt vs multi-attempt tracking as FSRS signal (v2 — DATA-03)
- Cards-by-state dashboard visualization — Phase 3
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FSRS-01 | FSRS algorithm calculates optimal review intervals for each problem | ts-fsrs v5.2.3 provides `createEmptyCard()` and `fsrs().repeat()` — complete scheduling engine ready to use |
| FSRS-02 | User rates review difficulty (Again/Hard/Good/Easy) after completing a review | ts-fsrs `Rating` enum (1-4) maps to Again/Hard/Good/Easy; `repeat()` pre-computes all four outcomes; Phase 2 must persist the selected outcome when Phase 3 sends a rate message |
| FSRS-03 | Due-today queue shows problems scheduled for review | IndexedDB index on `cards.due` enables date-range query; due-today = `due <= today midnight` |
| FSRS-04 | Review statistics displayed (retention rate, review count, streak) | `reviewLogs` store holds all ratings; stats computed on query from log data |
</phase_requirements>

---

## Summary

Phase 2 implements the FSRS scheduling engine entirely inside the existing MV3 service worker (`background.js`). The ts-fsrs library (v5.2.3, 72 KB UMD) provides the complete algorithm — card creation, interval calculation, and review scheduling — with no custom math needed. The library ships a UMD bundle that can be vendored directly into the extension alongside `background.js`, loaded via `importScripts()` without any bundler.

The IndexedDB schema migrates from version 1 to version 2, adding `cards` and `reviewLogs` object stores using the established `onupgradeneeded` pattern already in the codebase. Card creation hooks into the existing `saveSubmission()` flow: after a successful `store.add()`, check whether the submission is Accepted and whether a card already exists for that `titleSlug`; if not, create one. Review rating (from Phase 3) is handled via a new `RATE_REVIEW` message type processed in the service worker.

The due-today query uses an IndexedDB `IDBKeyRange.upperBound(endOfToday)` on a `due` index over the `cards` store, returning only cards whose `due` date is today or earlier. Review statistics (retention rate, review count, streak) are computed by reading the `reviewLogs` store filtered by `titleSlug` or globally.

**Primary recommendation:** Vendor `ts-fsrs@5.2.3` UMD bundle as `lib/ts-fsrs.umd.js`, load via `importScripts()` in `background.js`, bump IndexedDB to version 2 with the `onupgradeneeded` migration pattern already established in Phase 1.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| ts-fsrs | 5.2.3 | FSRS v6 algorithm — card creation, scheduling, rating | Official TypeScript implementation of FSRS; ESM/CJS/UMD, no dependencies, 72 KB, browser-safe |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| IndexedDB (native) | — | Persist cards and reviewLogs across sessions | Already used for submissions; no additional dependency |
| Chrome MV3 service worker (native) | — | All storage operations and scheduling logic | Established pattern from Phase 1 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| ts-fsrs UMD vendor | Custom FSRS implementation | Custom saves a file; ts-fsrs handles edge cases (fuzz, short-term stability, lapses) that are non-trivial to get right |
| ts-fsrs | @squeakyrobot/fsrs | Both implement FSRS; ts-fsrs is the canonical open-spaced-repetition org reference implementation |

**Installation (local vendor approach — no bundler needed):**

```bash
# Download UMD bundle from CDN to extension/lib/
curl -o extension/lib/ts-fsrs.umd.js \
  https://cdn.jsdelivr.net/npm/ts-fsrs@5.2.3/dist/index.umd.js
```

Then in `background.js`:
```javascript
importScripts('lib/ts-fsrs.umd.js');
// UMD exposes: self.tsfsrs.createEmptyCard, self.tsfsrs.fsrs, self.tsfsrs.Rating, self.tsfsrs.State
```

Alternatively, use `"type": "module"` in manifest.json and copy the ESM file:
```json
"background": { "service_worker": "background.js", "type": "module" }
```
Then in `background.js`:
```javascript
import { createEmptyCard, fsrs, Rating, State } from './lib/ts-fsrs.mjs';
```

---

## Architecture Patterns

### Recommended Project Structure

```
extension/
├── background.js          # Service worker — all storage + scheduling
├── lib/
│   └── ts-fsrs.umd.js     # Vendored ts-fsrs UMD bundle (or .mjs for ESM approach)
├── content-main.js
├── content-isolated.js
├── content-toast.js
└── manifest.json
```

### Pattern 1: IndexedDB Version 2 Migration

**What:** Extend the existing `onupgradeneeded` handler to add `cards` and `reviewLogs` stores when upgrading from version 1 to 2.

**When to use:** Required once, at schema bump.

**Example:**
```javascript
// Source: MDN IDBOpenDBRequest upgradeneeded
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('leetreminder', 2); // bumped from 1

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        // Original submissions store (already exists for real upgrades,
        // but needed if browser has no DB at all)
        const subStore = db.createObjectStore('submissions', {
          keyPath: 'id', autoIncrement: true
        });
        subStore.createIndex('submissionId', 'submissionId', { unique: true });
        subStore.createIndex('titleSlug', 'titleSlug', { unique: false });
        subStore.createIndex('capturedAt', 'capturedAt', { unique: false });
      }

      if (oldVersion < 2) {
        // cards store
        const cardStore = db.createObjectStore('cards', {
          keyPath: 'titleSlug'   // one card per problem
        });
        cardStore.createIndex('due', 'due', { unique: false });
        cardStore.createIndex('state', 'state', { unique: false });

        // reviewLogs store
        const logStore = db.createObjectStore('reviewLogs', {
          keyPath: 'id', autoIncrement: true
        });
        logStore.createIndex('titleSlug', 'titleSlug', { unique: false });
        logStore.createIndex('reviewedAt', 'reviewedAt', { unique: false });
      }
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}
```

### Pattern 2: Card Creation on First Accepted Submission

**What:** After `addRecord()` succeeds for an Accepted submission, check if a card exists for that `titleSlug`; if not, create one.

**When to use:** Inside `saveSubmission()`, after the `store.add()` resolves with a non-null key.

**Example:**
```javascript
// Source: ts-fsrs docs + existing addRecord pattern
async function maybeCreateCard(db, titleSlug) {
  // Check if card already exists
  const existing = await getCard(db, titleSlug);
  if (existing) return; // idempotent

  const emptyCard = tsfsrs.createEmptyCard(new Date());
  const card = {
    titleSlug,
    due: emptyCard.due.toISOString(),      // Store as ISO string
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state,                 // 0 = New
    last_review: null,
    createdAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cards'], 'readwrite');
    const store = tx.objectStore('cards');
    const req = store.add(card);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => {
      if (e.target.error.name === 'ConstraintError') {
        e.preventDefault(); resolve(null); // race — already exists
      } else reject(e.target.error);
    };
  });
}
```

### Pattern 3: Rating a Review (RATE_REVIEW message)

**What:** Phase 3 sends `{ type: 'RATE_REVIEW', payload: { titleSlug, rating } }`. Background reads the current card, calls `fsrs().repeat()`, persists the updated card and a review log entry — without mutating the old card state in place (the log captures old state before overwrite).

**When to use:** Handler for `RATE_REVIEW` message type.

**Example:**
```javascript
// Source: ts-fsrs deepwiki examples
async function rateReview(db, titleSlug, ratingValue) {
  const scheduler = tsfsrs.fsrs(); // default params: request_retention=0.9
  const stored = await getCard(db, titleSlug);
  if (!stored) throw new Error(`No card for ${titleSlug}`);

  // Reconstruct Date fields before passing to scheduler
  const card = {
    ...stored,
    due: new Date(stored.due),
    last_review: stored.last_review ? new Date(stored.last_review) : null
  };

  const now = new Date();
  const recordLog = scheduler.repeat(card, now);
  const rating = tsfsrs.Rating[ratingValue]; // e.g., Rating.Good = 3
  const { card: newCard, log } = recordLog[rating];

  // Capture old state for the log entry
  const reviewLogEntry = {
    titleSlug,
    rating: log.rating,
    oldState: stored.state,
    newState: newCard.state,
    scheduledDays: log.scheduled_days,
    elapsedDays: log.elapsed_days,
    reviewedAt: now.toISOString()
  };

  // Persist updated card (overwrite — keyPath = titleSlug)
  const updatedCard = {
    titleSlug,
    due: newCard.due.toISOString(),
    stability: newCard.stability,
    difficulty: newCard.difficulty,
    elapsed_days: newCard.elapsed_days,
    scheduled_days: newCard.scheduled_days,
    reps: newCard.reps,
    lapses: newCard.lapses,
    state: newCard.state,
    last_review: newCard.last_review?.toISOString() ?? null,
    createdAt: stored.createdAt
  };

  await putCard(db, updatedCard);
  await addReviewLog(db, reviewLogEntry);
}
```

### Pattern 4: Due-Today Query

**What:** Return all cards whose `due` is today or earlier (not future), that have been captured (state > New indicates reviewed at least once — but "captured" cards with state=New and due=today are also valid for first review).

**When to use:** Handler for `GET_DUE_TODAY` message.

**Example:**
```javascript
// Source: MDN IDBKeyRange
async function getDueToday(db) {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const upperBound = endOfToday.toISOString(); // stored as ISO strings

  return new Promise((resolve, reject) => {
    const tx = db.transaction(['cards'], 'readonly');
    const store = tx.objectStore('cards');
    const index = store.index('due');
    // upperBound inclusive: due <= end of today
    const range = IDBKeyRange.upperBound(upperBound, false);
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
```

**Important:** Since `due` is stored as ISO strings (lexicographically sortable), `IDBKeyRange.upperBound` works correctly on string comparisons for dates — ISO 8601 strings sort chronologically.

### Pattern 5: Review Statistics Computation

**What:** Read all `reviewLogs` (or filtered by date range) to compute retention rate, review count, and streak.

**When to use:** Handler for `GET_STATS` message.

**Example:**
```javascript
async function getStats(db) {
  const logs = await getAllReviewLogs(db); // getAll() from reviewLogs store

  const totalReviews = logs.length;
  const goodOrEasy = logs.filter(l => l.rating >= 3).length; // Good=3, Easy=4
  const retentionRate = totalReviews > 0
    ? Math.round((goodOrEasy / totalReviews) * 100)
    : 0;

  // Streak: consecutive calendar days with at least one review
  // "Fair" streak: only broken if reviews WERE due and user skipped
  // For Phase 2, implement simple calendar-day streak from review logs
  const reviewDays = new Set(
    logs.map(l => l.reviewedAt.slice(0, 10)) // 'YYYY-MM-DD'
  );
  const streak = computeStreak(reviewDays); // see Pitfalls section

  return { totalReviews, retentionRate, streak };
}
```

### Anti-Patterns to Avoid

- **Mutating Card in place without saving old state:** Always save the review log entry (with old state) BEFORE overwriting the card. The log is the audit trail for statistics.
- **Storing Date objects directly in IndexedDB:** IndexedDB can store Date objects natively, BUT they serialize inconsistently across some browsers. Store as ISO strings for portability and use the `due` index on strings (ISO sorts correctly).
- **Calling `repeat()` with string dates:** ts-fsrs requires genuine `Date` objects. Always reconstruct `new Date(stored.due)` before calling `fsrs().repeat(card, now)`.
- **Dynamic imports in MV3 service worker:** Dynamic `import()` is not supported in MV3 service workers. Use static `import` (with `"type": "module"`) or `importScripts()`.
- **Creating FSRS instance inside each function call:** Instantiate `fsrs()` once at module scope or once per request — it's stateless but allocation has overhead.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FSRS interval calculation | Custom stability/difficulty formulas | ts-fsrs `fsrs().repeat()` | FSRS has 19 tuned weights, short-term vs long-term stability model, fuzz logic — not trivial math |
| Rating enum values | Magic numbers (1/2/3/4) | `tsfsrs.Rating.Again/Hard/Good/Easy` | Enum guards against off-by-one; ts-fsrs uses 1-indexed Rating |
| Empty card initialization | `{ state: 0, stability: 0, ... }` | `tsfsrs.createEmptyCard()` | Initial card state has specific required field defaults |
| ISO date comparison in IndexedDB | Custom cursor iteration | `IDBKeyRange.upperBound(isoString)` | ISO 8601 strings sort correctly as strings in IndexedDB key ranges |

**Key insight:** The FSRS algorithm internals (DSR model, stability retrieval formula, lapses handling) have been validated on millions of real reviews. Any custom re-implementation would lack that validation and may diverge subtly from spec.

---

## Common Pitfalls

### Pitfall 1: Date Deserialization Before Scheduling

**What goes wrong:** `fsrs().repeat(card, now)` silently produces wrong intervals if `card.due` is an ISO string instead of a Date object. The scheduler does arithmetic with timestamps.

**Why it happens:** IndexedDB returns plain JS objects. Reading a card back from storage gives `due` as a string (if stored as ISO), not a Date.

**How to avoid:** Always reconstruct Date fields when reading from storage:
```javascript
card.due = new Date(stored.due);
card.last_review = stored.last_review ? new Date(stored.last_review) : null;
```

**Warning signs:** `card.due` after `repeat()` is `Invalid Date` or intervals are all 0 days.

### Pitfall 2: ISO String Key Range vs Date Object Key Range

**What goes wrong:** If `due` is stored as a Date object in IndexedDB (not ISO string), the `IDBKeyRange.upperBound(isoString)` comparison fails because the key types don't match (Date vs String are different IDB key types).

**Why it happens:** IndexedDB has a strict key type ordering: number < Date < string. Mixing types in range queries silently returns nothing.

**How to avoid:** Be consistent — store `due` as ISO strings everywhere, and use ISO string bounds for queries. OR store as Date objects and use Date bounds. **Pick one and stick to it.** Recommendation: ISO strings (portable, debuggable in DevTools).

**Warning signs:** `getDueToday()` returns empty array even when cards clearly exist in DevTools.

### Pitfall 3: IndexedDB Version Upgrade Race with Multiple Tabs

**What goes wrong:** User has two Chrome tabs open on LeetCode. One tab triggers the version 2 upgrade; the other tab holds a version 1 connection open, blocking the upgrade.

**Why it happens:** IndexedDB version upgrades are blocked if any other connection is open to the old version. Chrome fires `onblocked` on the upgrade request.

**How to avoid:** Add `request.onblocked = () => {}` handler (silently wait) and add `db.onversionchange = () => db.close()` so existing connections yield. For a single-user extension this is low risk but should be handled gracefully.

**Warning signs:** `openDatabase()` never resolves after extension update; DevTools shows pending IndexedDB upgrade.

### Pitfall 4: Service Worker Restart Losing DB Reference

**What goes wrong:** MV3 service workers can be terminated after 30 seconds of inactivity. The module-scope `db` reference becomes null on next wake.

**Why it happens:** Already documented in Phase 1. Phase 2 extends the same pattern.

**How to avoid:** Already handled by the `if (!db) { db = await openDatabase(); }` guard in `saveSubmission()`. Apply the same guard to all new functions (`maybeCreateCard`, `rateReview`, `getDueToday`, `getStats`).

**Warning signs:** `Cannot read properties of null (reading 'transaction')` in service worker console.

### Pitfall 5: Fair Streak Algorithm Complexity

**What goes wrong:** Simple "consecutive days with reviews" breaks if user has zero due reviews on a day — they get penalized for correctly having nothing to do.

**Why it happens:** Naive streak counts calendar days with review log entries; days with nothing due look like skipped days.

**How to avoid:** Phase 2 only implements review log storage. Streak computation for Phase 4 requires knowing which days had due cards AND no reviews. For Phase 2, implement a simple streak that counts consecutive days with at least one review log entry, and note that the "fair" implementation (penalizing only days where reviews were due but not done) requires querying card state snapshots — defer advanced streak logic to when the stats UI is built in Phase 3.

**Warning signs:** Users report streak breaking on days they had no cards due.

---

## Code Examples

Verified patterns from official sources:

### ts-fsrs: Full First-Review Lifecycle

```javascript
// Source: ts-fsrs deepwiki examples + npm README
importScripts('lib/ts-fsrs.umd.js');
const { createEmptyCard, fsrs, Rating, State } = self.tsfsrs;

// On first Accepted submission for a problem:
const card = createEmptyCard(new Date()); // state=New, due=now

// When user rates (Phase 3 will send the rating):
const scheduler = fsrs(); // default: request_retention=0.9
const recordLog = scheduler.repeat(card, new Date());
// recordLog[Rating.Good] = { card: <updated>, log: <ReviewLog> }

const { card: nextCard, log: reviewLog } = recordLog[Rating.Good];
// nextCard.due = Date (next review), nextCard.state = Learning or Review
// nextCard.scheduled_days = interval until due
```

### IndexedDB: Version 2 Schema with Migration Guard

```javascript
// Source: MDN onupgradeneeded + established Phase 1 pattern
const request = indexedDB.open('leetreminder', 2);
request.onupgradeneeded = (event) => {
  const db = event.target.result;
  if (event.oldVersion < 2) {
    const cardStore = db.createObjectStore('cards', { keyPath: 'titleSlug' });
    cardStore.createIndex('due', 'due', { unique: false });
    cardStore.createIndex('state', 'state', { unique: false });

    const logStore = db.createObjectStore('reviewLogs', {
      keyPath: 'id', autoIncrement: true
    });
    logStore.createIndex('titleSlug', 'titleSlug', { unique: false });
    logStore.createIndex('reviewedAt', 'reviewedAt', { unique: false });
  }
};
```

### Due-Today Query with ISO String Range

```javascript
// Source: MDN IDBKeyRange
const endOfToday = new Date();
endOfToday.setHours(23, 59, 59, 999);
const range = IDBKeyRange.upperBound(endOfToday.toISOString());
const req = db.transaction(['cards'], 'readonly')
              .objectStore('cards')
              .index('due')
              .getAll(range);
```

---

## IndexedDB Schema (Version 2)

### `cards` Object Store

| Field | Type | Notes |
|-------|------|-------|
| `titleSlug` | string (keyPath) | One card per problem |
| `due` | string (ISO 8601) | Indexed; next review date |
| `stability` | number | FSRS memory strength |
| `difficulty` | number | FSRS card difficulty (1-10) |
| `elapsed_days` | number | Days since last review |
| `scheduled_days` | number | Interval to next review |
| `reps` | number | Total reviews completed |
| `lapses` | number | Times rated Again |
| `state` | number | 0=New, 1=Learning, 2=Review, 3=Relearning |
| `last_review` | string or null | ISO 8601 or null |
| `createdAt` | number | `Date.now()` at card creation |

**Indexes:** `due` (non-unique), `state` (non-unique)

### `reviewLogs` Object Store

| Field | Type | Notes |
|-------|------|-------|
| `id` | number (autoIncrement, keyPath) | Auto-generated |
| `titleSlug` | string | Indexed; links to card |
| `rating` | number | 1=Again, 2=Hard, 3=Good, 4=Easy |
| `oldState` | number | State before this review |
| `newState` | number | State after this review |
| `scheduledDays` | number | Interval assigned |
| `elapsedDays` | number | Days since last review |
| `reviewedAt` | string (ISO 8601) | Indexed; when review happened |

**Indexes:** `titleSlug` (non-unique), `reviewedAt` (non-unique)

---

## Message API Shape

New message types handled by `background.js`:

| Message Type | Payload | Response |
|---|---|---|
| `RATE_REVIEW` | `{ titleSlug, rating: 'Again'|'Hard'|'Good'|'Easy' }` | `{ ok: true }` or error |
| `GET_DUE_TODAY` | `{}` | `{ cards: Card[] }` |
| `GET_STATS` | `{}` | `{ totalReviews, retentionRate, streak }` |

All message handlers must use `sendResponse` and return `true` from `onMessage` to signal async response.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| SM-2 (Anki default) | FSRS v6 (ts-fsrs) | FSRS v6 released ~2024 | 20-30% fewer reviews for same retention |
| `importScripts()` only for libraries | `"type": "module"` in manifest.json | Chrome 91+ / MV3 | Static `import` now works in extension service workers |
| Date objects in IndexedDB | ISO strings (recommended) | — | String keys sort correctly in ranges; portable across browsers |

**Deprecated/outdated:**

- `ts-fsrs` v3.x: Used 17-weight `w` array. v4+ uses 19 weights (FSRS v6). Use v5.2.3.
- `enable_fuzz: true`: Adds randomization to prevent card clustering. Default is `false` (deterministic). For a personal extension, `false` is fine.

---

## Open Questions

1. **UMD global namespace**
   - What we know: ts-fsrs ships `index.umd.js` (71.68 KB). UMD bundles expose globals in browsers.
   - What's unclear: The exact global name (e.g., `window.tsfsrs` or `window.TSFSRS`) is not confirmed in documentation reviewed.
   - Recommendation: After vendoring, verify with `console.log(Object.keys(self))` in the service worker console to find the exposed name, or inspect the UMD file header.

2. **Fair streak implementation scope**
   - What we know: "Fair" streak requires knowing which days had due cards that went unreviewed.
   - What's unclear: Whether Phase 2 should implement the naive streak (days with reviews) or the full fair streak.
   - Recommendation: Implement naive streak in Phase 2 (days with at least one review log entry). Document that Phase 3 can enhance to fair streak using card `due` history — Phase 2 stores everything needed.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected in project |
| Config file | None — see Wave 0 |
| Quick run command | N/A (manual verification via Chrome DevTools) |
| Full suite command | N/A |

This is a Chrome extension with no test runner configured. Automated unit testing of the FSRS scheduling logic is feasible by extracting pure functions into testable modules, but no test infrastructure exists yet.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FSRS-01 | createEmptyCard + repeat() produces valid next due date | manual | Verify via DevTools IndexedDB inspector after first submission | N/A |
| FSRS-02 | RATE_REVIEW message updates card.due and adds reviewLog entry | manual | Send message via DevTools service worker console, inspect DB | N/A |
| FSRS-03 | GET_DUE_TODAY returns only cards with due <= today | manual | Set card due dates manually in DevTools, call GET_DUE_TODAY | N/A |
| FSRS-04 | GET_STATS returns accurate retention rate, review count, streak | manual | Review multiple cards with different ratings, verify stats | N/A |

### Sampling Rate

- **Per task commit:** Manual smoke test — open extension on LeetCode, submit a problem, verify card appears in IndexedDB
- **Per wave merge:** All four requirement behaviors verified via DevTools console
- **Phase gate:** All four success criteria from phase description must be manually confirmed before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] No automated test framework — all verification is manual via Chrome DevTools
- [ ] Recommend: Add a `window.__leetreminderDebug` helper in development builds to query cards and stats from the page console
- [ ] `extension/lib/` directory does not exist yet — must be created for vendored ts-fsrs

---

## Sources

### Primary (HIGH confidence)

- ts-fsrs GitHub (open-spaced-repetition/ts-fsrs) — API, Card type, Rating/State enums, module formats
- jsDelivr CDN listing for ts-fsrs@5.2.3 — confirmed UMD bundle exists at `/dist/index.umd.js` (71.68 KB), ESM at `/dist/index.mjs`
- Chrome for Developers: Service worker basics — confirmed `"type": "module"` in manifest.json enables static imports, `importScripts()` also supported
- DeepWiki ts-fsrs package docs — RecordLog structure, ReviewLog fields, Date serialization gotchas, FSRSParameters defaults

### Secondary (MEDIUM confidence)

- DeepWiki ts-fsrs examples and integration — complete code patterns for `repeat()`, serialization, parameter defaults (cross-verified against GitHub README structure)
- Chrome for Developers: Migrate to service workers — confirmed dynamic `import()` not supported, static `import` requires `"type": "module"`

### Tertiary (LOW confidence)

- MDN IDBKeyRange — ISO string range query behavior (standard spec, HIGH confidence in practice; flagged LOW only because Chrome extension context was not explicitly tested)
- WebSearch: UMD global name in ts-fsrs — not confirmed; requires live inspection

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — ts-fsrs v5.2.3 confirmed, UMD bundle confirmed, API shapes confirmed via deepwiki + GitHub
- Architecture: HIGH — patterns extend established Phase 1 IndexedDB patterns; schema design is straightforward
- Pitfalls: HIGH — Date serialization and IDB key type issues are well-documented; service worker restart is a known MV3 issue from Phase 1
- MV3 bundling: HIGH — `"type": "module"` approach and `importScripts()` both confirmed by official Chrome docs

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 (ts-fsrs is stable; Chrome extension APIs change slowly)
