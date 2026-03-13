# Architecture Research

**Domain:** Chrome Extension with Content Script Injection, Background Service Worker, Local Storage, FSRS Spaced Repetition
**Researched:** 2026-03-12
**Confidence:** HIGH (official Chrome documentation verified)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CHROME BROWSER                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   LEETCODE.COM TAB                          │     │
│  │                                                             │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │           ISOLATED WORLD (Content Script)            │   │     │
│  │  │  content-script.ts                                   │   │     │
│  │  │  - Injects network interceptor into MAIN world       │   │     │
│  │  │  - Listens for CustomEvents from page                │   │     │
│  │  │  - Forwards submission data via chrome.runtime.msg   │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  │                                                             │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │           MAIN WORLD (Injected Script)               │   │     │
│  │  │  injected.ts (runs in page context)                  │   │     │
│  │  │  - Overrides window.fetch / XMLHttpRequest           │   │     │
│  │  │  - Intercepts LeetCode submission API calls          │   │     │
│  │  │  - Dispatches CustomEvent to content script          │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌──────────────────────────────────────────┐                        │
│  │        POPUP (popup.html + React)        │                        │
│  │  - Dashboard: daily stats, review queue  │                        │
│  │  - Settings: API key, preferences        │                        │
│  │  - Communicates via chrome.runtime.msg   │                        │
│  └──────────────────────────────────────────┘                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │               BACKGROUND SERVICE WORKER                      │    │
│  │  service-worker.ts (event-driven, terminates when idle)      │    │
│  │                                                              │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │    │
│  │  │ Message  │ │  FSRS    │ │  Alarm   │ │  OpenRouter   │  │    │
│  │  │ Handler  │ │ Engine   │ │ Handler  │ │  API Client   │  │    │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └───────┬───────┘  │    │
│  │       └────────────┴────────────┴───────────────┘           │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                       STORAGE LAYER                          │    │
│  │  ┌───────────────────┐  ┌───────────────────────────────┐   │    │
│  │  │  chrome.storage   │  │         IndexedDB             │   │    │
│  │  │  .local           │  │  (submissions, FSRS state,    │   │    │
│  │  │  (settings, keys, │  │   review history, problem     │   │    │
│  │  │   daily counters) │  │   metadata, code snapshots)   │   │    │
│  │  └───────────────────┘  └───────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| Injected Script (MAIN world) | Overrides window.fetch/XHR to detect LeetCode submission API calls; dispatches CustomEvent with payload | Content Script (via CustomEvent / window.postMessage) |
| Content Script (ISOLATED world) | Listens for submission events from injected script; forwards to service worker via runtime messaging | Injected Script (CustomEvent), Service Worker (chrome.runtime.sendMessage) |
| Background Service Worker | Central coordinator — processes submissions, runs FSRS scheduling, calls OpenRouter API, fires notifications, responds to popup queries | Content Script (onMessage), Popup (onMessage), Storage (read/write), Alarm API, Notifications API, External APIs (fetch) |
| Popup (React SPA) | Dashboard UI — shows daily stats, due reviews, review history, settings management | Service Worker (chrome.runtime.sendMessage for data), Storage (can read directly) |
| chrome.storage.local | Persists settings, API key, daily counters, extension preferences | Service Worker (primary writer), Popup (reader) |
| IndexedDB | Persists all submissions, FSRS card state, review history, problem metadata, code snapshots | Service Worker exclusively (content scripts cannot access SW's IndexedDB) |

## Recommended Project Structure

```
src/
├── background/              # Service worker entry point
│   ├── index.ts             # Top-level listener registration (MUST be synchronous)
│   ├── handlers/
│   │   ├── submission.ts    # Process incoming submission, persist, schedule FSRS
│   │   ├── review.ts        # Return due reviews to popup
│   │   ├── ai.ts            # Call OpenRouter API for feedback
│   │   └── alarm.ts         # Handle review-due alarms, fire notifications
│   ├── fsrs/
│   │   ├── engine.ts        # FSRS algorithm wrapper (ts-fsrs library)
│   │   └── scheduler.ts     # Calculate next review date, update card state
│   └── storage/
│       ├── db.ts            # IndexedDB setup (schema, migrations)
│       ├── submissions.ts   # Submission CRUD via IndexedDB
│       ├── cards.ts         # FSRS card state CRUD via IndexedDB
│       └── settings.ts      # Settings CRUD via chrome.storage.local
│
├── content/                 # LeetCode page integration
│   ├── index.ts             # Content script entry — injects MAIN world script
│   └── injected.ts          # Runs in MAIN world — overrides fetch/XHR
│
├── popup/                   # Dashboard SPA
│   ├── index.html           # Popup entry HTML
│   ├── main.tsx             # React root mount
│   ├── App.tsx              # Root component + routing
│   ├── pages/
│   │   ├── Dashboard.tsx    # Today's activity, due reviews count
│   │   ├── Reviews.tsx      # Due review queue with LeetCode links
│   │   ├── History.tsx      # Submission history browser
│   │   └── Settings.tsx     # API key, notification prefs
│   ├── components/
│   │   ├── ProblemCard.tsx
│   │   ├── StatsBar.tsx
│   │   └── AIFeedbackPanel.tsx
│   └── hooks/
│       ├── useStorage.ts    # chrome.storage.local reactive hook
│       └── useMessages.ts   # chrome.runtime.sendMessage wrapper
│
├── shared/                  # Code shared across all contexts
│   ├── types.ts             # TypeScript interfaces (Submission, FSRSCard, etc.)
│   ├── constants.ts         # Alarm names, storage keys, message types
│   └── messages.ts          # Typed message schema (discriminated union)
│
└── manifest.json            # Extension manifest (at project root or public/)

public/
├── manifest.json            # Manifest V3 config
└── icons/                   # Extension icons (16, 32, 48, 128px)
```

### Structure Rationale

- **background/:** All service worker code isolated here; top-level `index.ts` registers all listeners synchronously — critical for MV3 compliance.
- **content/:** Split into `index.ts` (isolated world) and `injected.ts` (main world) because they execute in different JavaScript contexts with different capabilities.
- **popup/:** Standard React SPA; treated as a mini web app; communicates with service worker via message passing, never calls extension storage APIs directly from components (goes through hooks).
- **shared/:** Message types must be identical across all contexts; defining them once prevents drift.

## Architectural Patterns

### Pattern 1: MAIN World Script Injection for Network Interception

**What:** Content scripts run in an isolated JavaScript context and cannot intercept `window.fetch` from the page. The only way to intercept LeetCode's API calls is to inject a script that runs in the MAIN world (same context as the page's own JS), where it can override `window.fetch` before LeetCode's code runs.

**When to use:** Any time you need to intercept network calls made by the host page's own JavaScript.

**Trade-offs:** Requires `"world": "MAIN"` in manifest content scripts declaration (Chrome 111+) or `chrome.scripting.executeScript` with `world: "MAIN"`. The injected script has no access to Chrome APIs — it must communicate back via `window.postMessage` or `CustomEvent`, which the isolated-world content script relays to the service worker.

**Example:**
```typescript
// injected.ts — runs in MAIN world (no chrome.* APIs available)
const originalFetch = window.fetch.bind(window);
window.fetch = async function(input, init) {
  const response = await originalFetch(input, init);
  const url = typeof input === 'string' ? input : input.url;

  // LeetCode submission check endpoint pattern
  if (url.includes('/submissions/detail/') && url.includes('/check/')) {
    const clone = response.clone();
    clone.json().then((data) => {
      if (data.status_msg === 'Accepted' || data.run_success === false) {
        window.dispatchEvent(new CustomEvent('leet-submission', {
          detail: { url, data }
        }));
      }
    });
  }
  return response;
};

// content/index.ts — runs in ISOLATED world, has chrome.* APIs
window.addEventListener('leet-submission', (event: CustomEvent) => {
  chrome.runtime.sendMessage({
    type: 'SUBMISSION_DETECTED',
    payload: event.detail
  });
});
```

### Pattern 2: Event-Driven Service Worker with Persistent Storage State

**What:** The service worker is the extension's brain but terminates after 30 seconds of inactivity. All state must live in storage. Listeners must register at the top level of the service worker file (not inside async functions or conditionals).

**When to use:** Always — this is MV3 mandatory architecture.

**Trade-offs:** Cannot keep in-memory state. Must re-hydrate from storage on every wake. However, Chrome 110+ means that any incoming event or Chrome API call resets the 30-second timer, so a busy extension (receiving submission events) stays alive.

**Example:**
```typescript
// background/index.ts — MUST register all listeners synchronously at top level
chrome.runtime.onMessage.addListener(handleMessage);
chrome.alarms.onAlarm.addListener(handleAlarm);
chrome.runtime.onInstalled.addListener(handleInstalled);

// DO NOT do this — listener registered async, may miss events after restart:
// async function setup() {
//   await loadConfig();
//   chrome.runtime.onMessage.addListener(handleMessage); // WRONG
// }
```

### Pattern 3: chrome.alarms for Review Scheduling

**What:** Use `chrome.alarms` (not `setTimeout`) to schedule review notifications. Alarms persist across service worker restarts and can wake a terminated service worker when they fire.

**When to use:** Any periodic or future-scheduled task in MV3.

**Trade-offs:** Minimum period is 30 seconds (Chrome 120+). Cannot schedule sub-minute precision for production builds. Alarms may be cleared on browser restart; recreate on `onInstalled` and `onStartup`.

**Example:**
```typescript
// background/handlers/alarm.ts
async function scheduleNextReviewAlarm() {
  const nextDue = await getEarliestDueReview(); // from IndexedDB
  if (!nextDue) return;

  const existingAlarm = await chrome.alarms.get('REVIEW_DUE');
  if (existingAlarm) await chrome.alarms.clear('REVIEW_DUE');

  chrome.alarms.create('REVIEW_DUE', {
    when: nextDue.getTime()
  });
}

// Top-level listener in background/index.ts
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'REVIEW_DUE') {
    const dueCount = await getDueReviewCount();
    if (dueCount > 0) {
      chrome.notifications.create({
        type: 'basic',
        title: 'LeetReminder',
        message: `${dueCount} problem${dueCount > 1 ? 's' : ''} due for review`,
        iconUrl: 'icons/icon48.png'
      });
    }
    await scheduleNextReviewAlarm(); // reschedule for next due
  }
});
```

### Pattern 4: Typed Message Bus (Discriminated Union)

**What:** All inter-component communication happens through `chrome.runtime.sendMessage`. Define a discriminated union of message types in `shared/messages.ts` so TypeScript catches mismatched message/handler pairs at compile time.

**When to use:** Every project with more than 2 message types — prevents string typos and payload shape mismatches.

**Trade-offs:** Minor boilerplate overhead for a significant DX improvement.

**Example:**
```typescript
// shared/messages.ts
export type ExtensionMessage =
  | { type: 'SUBMISSION_DETECTED'; payload: SubmissionPayload }
  | { type: 'GET_DUE_REVIEWS' }
  | { type: 'GET_AI_FEEDBACK'; submissionId: string; mode: 'hint' | 'full' }
  | { type: 'GET_DAILY_STATS' }
  | { type: 'SAVE_SETTINGS'; settings: Partial<UserSettings> };

export type ExtensionResponse =
  | { type: 'DUE_REVIEWS'; data: FSRSCard[] }
  | { type: 'AI_FEEDBACK'; feedback: string }
  | { type: 'DAILY_STATS'; data: DailyStats }
  | { type: 'OK' };
```

## Data Flow

### Submission Capture Flow

```
User submits on LeetCode.com
    |
    v
LeetCode calls its own API (fetch to /check/ endpoint)
    |
    v (intercepted by)
injected.ts (MAIN world)
  - Detects submission API response
  - Dispatches CustomEvent('leet-submission', {detail: {code, result, problem}})
    |
    v (via CustomEvent listener)
content/index.ts (ISOLATED world)
  - Receives CustomEvent
  - Sends chrome.runtime.sendMessage({type: 'SUBMISSION_DETECTED', payload})
    |
    v (via chrome.runtime.onMessage)
background/index.ts (Service Worker)
  - Routes to handlers/submission.ts
  - Persists submission to IndexedDB
  - If wrong: enqueues for AI feedback (optional, user-triggered)
  - Runs FSRS scheduling: creates/updates FSRSCard in IndexedDB
  - Reschedules chrome.alarm for next due review date
```

### Review Due Flow

```
chrome.alarms fires 'REVIEW_DUE'
    |
    v
background/handlers/alarm.ts
  - Queries IndexedDB for due reviews count
  - Creates chrome.notification with count
  - Reschedules alarm for next due item
    |
    v (user clicks notification or opens popup)
popup/pages/Reviews.tsx
  - Sends chrome.runtime.sendMessage({type: 'GET_DUE_REVIEWS'})
  - Service worker queries IndexedDB, returns FSRSCard[]
  - Renders list with "Open on LeetCode" links
    |
    v (user opens LeetCode, solves problem, submits)
[Back to Submission Capture Flow]
  - On next submission of this problem:
  - FSRS card updated with rating (Again/Hard/Good/Easy based on result)
```

### AI Feedback Flow

```
User clicks "Get Feedback" on a wrong submission
    |
    v
popup/pages/History.tsx or Reviews.tsx
  - Sends {type: 'GET_AI_FEEDBACK', submissionId, mode: 'hint'|'full'}
    |
    v
background/handlers/ai.ts
  - Retrieves submission from IndexedDB (code, problem name, error output)
  - Loads API key from chrome.storage.local
  - Calls OpenRouter API via fetch (service workers can make cross-origin requests)
  - Returns {type: 'AI_FEEDBACK', feedback: string}
    |
    v
Popup renders feedback in AIFeedbackPanel component
```

### Settings / State Management Flow

```
chrome.storage.local  ←→  background/storage/settings.ts
        |                           |
        |                           v (on any settings change)
        |                    Popup can also read directly
        v
popup/hooks/useStorage.ts
  - Wraps chrome.storage.local.get() + onChanged listener
  - Reactive hook: component re-renders on storage change
```

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Single user (local) | Current architecture is correct — everything in IndexedDB locally |
| Hundreds of problems | No changes needed; IndexedDB handles thousands of records efficiently |
| 1000+ problems tracked | Add IndexedDB indexes on `nextDueDate` and `problemId` for faster queries |
| Long-term usage (years) | Add IndexedDB migration versioning in `db.ts` — implement `onupgradeneeded` handlers from day one |

### Scaling Priorities

1. **First bottleneck:** IndexedDB query performance when reviewing history — solved by adding compound indexes on `(problemId, timestamp)` and `(nextDueDate)` from the start.
2. **Second bottleneck:** Service worker startup latency — solved by keeping storage reads minimal on wake; defer heavy queries until the message handler needs them.

## Anti-Patterns

### Anti-Pattern 1: Using setTimeout/setInterval for Scheduled Tasks

**What people do:** Use `setTimeout(() => sendNotification(), delay)` in the service worker to schedule review reminders.

**Why it's wrong:** Service workers terminate after 30 seconds of inactivity. The timer is lost when the worker terminates — the notification never fires.

**Do this instead:** Register a `chrome.alarms.create()` alarm. Alarms persist independently of the service worker's lifecycle and will wake a terminated service worker when they fire.

### Anti-Pattern 2: Storing Global Variables in Service Worker

**What people do:** `let currentUser = null;` at the top of service-worker.ts and mutate it on each event.

**Why it's wrong:** The service worker can be terminated between any two events. When it restarts, all global variables reset to their initial values. Data appears to vanish.

**Do this instead:** Write any stateful data to `chrome.storage.local` or IndexedDB immediately. Re-read from storage at the start of each event handler.

### Anti-Pattern 3: Registering Listeners Inside Async Functions

**What people do:**
```typescript
async function init() {
  const config = await loadConfig();
  chrome.runtime.onMessage.addListener(handleMessage); // registered late
}
init();
```

**Why it's wrong:** Chrome requires listeners to be registered synchronously at the service worker's top level. If the worker is restarted by an incoming message, the listener is not yet registered when that message arrives — the message is dropped.

**Do this instead:** Register all `addListener` calls at the top level, synchronously. Load async configuration inside the handler if needed.

### Anti-Pattern 4: Cross-Origin Requests from Content Scripts

**What people do:** Call `fetch('https://openrouter.ai/api/v1/...')` directly from the content script.

**Why it's wrong:** Content scripts are bound by the host page's CORS policy. LeetCode.com has no relationship with OpenRouter, so the request will be blocked. Also, the user's API key would be exposed to the LeetCode page context.

**Do this instead:** Send a message to the service worker, which makes the cross-origin fetch. Service workers have access to extension host permissions and are not bound by page-level CORS restrictions.

### Anti-Pattern 5: Injecting Fetch Interceptor from Isolated World

**What people do:** Override `window.fetch` from the content script (ISOLATED world).

**Why it's wrong:** Content scripts run in an isolated JavaScript context. Their `window` object is a special proxy. Overriding `window.fetch` in the content script does NOT affect the `fetch` that LeetCode's JavaScript calls — the page's fetch and the content script's fetch are different objects.

**Do this instead:** Inject a script into the MAIN world using `"world": "MAIN"` in manifest content scripts (Chrome 111+) or `chrome.scripting.executeScript({world: 'MAIN'})`. The MAIN world script shares the same `window` object as the page.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| OpenRouter API | `fetch()` from service worker with `Authorization: Bearer {apiKey}` header | API key stored in chrome.storage.local; never exposed to content scripts or page |
| LeetCode.com | Fetch/XHR interception in MAIN world injected script | Depends on LeetCode's private API — `/submissions/detail/{id}/check/` endpoint. Fragile; plan for DOM fallback |
| Chrome Notifications API | `chrome.notifications.create()` from service worker | Requires `"notifications"` permission in manifest |
| Chrome Alarms API | `chrome.alarms.create()` from service worker | Requires `"alarms"` permission; minimum 30s period |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Injected Script (MAIN) -> Content Script (ISOLATED) | `window.dispatchEvent(new CustomEvent(...))` | Only way to cross the MAIN/ISOLATED boundary from MAIN world |
| Content Script -> Service Worker | `chrome.runtime.sendMessage()` | One-time messages sufficient; use Port only if streaming data |
| Popup -> Service Worker | `chrome.runtime.sendMessage()` | Popup queries SW for data; SW queries IndexedDB and returns results |
| Service Worker -> Storage | `chrome.storage.local` (settings) + `IndexedDB` (all data) | SW is the single writer for IndexedDB; popup reads only via SW messages |
| Service Worker -> External APIs | `fetch()` with host permissions | Declared in manifest `host_permissions` |

## Build Order Implications

The component dependency graph determines what must be built first:

```
1. shared/types.ts + shared/messages.ts
   (No dependencies — defines contracts all other components use)
        |
        v
2. background/storage/db.ts + IndexedDB schema
   (Depends on: types; required before any data can be saved or read)
        |
        v
3. content/injected.ts (MAIN world interceptor) + content/index.ts
   (Depends on: message types; can be tested independently)
        |
        v
4. background/index.ts + handlers/submission.ts + fsrs/engine.ts
   (Depends on: storage layer; processes data from content script)
        |
        v
5. background/handlers/alarm.ts + notifications
   (Depends on: storage layer + submission handler being in place)
        |
        v
6. popup/ (React dashboard)
   (Depends on: all background handlers operational to query data)
        |
        v
7. background/handlers/ai.ts (OpenRouter integration)
   (Depends on: submission storage; independent of FSRS/alarms)
```

## Sources

- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — HIGH confidence (official docs)
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — HIGH confidence (official docs)
- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — HIGH confidence (official docs)
- [chrome.storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) — HIGH confidence (official docs)
- [chrome.alarms API Reference](https://developer.chrome.com/docs/extensions/reference/api/alarms) — HIGH confidence (official docs)
- [Longer Extension Service Worker Lifetimes (Chrome 110+)](https://developer.chrome.com/blog/longer-esw-lifetimes) — HIGH confidence (official Chrome blog)
- [Network Request Interception Patterns](https://rxliuli.com/blog/intercepting-network-requests-in-chrome-extensions/) — MEDIUM confidence (community, verified against official docs)
- [Chrome Extension MV3 Manifest V3 Architecture Patterns](https://dev.to/javediqbal8381/understanding-chrome-extensions-a-developers-guide-to-manifest-v3-233l) — MEDIUM confidence (community, consistent with official docs)
- [Building Chrome Extensions with React and Vite 2025](https://arg-software.medium.com/building-a-chrome-extension-with-react-and-vite-a-modern-developers-guide-83f98ee937ed) — MEDIUM confidence (community patterns)

---
*Architecture research for: Chrome Extension with Content Script Injection, Service Worker, FSRS Spaced Repetition*
*Researched: 2026-03-12*
