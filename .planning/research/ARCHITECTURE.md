# Architecture Research

**Domain:** Chrome Extension with Content Script Injection, Background Service Worker, Local Storage, FSRS Spaced Repetition
**Researched:** 2026-03-13 (updated for v1.1 AI feedback milestone)
**Confidence:** HIGH (based on direct reading of existing source files + official Chrome docs)

---

## v1.1 Focus: AI Feedback Integration Architecture

This document is updated for the v1.1 milestone. The section below documents how the new AI feedback feature integrates with the existing codebase. The original architecture from v1.0 research is preserved at the bottom.

---

## Existing Architecture (as-built, v1.0)

### Actual Component Inventory

| File | World | Run At | Role |
|------|-------|--------|------|
| `background.js` | Service Worker | on-demand | Central coordinator: IndexedDB, FSRS, message routing, alarms, notifications |
| `content-main.js` | MAIN | document_start | fetch/XHR interceptor — posts to window |
| `content-isolated.js` | ISOLATED | document_start | Bridges window.postMessage to chrome.runtime.sendMessage |
| `content-toast.js` | ISOLATED | document_end | Shadow DOM UI: toast for wrong submissions, rating dialog for accepted |
| `popup.js` | Popup page | — | Dashboard, Reviews, Settings tabs |

### Existing Message Types

| Type | Direction | Handler |
|------|-----------|---------|
| `SUBMISSION_CAPTURED` | content-isolated → background | `saveSubmission()` — persists, triggers SHOW_TOAST or SHOW_RATING |
| `RATE_REVIEW` | popup / content-toast → background | `rateReview()` — updates FSRS card |
| `GET_DUE_TODAY` | popup → background | Returns enriched card array |
| `GET_STATS` | popup → background | Returns `{ totalReviews, retentionRate, streak }` |
| `GET_TODAY_SUBMISSIONS` | popup → background | Returns submissions from today |
| `SHOW_TOAST` | background → content-toast | Triggers "submission captured" toast |
| `SHOW_RATING` | background → content-toast | Triggers FSRS rating dialog |

### Wrong Submission Flow (current, pre-AI)

```
User submits wrong answer on LeetCode
    |
    v
content-main.js (MAIN world) intercepts XHR/fetch
    | window.postMessage({source:'leetreminder', type:'submission', data})
    v
content-isolated.js (ISOLATED world)
    | chrome.runtime.sendMessage({type:'SUBMISSION_CAPTURED', payload})
    v
background.js saveSubmission()
    - Persists to IndexedDB (submissions store)
    - statusDisplay is NOT 'Accepted' → notifyTab({type:'SHOW_TOAST'})
    |
    v
content-toast.js showToast('✓ Submission captured')
```

---

## v1.1 Integration Design

### Where the API Call Lives: background.js (service worker)

The Claude API call must live in `background.js`. This is not a choice — it is architecturally forced by three constraints:

1. **CORS**: Content scripts are bound by the host page's (leetcode.com's) CORS policy. `api.anthropic.com` is not in LeetCode's CORS allow-list. The fetch will be blocked. Service workers are not subject to page-level CORS — they use host permissions from `manifest.json`.

2. **API key security**: The key is stored in `chrome.storage.local`. Content scripts can read `chrome.storage` but if the key were passed to a content script to make the call, it would be briefly accessible in a context that shares memory with the page. Keeping it exclusively in the service worker context is safer.

3. **Data access**: The submission record (code, error output, titleSlug, language) is in IndexedDB. Only the service worker has an open `db` reference. Passing all that data to a content script to make a call and pass it back is wasteful.

### New Message Types Needed

| Type | Direction | Payload | Response |
|------|-----------|---------|----------|
| `GET_AI_FEEDBACK` | content-toast → background | `{ submissionId, mode: 'hint' \| 'full' }` | `{ feedback: string }` or `{ error: string }` |

That is the only new message type needed. The existing content-toast.js already has `chrome.runtime.sendMessage` wired for RATE_REVIEW — the same pattern applies here.

No new message types are needed for the background-to-content direction. The AI response travels back as the `sendResponse` callback argument of the existing `chrome.runtime.onMessage` listener. This is a single request-response, not a stream.

### Non-Streaming vs Streaming

**Recommendation: non-streaming for v1.1.**

Streaming (Server-Sent Events from the Claude API) is technically achievable from the service worker — the service worker can call `fetch()` and consume a ReadableStream. However, relaying that stream to the content script requires `chrome.runtime.Port` (long-lived connections), not the simpler `sendMessage`/`sendResponse` pattern. Port adds meaningful complexity:

- The content script must call `chrome.runtime.connect()` instead of `sendMessage()`
- The service worker must handle `chrome.runtime.onConnect`
- Both sides must handle disconnect events and cleanup
- The streaming loop must not block the service worker's event loop

Non-streaming: one `fetch()` call to the Claude API with `stream: false`, wait for the full JSON response, call `sendResponse({ feedback: text })`. This fits perfectly into the existing `return true` async pattern already used for RATE_REVIEW, GET_DUE_TODAY, etc.

The UX tradeoff is a loading spinner instead of progressive text reveal. For the short responses the Claude API returns for hint/full-solution prompts (typically under 500 tokens), the wait is 1-3 seconds — acceptable without streaming.

### Where to Display in Shadow DOM

The AI feedback should display inside the **existing wrong-submission dialog in content-toast.js** — not as a separate popup, not in the extension popup. The user is on the LeetCode problem page when the wrong submission happens. The toast/dialog is already showing. Add the AI buttons there.

The current `showToast()` for wrong submissions is a simple 2-second auto-dismiss toast. This needs to change to a dismissible dialog (like `showRatingDialog`) that includes "Hint" and "Full Solution" buttons and a content area for the AI response.

**New flow:**

```
Wrong submission captured
    |
    v
background.js saveSubmission()
    - Saves to IndexedDB (same as now)
    - Sends SHOW_WRONG_SUBMISSION to tab (replaces SHOW_TOAST for wrong answers)
      payload: { submissionId, titleSlug, title }
    |
    v
content-toast.js showWrongSubmissionDialog(submissionId, titleSlug, title)
    - Shadow DOM dialog (similar structure to showRatingDialog)
    - "Hint" button + "Full Solution" button + "Dismiss" link
    - User clicks "Hint":
        | chrome.runtime.sendMessage({type:'GET_AI_FEEDBACK', payload:{submissionId, mode:'hint'}})
        v
        [loading state in dialog]
        |
        v (sendResponse callback)
        Render feedback text in dialog content area
```

### No API Key Guard Needed in Content Script

The content-toast.js dialog does not need to check whether an API key is configured. The check happens in background.js. If no key is configured, background.js returns `{ error: 'No API key configured. Add your Anthropic API key in Settings.' }` and the dialog renders that message inline.

### Submitting the submissionId

The wrong submission flow currently does not send the submissionId to content-toast.js. The SHOW_TOAST message has no payload. To enable the AI feedback request, the SHOW_WRONG_SUBMISSION message must include the submissionId (the IndexedDB `id` field or the LeetCode `submission_id`).

In `saveSubmission()` in background.js, the `addRecord()` call returns the IndexedDB auto-increment key. That key must be captured and included in the `notifyTab` call.

---

## Updated System Overview (v1.1)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CHROME BROWSER                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   LEETCODE.COM TAB                          │     │
│  │                                                             │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │  content-main.js (MAIN world, document_start)        │   │     │
│  │  │  XHR/fetch interceptor → window.postMessage          │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  │                 |  window.postMessage                        │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │  content-isolated.js (ISOLATED, document_start)      │   │     │
│  │  │  Relay: window msg → chrome.runtime.sendMessage      │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  │                 |  SUBMISSION_CAPTURED                       │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │  content-toast.js (ISOLATED, document_end)           │   │     │
│  │  │  Shadow DOM UI:                                       │   │     │
│  │  │  - showToast (simple info, unchanged)                 │   │     │
│  │  │  - showWrongSubmissionDialog [NEW]                    │   │     │
│  │  │    ├── "Hint" btn → GET_AI_FEEDBACK(mode:'hint')      │   │     │
│  │  │    ├── "Full Solution" btn → GET_AI_FEEDBACK(full)    │   │     │
│  │  │    └── feedback content area                          │   │     │
│  │  │  - showRatingDialog (accepted, unchanged)             │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │               BACKGROUND SERVICE WORKER (background.js)      │    │
│  │                                                              │    │
│  │  Existing handlers (unchanged):                              │    │
│  │  - SUBMISSION_CAPTURED → saveSubmission()                    │    │
│  │  - RATE_REVIEW → rateReview()                                │    │
│  │  - GET_DUE_TODAY, GET_STATS, GET_TODAY_SUBMISSIONS           │    │
│  │                                                              │    │
│  │  New handler [NEW]:                                          │    │
│  │  - GET_AI_FEEDBACK                                           │    │
│  │    1. Read submission from IndexedDB by id                   │    │
│  │    2. Read API key from chrome.storage.local                 │    │
│  │    3. Build prompt (code + error + problem context)          │    │
│  │    4. fetch('https://api.anthropic.com/v1/messages', ...)    │    │
│  │    5. sendResponse({ feedback }) or { error }                │    │
│  │                                                              │    │
│  │  Modified: saveSubmission() [MODIFIED]                       │    │
│  │  - Capture IndexedDB key from addRecord()                    │    │
│  │  - Pass key in SHOW_WRONG_SUBMISSION payload                 │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                         |  fetch()                                    │
│                         v                                            │
│              api.anthropic.com/v1/messages                           │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                   POPUP (popup.js)                           │    │
│  │  Settings tab: Anthropic API key input → chrome.storage      │    │
│  │  (No changes needed for AI feedback — runs on content page)  │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                       STORAGE LAYER                          │    │
│  │  chrome.storage.local: { settings: { openRouterApiKey } }    │    │
│  │  (key name: openRouterApiKey — already in schema, reuse it)  │    │
│  │                                                              │    │
│  │  IndexedDB (leetreminder, v2):                               │    │
│  │  - submissions: code, error, titleSlug, statusDisplay        │    │
│  │  - cards, reviewLogs (unchanged)                             │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `content-main.js` | XHR/fetch interception in MAIN world (unchanged) | `content-isolated.js` via window.postMessage |
| `content-isolated.js` | Relay postMessage → chrome.runtime (unchanged) | `background.js` via chrome.runtime.sendMessage |
| `content-toast.js` | Shadow DOM UI on LeetCode page — wrong submission dialog with AI buttons [modified], rating dialog [unchanged] | `background.js` via chrome.runtime.sendMessage (both directions) |
| `background.js` | All data operations, FSRS, alarms, notifications, Claude API calls [new GET_AI_FEEDBACK handler] | content-toast (via tabs.sendMessage), popup (via onMessage), IndexedDB, chrome.storage, api.anthropic.com |
| `popup.js` | Dashboard, Reviews, Settings (Settings tab already has openRouterApiKey field) | `background.js` via chrome.runtime.sendMessage |

---

## Architectural Patterns

### Pattern 1: API Calls Belong in the Service Worker

**What:** All external API calls — including Claude — must originate from `background.js`, not from content scripts.

**When to use:** Always, for any cross-origin fetch in a Chrome extension.

**Trade-offs:** The service worker may be terminated between the user clicking the button and the response arriving. In practice, the in-flight `fetch()` keeps the service worker alive (Chrome counts active fetch promises as activity). The 30-second termination timer resets while a fetch is pending.

**Example:**
```javascript
// In background.js — inside chrome.runtime.onMessage.addListener
if (message.type === 'GET_AI_FEEDBACK') {
  (async () => {
    if (!db) { try { db = await openDatabase(); } catch (err) { sendResponse({ error: 'DB unavailable' }); return; } }

    // 1. Load submission
    const submission = await getSubmissionById(db, message.payload.submissionId);
    if (!submission) { sendResponse({ error: 'Submission not found' }); return; }

    // 2. Load API key
    const { settings } = await chrome.storage.local.get('settings');
    const apiKey = settings?.openRouterApiKey;
    if (!apiKey) { sendResponse({ error: 'No API key configured. Add your Anthropic API key in Settings.' }); return; }

    // 3. Build prompt and call API
    try {
      const feedback = await callClaudeAPI(apiKey, submission, message.payload.mode);
      sendResponse({ feedback });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();
  return true; // keep message channel open for async response
}
```

### Pattern 2: Extend the Wrong-Submission Dialog in content-toast.js

**What:** Replace the current auto-dismiss `showToast()` for wrong submissions with a persistent `showWrongSubmissionDialog()` that includes AI feedback buttons and a content area.

**When to use:** The toast approach is wrong for this feature — the user needs to be able to read the AI response, which requires a persistent dismissible panel.

**Trade-offs:** The existing `removeHost()` function already handles cleanup. The rating dialog pattern (`showRatingDialog`) provides the correct structural template. Reuse the same shadow DOM host id (`leetreminder-toast-host`) so at most one dialog is visible at a time.

**Example structure:**
```javascript
function showWrongSubmissionDialog(submissionId, titleSlug, title) {
  removeHost(); // remove any previous toast/dialog

  const host = document.createElement('div');
  host.id = 'leetreminder-toast-host';
  document.body.appendChild(host);
  const shadow = host.attachShadow({ mode: 'closed' });

  // ... styles (reuse existing dialog styles, add .feedback-area, .loading)

  // Buttons trigger GET_AI_FEEDBACK message
  hintBtn.addEventListener('click', function () {
    setLoadingState(true);
    chrome.runtime.sendMessage(
      { type: 'GET_AI_FEEDBACK', payload: { submissionId, mode: 'hint' } },
      function (response) {
        setLoadingState(false);
        if (response && response.feedback) {
          renderFeedback(response.feedback);
        } else {
          renderFeedback(response?.error || 'Failed to get feedback.');
        }
      }
    );
  });
}
```

### Pattern 3: Async Response with return true

**What:** The existing pattern in `background.js` for all async message handlers — return `true` from `onMessage.addListener` to keep the response channel open.

**When to use:** Any handler that calls `sendResponse` asynchronously (after an await or inside a Promise).

**Trade-offs:** Must be `true` (literal), not a truthy value. Chrome checks this synchronously before the IIFE runs. All existing handlers already use this pattern — the GET_AI_FEEDBACK handler follows the same structure.

---

## Data Flow

### AI Feedback Request Flow

```
User sees wrong submission captured
    |
    v [SHOW_WRONG_SUBMISSION from background, replaces SHOW_TOAST]
content-toast.js renders wrong submission dialog
    - Shows: problem title, "Hint" button, "Full Solution" button, "Dismiss"
    |
    | (user clicks "Hint")
    v
chrome.runtime.sendMessage({
  type: 'GET_AI_FEEDBACK',
  payload: { submissionId: <IDB key>, mode: 'hint' }
})
    |
    v [background.js onMessage handler — return true for async]
background.js GET_AI_FEEDBACK handler:
  1. getSubmissionById(db, submissionId)
     → { code, statusDisplay, titleSlug, title, lang, error output }
  2. chrome.storage.local.get('settings')
     → settings.openRouterApiKey (field already exists in schema)
  3. if (!apiKey) → sendResponse({ error: 'No API key...' })
  4. fetch('https://api.anthropic.com/v1/messages', {
       method: 'POST',
       headers: {
         'x-api-key': apiKey,
         'anthropic-version': '2023-06-01',
         'content-type': 'application/json'
       },
       body: JSON.stringify({
         model: 'claude-3-5-haiku-20241022',  // fast, cheap, good for code
         max_tokens: 1024,
         messages: [{ role: 'user', content: buildPrompt(submission, mode) }]
       })
     })
  5. const data = await response.json()
     → data.content[0].text
  6. sendResponse({ feedback: data.content[0].text })
    |
    v [sendResponse callback in content-toast.js]
content-toast.js renders feedback text in dialog content area
    - Markdown-lite rendering (or plain text — decide in implementation)
    - "Dismiss" button remains available
```

### Modified saveSubmission Flow

```
saveSubmission(data, tabId):
  ...
  const saved = await addRecord(db, record);  // returns IDB key (integer) or null
  if (saved !== null) {
    if (record.statusDisplay === 'Accepted') {
      // unchanged — maybeCreateCard + SHOW_RATING
    } else if (tabId !== null) {
      // CHANGED: was notifyTab(tabId, { type: 'SHOW_TOAST' })
      // NOW:
      await notifyTab(tabId, {
        type: 'SHOW_WRONG_SUBMISSION',
        submissionId: saved,        // the IDB key from addRecord()
        titleSlug: record.titleSlug,
        title: record.title
      });
    }
  }
```

---

## New vs Modified Components

| Component | Status | What Changes |
|-----------|--------|--------------|
| `background.js` | Modified | Add `GET_AI_FEEDBACK` message handler; modify `saveSubmission()` to send `SHOW_WRONG_SUBMISSION` with `submissionId` instead of `SHOW_TOAST` |
| `content-toast.js` | Modified | Add `showWrongSubmissionDialog()` function; handle `SHOW_WRONG_SUBMISSION` message type; keep `showToast`, `showRatingDialog`, `maybeBlurEditor` unchanged |
| `manifest.json` | Modified | Add `https://api.anthropic.com/*` to `host_permissions` |
| `popup.js` | Unchanged | Settings tab already saves `openRouterApiKey` to `chrome.storage.local` — no changes needed |
| `content-main.js` | Unchanged | Submission interception is unaffected |
| `content-isolated.js` | Unchanged | Relay logic is unaffected |

---

## Build Order

The dependency chain for v1.1 is shallow — this is an additive feature:

```
1. manifest.json — add host_permissions for api.anthropic.com
   (Required before any fetch to Anthropic will be permitted)
        |
        v
2. background.js — modify saveSubmission() + add GET_AI_FEEDBACK handler
   (saveSubmission change must land before content-toast change, or
    the dialog will receive messages it can't handle yet)
        |
        v
3. content-toast.js — add showWrongSubmissionDialog() + SHOW_WRONG_SUBMISSION handler
   (Replaces the SHOW_TOAST path for wrong submissions)
        |
        v
4. Manual test: submit a wrong answer on LeetCode, verify dialog appears,
   verify hint/full-solution buttons call API, verify response renders
        |
        v
5. Test: no API key configured → error message renders inline (no crash)
6. Test: API key invalid → error message renders inline
7. Test: accepted submission still shows rating dialog (regression)
8. Test: dismiss works, no memory leaks (removeHost called)
```

The popup Settings tab already stores `openRouterApiKey`. No popup changes are needed unless the field label should be updated from "OpenRouter API Key" to "Anthropic API Key" to match the actual integration.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `api.anthropic.com` | `fetch()` from `background.js` service worker with `x-api-key` header | Must add to `host_permissions` in manifest.json; non-streaming (`stream: false`); key from `chrome.storage.local` |

### Internal Boundaries (new/modified)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `background.js` → `content-toast.js` | `chrome.tabs.sendMessage(tabId, { type: 'SHOW_WRONG_SUBMISSION', submissionId, ... })` | Replaces `SHOW_TOAST` for wrong submissions; submissionId is the IDB auto-increment key |
| `content-toast.js` → `background.js` | `chrome.runtime.sendMessage({ type: 'GET_AI_FEEDBACK', payload: { submissionId, mode } })` | Same pattern as `RATE_REVIEW`; uses `return true` for async response |

---

## Anti-Patterns

### Anti-Pattern 1: Fetching Claude API from a Content Script

**What people do:** Call `fetch('https://api.anthropic.com/...')` directly from `content-toast.js`.

**Why it's wrong:** CORS blocks all cross-origin requests from content scripts to domains not permitted by the host page (leetcode.com). The request fails with a network error. Additionally, the API key would be temporarily accessible in a context closer to the page's memory.

**Do this instead:** Send `GET_AI_FEEDBACK` to `background.js`. Make the fetch there.

### Anti-Pattern 2: Using chrome.runtime.Port for Non-Streaming Responses

**What people do:** Implement long-lived Port connections to support streaming, even when non-streaming is sufficient.

**Why it's wrong:** Port adds meaningful complexity — both sides must handle connect/disconnect events, cleanup on error, and the streaming loop. For a single request-response with a 1-3 second wait, a loading spinner and `return true` async pattern is simpler and correct.

**Do this instead:** Use non-streaming API call (`stream: false` in the Claude API body). Return the complete response via `sendResponse`. Add a loading state in the dialog.

### Anti-Pattern 3: Showing AI Feedback in the Popup Instead of on the Page

**What people do:** Route the user to the extension popup to see AI feedback after a wrong submission.

**Why it's wrong:** The user is on the LeetCode problem page. Opening the popup breaks their context and requires an extra click. The wrong submission dialog is already open on the page. Add the AI buttons there.

**Do this instead:** Extend `showWrongSubmissionDialog` in `content-toast.js` to include AI request buttons and a content area.

### Anti-Pattern 4: Not Capturing the IDB Key from addRecord()

**What people do:** Send a `SHOW_WRONG_SUBMISSION` message with only `titleSlug`, then look up the latest submission by `titleSlug` in `GET_AI_FEEDBACK`.

**Why it's wrong:** A user can submit multiple wrong answers rapidly. Looking up "latest by titleSlug" is a race condition — a second submission may overwrite which record is "latest" by the time the user clicks the button. The IDB auto-increment key uniquely identifies the exact submission.

**Do this instead:** `addRecord()` already returns the auto-increment key. Pass `saved` (the return value) as `submissionId` in the SHOW_WRONG_SUBMISSION payload.

---

## Settings Schema Note

The `chrome.storage.local` settings object currently uses `openRouterApiKey` as the field name (set by the Settings tab in popup.js). The project description says the AI integration is Anthropic/Claude, not OpenRouter. The `GET_AI_FEEDBACK` handler in background.js should read `settings.openRouterApiKey` as-is (the field already exists and is populated by the current Settings UI), unless the Settings tab label/field is renamed. This is a cosmetic decision but should be consistent — if the label in popup.html is updated to "Anthropic API Key", the storage key name can stay the same to avoid a migration.

---

## Original Architecture (v1.0)

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CHROME BROWSER                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   LEETCODE.COM TAB                          │     │
│  │                                                             │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │           ISOLATED WORLD (Content Scripts)           │   │     │
│  │  │  content-isolated.js — relay postMessage → runtime   │   │     │
│  │  │  content-toast.js — Shadow DOM UI                    │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  │                                                             │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │           MAIN WORLD (content-main.js)               │   │     │
│  │  │  Overrides window.fetch / XMLHttpRequest             │   │     │
│  │  │  Intercepts LeetCode submission API calls            │   │     │
│  │  │  Posts to window for content-isolated.js to relay   │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │               BACKGROUND SERVICE WORKER (background.js)      │    │
│  │  IndexedDB, FSRS, alarms, notifications, message routing     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                   POPUP (popup.html + popup.js)               │    │
│  │  Dashboard / Reviews / Settings tabs                          │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                       STORAGE LAYER                          │    │
│  │  chrome.storage.local: settings (captureEnabled, API key,    │    │
│  │    notifications, notification time)                         │    │
│  │  IndexedDB v2: submissions, cards, reviewLogs                │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

### v1.0 Architectural Patterns

**Pattern 1: MAIN World Script Injection for Network Interception**
Content scripts run in an isolated JavaScript context and cannot intercept `window.fetch` from the page. Injecting with `"world": "MAIN"` in manifest content scripts (Chrome 111+) shares the same window object as the page.

**Pattern 2: Event-Driven Service Worker with Persistent Storage**
Service workers terminate after 30 seconds of inactivity. All state lives in IndexedDB or chrome.storage.local. Listeners must register at the top level of background.js synchronously.

**Pattern 3: chrome.alarms for Review Scheduling**
`chrome.alarms` persists across service worker restarts and can wake a terminated service worker. Minimum period 30s (Chrome 120+).

---

## Sources

- [Chrome Extension Message Passing — Official Docs](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — HIGH confidence
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — HIGH confidence
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — HIGH confidence
- [Anthropic Messages API Reference](https://docs.anthropic.com/en/api/messages) — HIGH confidence (non-streaming, x-api-key header pattern)
- Direct reading of existing source files (background.js, content-toast.js, content-isolated.js, content-main.js, popup.js, manifest.json) — HIGHEST confidence

---
*Architecture research for: Chrome Extension with Content Script Injection, Service Worker, FSRS Spaced Repetition*
*Updated: 2026-03-13 — v1.1 AI feedback integration*
