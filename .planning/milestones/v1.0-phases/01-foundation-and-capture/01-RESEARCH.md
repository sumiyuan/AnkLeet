# Phase 1: Foundation and Capture - Research

**Researched:** 2026-03-13
**Domain:** Chrome Extension MV3, Network Interception, IndexedDB, LeetCode API
**Confidence:** MEDIUM-HIGH (LeetCode endpoint details verified via open-source client implementations; MV3 patterns verified via official Chrome docs)

## Summary

Phase 1 builds a greenfield Chrome extension (Manifest V3) that silently captures every LeetCode submission the moment it completes. The core technical challenge is reading network response bodies in MV3: `chrome.webRequest` can observe requests but cannot read response bodies, and `declarativeNetRequest` operates on rules rather than programmatic inspection. The only viable body-reading path is a MAIN-world content script that overrides `window.fetch` and `XMLHttpRequest` before LeetCode's page scripts run, clones the response stream, and relays data to an isolated-world content script via `window.postMessage`, which then forwards to the service worker via `chrome.runtime.sendMessage`.

LeetCode's submission flow is a two-phase REST/poll pattern: `POST /problems/{slug}/submit/` returns a `submission_id`, then the browser polls `GET /submissions/detail/{id}/check/` until the verdict appears. The check response contains `status_msg` ("Accepted", "Wrong Answer", etc.), `status_code`, and the submitted code, but NOT question metadata (title, difficulty, tags). LeetCode's own frontend subsequently fires a `submissionDetails` GraphQL query to `https://leetcode.com/graphql/` to display the result page — this GraphQL response is the right place to capture complete metadata in a single call.

Service worker lifecycle is the key reliability risk: MV3 workers shut down after 30 seconds of inactivity and individual operations time out at 5 minutes. All listener registrations must be at the global (top-level) scope. IndexedDB persists across worker restarts; the service worker should open the DB connection on startup and keep it in memory for the worker's lifetime.

**Primary recommendation:** Use a dual-content-script fetch interceptor (MAIN world overrides `window.fetch` + ISOLATED world relays messages) targeting LeetCode's own `submissionDetails` GraphQL response, which carries both verdict and question metadata in one payload. Store submissions in IndexedDB with a fixed schema versioned from day one.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Network interception via chrome.webRequest or declarativeNetRequest to catch the GraphQL/REST submission call
- Parse problem metadata (title, difficulty, tags, URL) from the submission response itself — no separate API call or DOM scraping
- Scope limited to problem pages only (leetcode.com/problems/*) — contest pages excluded
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

### Deferred Ideas (OUT OF SCOPE)
- Difficulty rating prompt after submission capture — belongs in Phase 2 (FSRS) / Phase 3 (Dashboard UI)
- Contest page submission capture — could be added as a future enhancement
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CAPT-01 | Extension auto-captures accepted and wrong submissions on LeetCode | Dual content-script fetch interceptor targeting LeetCode's submissionDetails GraphQL + REST check endpoint; status_code maps verdicts |
| CAPT-02 | Each submission stores code, result, timestamp, and problem metadata (title, difficulty, tags, URL) | submissionDetails GraphQL response contains code + verdict; question sub-object carries title/difficulty/topicTags; URL constructed from titleSlug |
| STOR-01 | All data stored locally via Chrome storage / IndexedDB (no account needed) | IndexedDB for submission history (large, unbounded growth); chrome.storage.local for settings (10 MB quota); no cloud dependency |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Chrome Extension MV3 | Manifest v3 | Extension platform | MV2 deprecated June 2025; MV3 is required for Chrome Web Store |
| IndexedDB (native) | Web API | Submission history storage | Persists across service worker restarts; no quota ceiling without unlimitedStorage; available in both content scripts and service workers |
| chrome.storage.local | Chrome API | Settings storage | Extension-native; survives browsing history clears; 10 MB quota (enough for settings) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Shadow DOM (native) | Web API | Toast UI style isolation | Prevents LeetCode page CSS from corrupting toast appearance or vice versa |
| chrome.alarms | Chrome API | Service worker keep-alive probe | Use only if long-running listener gaps exist; avoid if network events keep worker active |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Fetch interceptor (MAIN world) | chrome.debugger API | debugger requires DevTools to be open or shows a yellow bar; unsuitable for production |
| Fetch interceptor (MAIN world) | DOM mutation observer | DOM changes are unreliable indicators of submission; misses headless/API flows |
| IndexedDB | chrome.storage.local for submissions | storage.local has 10 MB cap; unbounded submission history will exceed it |
| Shadow DOM toast | Injected iframe | Shadow DOM is simpler, no separate document, no cross-origin message overhead |

**Installation:**

No npm packages required for Phase 1. Pure browser APIs only (IndexedDB, chrome.*). This keeps the extension lightweight and avoids MV3 bundling complexity.

If a build step is added later for TypeScript, use:
```bash
npm install --save-dev typescript @types/chrome
```

## Architecture Patterns

### Recommended Project Structure
```
extension/
├── manifest.json          # MV3 manifest
├── background.js          # Service worker: storage, message routing
├── content-main.js        # MAIN world: fetch/XHR override, stream cloning
├── content-isolated.js    # ISOLATED world: postMessage relay to service worker
├── content-toast.js       # Toast UI injection (ISOLATED world, runs at document_end)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### Pattern 1: Dual Content Script Fetch Interceptor

**What:** Two content scripts on the same page with different execution worlds. MAIN world script overrides `window.fetch` before LeetCode's JS loads, clones response streams for inspection, sends data via `window.postMessage`. ISOLATED world script listens for those messages and forwards to the service worker.

**When to use:** Whenever you need to read response bodies in MV3. This is the only non-debugger approach that works without special permissions.

**manifest.json content_scripts section:**
```json
{
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["content-main.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["content-isolated.js"],
      "run_at": "document_start"
    },
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["content-toast.js"],
      "run_at": "document_end"
    }
  ]
}
```

**Required manifest.json permissions:**
```json
{
  "manifest_version": 3,
  "permissions": ["storage"],
  "host_permissions": ["https://leetcode.com/*"]
}
```

Note: `chrome.webRequest` (read-only observation) requires `"webRequest"` permission AND host permissions. However, because `webRequest` cannot read response bodies in MV3, the fetch interceptor is preferred for body access. `chrome.webRequest` may still be registered as a secondary signal for request detection, but the fetch interceptor is authoritative for data extraction.

**content-main.js — fetch override:**
```javascript
// Source: pattern from https://dev.to/wilow445/how-to-intercept-server-sent-events-in-chrome-extensions-mv3-guide-23kb
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const response = await originalFetch.apply(this, args);

  // Check if this is LeetCode's submissionDetails GraphQL call
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
  if (url && url.includes('leetcode.com/graphql')) {
    const cloned = response.clone(); // MUST clone before reading — stream is single-use
    cloned.json().then(body => {
      if (body?.data?.submissionDetails) {
        window.postMessage({
          source: 'leetreminder',
          type: 'submission',
          data: body.data.submissionDetails
        }, '*');
      }
    }).catch(() => {}); // silent fail — structure may change
  }

  return response; // always return original — page must still receive it
};
```

**content-isolated.js — message relay:**
```javascript
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.data?.source !== 'leetreminder') return;
  if (event.data?.type === 'submission') {
    chrome.runtime.sendMessage({
      type: 'SUBMISSION_CAPTURED',
      payload: event.data.data
    });
  }
});
```

### Pattern 2: LeetCode Submission Flow (Two-Phase)

**What:** LeetCode submits code via REST then polls for results via REST, then fires a GraphQL call for the results page. The GraphQL `submissionDetails` response is the capture target because it contains both verdict and question metadata.

**LeetCode network flow:**
```
1. POST https://leetcode.com/problems/{slug}/submit/
   Body: { lang, question_id, typed_code }
   Response: { submission_id: 12345678 }

2. GET https://leetcode.com/submissions/detail/{submission_id}/check/
   (polled every ~1s until status_code != 0)
   Response: {
     status_code: 10,           // 10=Accepted, 11=Wrong Answer, 14=TLE, 15=RE, 20=CE
     status_msg: "Accepted",
     total_correct: 73,
     total_testcases: 73,
     status_runtime: "0 ms",
     code_output: "",           // only on wrong answer
     last_testcase: ""          // only on wrong answer
     // NOTE: no question metadata here
   }

3. POST https://leetcode.com/graphql/
   operationName: "submissionDetails"
   variables: { submissionId: "12345678" }
   Response includes: {
     data: {
       submissionDetails: {
         code: "class Solution...",
         statusDisplay: "Accepted",
         lang: { name: "python3", verboseName: "Python3" },
         question: {
           title: "Two Sum",
           titleSlug: "two-sum",
           difficulty: "Easy",
           topicTags: [{ name: "Array" }, { name: "Hash Table" }]
         }
       }
     }
   }
```

**Intercept target:** Step 3 (submissionDetails GraphQL) — contains all required fields in one response.

**Confidence note:** The exact field names in the `submissionDetails` GraphQL response are MEDIUM confidence (derived from community open-source LeetCode clients, not official docs). Must verify via live traffic capture before finalizing field extraction code. The REST endpoint patterns (`/submit/`, `/submissions/detail/{id}/check/`) are HIGH confidence (verified via multiple independent open-source LeetCode clients).

### Pattern 3: Service Worker Event Registration

**What:** All Chrome extension event listeners must be registered at the top level (global scope) of background.js, not inside callbacks or conditionals. This ensures Chrome can wake the service worker and dispatch events correctly.

**background.js skeleton:**
```javascript
// Source: https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events
// ALL listeners at top level — never inside async callbacks

// Open IndexedDB on startup; store reference in module scope
let db = null;
openDatabase().then(database => { db = database; });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUBMISSION_CAPTURED') {
    saveSubmission(message.payload); // async, uses module-level db
  }
  return false; // no async response needed
});

// Function declarations below — not listener registrations
async function saveSubmission(data) { /* ... */ }
async function openDatabase() { /* ... */ }
```

### Pattern 4: IndexedDB Schema with Versioning

**What:** Lock the schema in version 1. Use `onupgradeneeded` for all schema changes. Version must be incremented for any structural change — it cannot be patched.

**Schema — submissions object store:**
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('leetreminder', 1); // version locked at 1 for Phase 1

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // submissions store
      const store = db.createObjectStore('submissions', {
        keyPath: 'id',
        autoIncrement: true
      });
      store.createIndex('submissionId', 'submissionId', { unique: true });
      store.createIndex('titleSlug', 'titleSlug', { unique: false });
      store.createIndex('capturedAt', 'capturedAt', { unique: false });
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}
```

**Submission record shape:**
```javascript
{
  // id: auto-incremented primary key
  submissionId: "12345678",      // LeetCode's ID — unique index, prevents duplicates
  titleSlug: "two-sum",
  title: "Two Sum",
  difficulty: "Easy",
  topicTags: ["Array", "Hash Table"],
  url: "https://leetcode.com/problems/two-sum/",
  code: "class Solution...",
  lang: "python3",
  langDisplay: "Python3",
  statusDisplay: "Accepted",     // "Accepted", "Wrong Answer", etc.
  capturedAt: 1710000000000      // Date.now() — indexed for time-range queries in Phase 3
}
```

**chrome.storage.local — settings shape:**
```javascript
// stored under key 'settings'
{
  captureEnabled: true           // allows user to pause capture (Phase 3 UI adds toggle)
}
```

### Pattern 5: Toast Notification with Shadow DOM

**What:** Inject a shadow root into the page body to display a self-contained toast. Shadow DOM CSS is isolated — LeetCode's stylesheets cannot bleed in or out.

```javascript
// content-toast.js (ISOLATED world, document_end)
function showToast(message) {
  const host = document.createElement('div');
  host.id = 'leetreminder-toast-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  // all styles scoped inside shadow root
  const style = document.createElement('style');
  style.textContent = `
    .toast {
      all: initial;   /* reset all inherited styles */
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1a1a1a;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 6px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      opacity: 1;
      transition: opacity 0.3s ease;
    }
    .toast.fade { opacity: 0; }
  `;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  shadow.appendChild(style);
  shadow.appendChild(toast);

  // auto-dismiss after 2 seconds
  setTimeout(() => {
    toast.classList.add('fade');
    setTimeout(() => host.remove(), 300);
  }, 2000);
}

// listen for message from service worker → content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_TOAST') {
    showToast('✓ Submission captured');
  }
});
```

The service worker sends `SHOW_TOAST` to the active tab's content script after successfully writing to IndexedDB.

### Anti-Patterns to Avoid

- **Registering listeners inside `chrome.runtime.onInstalled` or async callbacks:** Chrome cannot deliver events to listeners registered asynchronously. All `chrome.runtime.onMessage.addListener` calls must be at the top level of background.js.
- **Using `localStorage` in service worker:** `localStorage` is not available in service workers. Use `chrome.storage` or IndexedDB.
- **Reading a fetch response stream twice without cloning:** `response.json()` consumes the stream. Always call `response.clone()` before reading the body; return the original to the page.
- **Trusting a single URL pattern forever:** LeetCode changes its API paths without notice. The intercept logic must handle graceful failure when the expected fields are absent.
- **Skipping IndexedDB version increment:** Any structural change to an object store requires a version bump. Forgetting this silently keeps the old schema on existing installs.
- **Hard-coding `question_id` lookup:** The `question_id` for the REST submit endpoint is the backend integer ID, not the frontend display number. It is embedded in the LeetCode page state — do not assume it equals the frontendQuestionId.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSS isolation for toast | Manual `!important` overrides or scoped class prefixes | Shadow DOM (`attachShadow`) | LeetCode uses aggressive CSS; shadow root is the only reliable isolation boundary |
| Unique submission deduplication | Custom hash or timestamp check | IndexedDB unique index on `submissionId` | IndexedDB unique constraint throws on duplicate put — use as the guard |
| Fetch interception routing | Custom event bus library | `window.postMessage` + `chrome.runtime.sendMessage` | Native APIs with zero overhead; the two-hop pattern (MAIN → ISOLATED → SW) is the MV3-standard approach |
| Response body buffering | Manual ReadableStream handling | `response.clone().json()` | Clone + json() handles buffering, encoding, and stream consumption atomically |

**Key insight:** The MV3 platform removes most of the interception power that MV2 extensions had. Every workaround involves the page's own JavaScript context (MAIN world). Fighting this by trying to intercept at the service worker level (chrome.webRequest) will get you headers only, never bodies.

## Common Pitfalls

### Pitfall 1: Service Worker Terminates Mid-Operation
**What goes wrong:** Service worker shuts down after 30 seconds idle. If a submission capture message arrives while the worker is cold-starting, the listener may miss it.
**Why it happens:** MV3 service workers are not persistent. They start on demand, run, then terminate.
**How to avoid:** Register all message listeners at the top level of background.js (not in callbacks). Chrome queues events and delivers them once the worker script has executed its top-level code. Also open the IndexedDB connection eagerly at the top level so it is ready before messages arrive.
**Warning signs:** Intermittent capture failures that reproduce after the browser sits idle for 30+ seconds.

### Pitfall 2: LeetCode GraphQL Field Names Change
**What goes wrong:** LeetCode silently renames `statusDisplay` → `status`, `topicTags` → `tags`, etc. The extension stops capturing metadata but gives no error.
**Why it happens:** LeetCode's GraphQL schema is undocumented and evolves with their frontend deployments.
**How to avoid:** Validate presence of expected fields before writing to IndexedDB. Log a structured warning (e.g., `console.warn('[LeetReminder] Unexpected submissionDetails shape', body)`) when required fields are missing. Decide: silent skip with log (recommended for Phase 1) vs. user-facing error toast.
**Warning signs:** Submissions appear in storage with null/undefined title or difficulty.

### Pitfall 3: Response Stream Already Consumed
**What goes wrong:** `response.json()` or `response.text()` is called on the response before returning it to the page. LeetCode's code then gets an empty or errored response. The submission result page breaks.
**Why it happens:** Fetch response bodies are single-use streams.
**How to avoid:** Always `const cloned = response.clone()` before reading. Call `.json()` on `cloned`, return `response` to the caller.
**Warning signs:** LeetCode submission result page shows a loading spinner forever or displays an error after submission.

### Pitfall 4: postMessage Source Not Validated
**What goes wrong:** Any page script (or malicious injection) can `postMessage` to the window. The ISOLATED world content script picks up spoofed submission events.
**Why it happens:** `window.postMessage` is available to all page scripts.
**How to avoid:** Check `event.source === window` and validate `event.data.source === 'leetreminder'` in the ISOLATED world listener before forwarding to the service worker. Do not relay arbitrary payloads.
**Warning signs:** Phantom submissions appearing in storage that don't correspond to actual LeetCode submissions.

### Pitfall 5: IndexedDB Schema Migration Locked After First Install
**What goes wrong:** Phase 1 schema deployed. Phase 2 needs a new field or index. Developer forgets to increment DB version. Existing users keep old schema silently; new fields are never created.
**Why it happens:** `onupgradeneeded` only fires when version number increases.
**How to avoid:** Increment the version integer for every structural change. Write upgrade logic that handles transitions (e.g., `if (oldVersion < 2) { store.createIndex(...) }`). Design Phase 1 schema to anticipate Phase 2 needs (e.g., include a `nextReviewAt` field initialized to null).
**Warning signs:** New queries that depend on new indexes return 0 results or throw `DOMException: The operation failed because the requested database object could not be found.`

### Pitfall 6: Missing LeetCode Request Credentials
**What goes wrong:** Extension attempts to make its own fetch to LeetCode GraphQL to retrieve metadata (violating the "no separate API call" constraint). The request fails due to missing session cookies or CSRF token.
**Why it happens:** LeetCode requires `csrftoken` header and session cookie for authenticated GraphQL calls.
**How to avoid:** Do NOT make separate fetch calls. Intercept LeetCode's own calls (they already carry the correct credentials). This also satisfies the locked decision: "parse metadata from the submission response itself."

## Code Examples

Verified patterns from official sources:

### Manifest V3 Minimum Viable manifest.json
```json
{
  "manifest_version": 3,
  "name": "LeetReminder",
  "version": "1.0.0",
  "description": "Automatically track every LeetCode submission",
  "permissions": ["storage"],
  "host_permissions": ["https://leetcode.com/*"],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["content-main.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["content-isolated.js"],
      "run_at": "document_start"
    },
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["content-toast.js"],
      "run_at": "document_end"
    }
  ],
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```
Source: https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3

### IndexedDB add with duplicate guard
```javascript
// Source: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB
function saveSubmission(db, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['submissions'], 'readwrite');
    const store = tx.objectStore('submissions');
    const req = store.add(record); // throws ConstraintError if submissionId already exists
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => {
      if (e.target.error.name === 'ConstraintError') {
        resolve(null); // duplicate — silently skip
      } else {
        reject(e.target.error);
      }
    };
  });
}
```

### Service worker messaging back to content script
```javascript
// background.js — send toast trigger to active tab
async function notifyTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_TOAST' });
  } catch {
    // tab may have navigated away — ignore
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MV2 background page (persistent) | MV3 service worker (ephemeral) | MV2 deprecated June 2025 | Must treat all state as ephemeral; persist to IndexedDB/storage eagerly |
| `webRequestBlocking` to read/modify bodies | MAIN world fetch override + postMessage | MV3 (2023+) | More code, but works without special enterprise permissions |
| `localStorage` for extension data | `chrome.storage.local` + IndexedDB | MV3 (localStorage unavailable in SW) | localStorage unavailable in service workers entirely |
| Inline script injection via DOM | `world: "MAIN"` in manifest content_scripts | Chrome 111+ (2023) | Cleaner than DOM script injection; avoids CSP issues |

**Deprecated/outdated:**
- `background.persistent: true`: Removed in MV3. Setting it has no effect.
- `chrome.extension.getBackgroundPage()`: Not available in MV3.
- MV2 `webRequest` blocking: Removed for non-enterprise in June 2025.
- Inline script injection (`document.head.appendChild(script)`) as MAIN world entry: Replaced by `"world": "MAIN"` in manifest; the old approach may be blocked by LeetCode's CSP.

## Open Questions

1. **Exact `submissionDetails` GraphQL response shape**
   - What we know: The query is named `submissionDetails`, takes `submissionId`, and returns code + question sub-object based on community client implementations
   - What's unclear: Exact field names (`statusDisplay` vs `status`, `topicTags` vs `tags`, nested question object structure) — LeetCode's schema is undocumented
   - Recommendation: During Wave 0 / task 1, capture a live `submissionDetails` response in browser DevTools Network tab before writing extraction code. Add a fallback path that logs the raw shape if expected fields are absent.

2. **Does LeetCode's CSP block MAIN world overrides?**
   - What we know: `"world": "MAIN"` in manifest is the recommended approach; it is not an inline script injection and should not be blocked by CSP
   - What's unclear: Whether LeetCode applies a strict `script-src` that could interfere with manifest-declared MAIN world scripts
   - Recommendation: Test on first implementation task. If blocked, the fallback is to intercept the ISOLATED world's `chrome.webRequest.onCompleted` for URL pattern matching and trigger a separate authenticated fetch — but this violates the "no separate API call" constraint and needs a decision from the user.

3. **Service worker wake-up reliability for message delivery**
   - What we know: Chrome queues events for terminated workers if listeners are registered at top-level; worker restarts to handle them
   - What's unclear: Exact timing window between content script message send and worker cold-start; whether `sendMessage` can fail if worker hasn't started yet
   - Recommendation: Wrap `chrome.runtime.sendMessage` in the content script with a retry (attempt 2x with 500ms gap). The worker's startup time is typically under 200ms.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — greenfield project |
| Config file | None — see Wave 0 |
| Quick run command | `open extension/ in chrome://extensions` (manual load) |
| Full suite command | Manual end-to-end: load unpacked, submit on LeetCode, verify IndexedDB |

Because this is a browser extension with no Node.js runtime, unit testing requires a DOM environment (jsdom) or a dedicated extension testing framework. The primary validation method for Phase 1 is manual end-to-end testing with the unpacked extension loaded in Chrome.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAPT-01 | Accepted submission triggers capture | manual-e2e | Load unpacked, submit AC solution, verify IndexedDB via DevTools | ❌ Wave 0 |
| CAPT-01 | Wrong answer submission triggers capture | manual-e2e | Submit wrong solution, verify IndexedDB entry with statusDisplay="Wrong Answer" | ❌ Wave 0 |
| CAPT-01 | Toast appears within 2s of submission | manual-e2e | Visual inspection after submission | ❌ Wave 0 |
| CAPT-02 | Record contains code, result, timestamp, title, difficulty, tags, URL | manual-e2e | Inspect IndexedDB record fields in DevTools Application tab | ❌ Wave 0 |
| CAPT-01 | Extension captures after browser restart | manual-e2e | Restart Chrome, submit, verify record appears | ❌ Wave 0 |
| STOR-01 | Submissions persist in IndexedDB, settings in chrome.storage.local | manual-e2e | Inspect via DevTools → Application → IndexedDB and Local Storage | ❌ Wave 0 |

**Manual-only justification:** Chrome extension network interception cannot be exercised in jsdom or Node.js. An automated test harness would require Puppeteer/Playwright with a real Chrome instance and a LeetCode account — this is disproportionate for Phase 1 of a greenfield project. The verification plan for this phase is structured manual testing with clear pass/fail criteria.

### Sampling Rate
- **Per task commit:** Load unpacked extension in Chrome; open any LeetCode problem page; check browser console for errors
- **Per wave merge:** Full end-to-end: submit AC + WA solution; verify both records in IndexedDB; verify toast appears and dismisses; restart browser and confirm records persist
- **Phase gate:** All manual test rows above green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `extension/manifest.json` — starting point for MV3 shell
- [ ] `extension/background.js` — service worker skeleton with top-level listener stubs
- [ ] `extension/content-main.js` — MAIN world fetch override (capture target: submissionDetails GraphQL)
- [ ] `extension/content-isolated.js` — ISOLATED world postMessage → sendMessage relay
- [ ] `extension/content-toast.js` — Shadow DOM toast UI
- [ ] `extension/icons/` — icon files (16, 48, 128px)
- [ ] Manual test checklist document (inline in verification plan)

## Sources

### Primary (HIGH confidence)
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle — Service worker 30s idle timeout, event listener top-level requirement
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events — Top-level listener registration rule
- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts — MAIN vs ISOLATED world, `world` property
- https://developer.chrome.com/docs/extensions/reference/api/storage — chrome.storage.local 10 MB quota
- https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB — IndexedDB open, onupgradeneeded, add/put/get patterns
- https://developer.chrome.com/docs/extensions/reference/api/webRequest — webRequest observation vs blocking in MV3

### Secondary (MEDIUM confidence)
- https://raw.githubusercontent.com/kaiwk/leetcode.el/master/leetcode.el — LeetCode REST endpoints: `/problems/{slug}/submit/` and `/submissions/detail/{id}/check/`; response fields: status_code, status_msg, code values (10=Accepted, 11=WA, etc.)
- https://dev.to/wilow445/how-to-intercept-server-sent-events-in-chrome-extensions-mv3-guide-23kb — Dual content script pattern: MAIN world fetch override + postMessage + ISOLATED world relay
- https://kaangenc.me/2024.05.18.using-shadow-dom-to-isolate-injected-browser-extension-compo/ — Shadow DOM isolation pattern for injected UI in Chrome extensions

### Tertiary (LOW confidence — requires live verification)
- Community knowledge: `submissionDetails` GraphQL operationName and response shape including `question { title, titleSlug, difficulty, topicTags }` — inferred from multiple LeetCode API wrappers but not directly verified against LeetCode's live schema. MUST be confirmed by capturing a live DevTools network response before writing field extraction code.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — MV3 APIs are stable and well-documented
- Architecture: HIGH — dual content script pattern verified via official docs and working extensions
- LeetCode endpoint patterns: MEDIUM — REST endpoints verified via open-source clients; GraphQL submissionDetails field names need live verification
- Pitfalls: HIGH — derived from direct experience patterns in MV3 extension development
- Toast / Shadow DOM: HIGH — Shadow DOM isolation is well-documented browser standard

**Research date:** 2026-03-13
**Valid until:** 2026-04-13 for MV3 patterns (stable); 2026-03-20 for LeetCode-specific endpoint details (LeetCode deploys frequently — verify before coding)
