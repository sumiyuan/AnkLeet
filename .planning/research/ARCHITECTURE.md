# Architecture Research

**Domain:** Chrome MV3 Extension — Interactive AI Chat with Conversation Storage
**Researched:** 2026-03-15 (updated for v1.2 AI Chat milestone)
**Confidence:** HIGH (direct source reading + Chrome MV3 documentation)

---

## Milestone Context

This document covers the v1.2 architecture: adding an interactive AI chat side panel with per-problem conversation history to the existing extension. The prior v1.0 and v1.1 architecture is preserved below as the baseline.

---

## Existing Architecture (as-built, v1.1)

### Component Inventory

| File | World | Run At | Role |
|------|-------|--------|------|
| `background.js` | Service Worker | on-demand | Central coordinator: IndexedDB, FSRS, message routing, alarms, notifications, OpenRouter API calls |
| `content-main.js` | MAIN | document_start | fetch/XHR interceptor — posts to window |
| `content-isolated.js` | ISOLATED | document_start | Bridges window.postMessage to chrome.runtime.sendMessage |
| `content-toast.js` | ISOLATED | document_end | Shadow DOM UI: toast, rating dialog, wrong submission dialog with AI feedback |
| `popup.js` | Popup page | — | Dashboard, Reviews, Settings tabs |

### Existing Message Types

| Type | Direction | Handler |
|------|-----------|---------|
| `SUBMISSION_CAPTURED` | content-isolated → background | `saveSubmission()` |
| `RATE_REVIEW` | content-toast / popup → background | `rateReview()` |
| `GET_DUE_TODAY` | popup → background | Returns enriched card array |
| `GET_STATS` | popup → background | Returns `{ totalReviews, retentionRate, streak }` |
| `GET_TODAY_SUBMISSIONS` | popup → background | Returns submissions from today |
| `GET_AI_FEEDBACK` | content-toast → background | OpenRouter call, returns `{ feedback }` or `{ error }` |
| `SHOW_RATING` | background → content-toast | Triggers FSRS rating dialog |
| `SHOW_WRONG_SUBMISSION` | background → content-toast | Triggers wrong submission dialog |

### Existing Storage Schema

**chrome.storage.local:**
```
settings: {
  captureEnabled: boolean,
  openRouterApiKey: string,
  aiModel: string,            // e.g. 'anthropic/claude-haiku-4.5'
  notificationsEnabled: boolean,
  notificationTime: string    // 'HH:MM'
}
lastNotifiedDate: string      // 'YYYY-MM-DD'
```

**IndexedDB `leetreminder` at version 2:**
```
submissions  keyPath: id (autoIncrement)
  indexes: submissionId (unique), titleSlug, capturedAt
  fields: submissionId, titleSlug, title, difficulty, topicTags,
          url, code, lang, langDisplay, statusDisplay,
          runtime, memory, capturedAt

cards  keyPath: titleSlug
  indexes: due, state
  fields: titleSlug, due, stability, difficulty, elapsed_days,
          scheduled_days, reps, lapses, state, last_review, createdAt

reviewLogs  keyPath: id (autoIncrement)
  indexes: titleSlug, reviewedAt
  fields: titleSlug, rating, oldState, newState, scheduledDays,
          elapsedDays, reviewedAt
```

---

## v1.2 Integration Design

### What v1.2 Adds

1. A persistent chat button on every LeetCode problem page that opens a chat side panel
2. Back-and-forth AI conversation (multi-turn message history sent with each API call)
3. Per-problem conversation storage in IndexedDB
4. Conversation history view with browse and delete
5. Hint/solution output from wrong submission dialog written into the current conversation

### New Components

| Component | File | Status | Role |
|-----------|------|--------|------|
| Chat side panel UI | `content-chat.js` (new content script) | **NEW** | Persistent chat button + side panel Shadow DOM, manages chat state in-tab |
| `conversations` IDB store | `background.js` | **NEW** | Persist messages per problem |
| Chat message handlers | `background.js` | **MODIFIED** | New message types for chat CRUD + AI |
| Manifest | `manifest.json` | **MODIFIED** | Add `content-chat.js` to content scripts |

### Why a Separate content-chat.js (not extending content-toast.js)

`content-toast.js` is purpose-built for transient dialogs — one dialog at a time, lifecycle tied to a submission event. The chat panel is persistent: it lives for the entire tab session, survives submission events, and has its own independent lifecycle. Merging them would entangle two unrelated UI lifecycles.

**Rule of thumb:** Transient dialogs = `content-toast.js`. Persistent panel = `content-chat.js`.

---

## System Overview (v1.2)

```
┌──────────────────────────────────────────────────────────────────────┐
│                          CHROME BROWSER                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐     │
│  │                   LEETCODE.COM TAB                          │     │
│  │                                                             │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │  content-main.js (MAIN, document_start)              │   │     │
│  │  │  XHR/fetch interceptor → window.postMessage          │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  │                 |  window.postMessage                        │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │  content-isolated.js (ISOLATED, document_start)      │   │     │
│  │  │  Relay: window msg → chrome.runtime.sendMessage      │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  │                 |  SUBMISSION_CAPTURED                       │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │  content-toast.js (ISOLATED, document_end) [MODIFIED]│   │     │
│  │  │  - showRatingDialog                                   │   │     │
│  │  │  - showWrongSubmissionDialog                          │   │     │
│  │  │    └── on AI response → APPEND_TO_CHAT [NEW]         │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  │                                                             │     │
│  │  ┌──────────────────────────────────────────────────────┐   │     │
│  │  │  content-chat.js (ISOLATED, document_end) [NEW]      │   │     │
│  │  │  - Persistent chat button (bottom-right)             │   │     │
│  │  │  - Shadow DOM chat side panel (slide in/out)         │   │     │
│  │  │  - Loads conversation from IDB on panel open         │   │     │
│  │  │  - Sends user messages → CHAT_SEND_MESSAGE           │   │     │
│  │  │  - Receives AI response → appends to UI              │   │     │
│  │  │  - Listens for CHAT_APPEND message from background   │   │     │
│  │  └──────────────────────────────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │               BACKGROUND SERVICE WORKER (background.js)      │    │
│  │                                                               │    │
│  │  Existing (unchanged):                                        │    │
│  │  - SUBMISSION_CAPTURED, RATE_REVIEW, GET_DUE_TODAY           │    │
│  │  - GET_STATS, GET_TODAY_SUBMISSIONS, GET_AI_FEEDBACK          │    │
│  │                                                               │    │
│  │  New handlers [NEW]:                                          │    │
│  │  - CHAT_SEND_MESSAGE                                          │    │
│  │    1. Load conversation for titleSlug from IDB                │    │
│  │    2. Append user message                                     │    │
│  │    3. Build messages array (full history)                     │    │
│  │    4. Call OpenRouter with messages array                     │    │
│  │    5. Append AI response to conversation                      │    │
│  │    6. Persist updated conversation to IDB                     │    │
│  │    7. sendResponse({ reply }) or { error }                    │    │
│  │  - CHAT_LOAD_CONVERSATION                                     │    │
│  │    Load and return conversation for titleSlug                 │    │
│  │  - CHAT_CLEAR_CONVERSATION                                    │    │
│  │    Delete conversation for titleSlug                          │    │
│  │  - CHAT_APPEND_MESSAGES [NEW, internal use]                  │    │
│  │    Write messages array into conversations store              │    │
│  │                                                               │    │
│  │  Modified [MODIFIED]:                                         │    │
│  │  - openDatabase() — version 3, adds conversations store      │    │
│  │  - GET_AI_FEEDBACK — after returning feedback, also write     │    │
│  │    the exchange into conversations store and notify tab       │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                         |  fetch()                                    │
│                         v                                            │
│              openrouter.ai/api/v1/chat/completions                   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                   POPUP (popup.js) [UNCHANGED]                │    │
│  │  Dashboard / Reviews / Settings                               │    │
│  │  (History browsing can live here or in popup — see below)     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │                       STORAGE LAYER                          │    │
│  │  chrome.storage.local: (unchanged)                           │    │
│  │                                                              │    │
│  │  IndexedDB (leetreminder, v3) [MODIFIED — version bump]:     │    │
│  │  - submissions (unchanged)                                   │    │
│  │  - cards (unchanged)                                         │    │
│  │  - reviewLogs (unchanged)                                    │    │
│  │  - conversations [NEW]                                       │    │
│  │    keyPath: titleSlug                                        │    │
│  │    fields: titleSlug, messages[], updatedAt                  │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## New vs Modified Components

| Component | Status | What Changes |
|-----------|--------|--------------|
| `content-chat.js` | **NEW** | Persistent chat button + side panel. Full component from scratch. |
| `background.js` | **MODIFIED** | `openDatabase()` bumped to v3; add `conversations` store creation in `onupgradeneeded`; add `CHAT_SEND_MESSAGE`, `CHAT_LOAD_CONVERSATION`, `CHAT_CLEAR_CONVERSATION` handlers; modify `GET_AI_FEEDBACK` to write hint/solution into the conversation |
| `manifest.json` | **MODIFIED** | Add `content-chat.js` entry to `content_scripts` array |
| `content-toast.js` | **MODIFIED** | After receiving AI feedback in `showWrongSubmissionDialog`, also send `APPEND_TO_CHAT` message (or background handles it automatically — see pattern below) |
| `popup.js` / `popup.html` | **MODIFIED** | Add conversation history tab or section to browse/delete saved conversations |
| `content-main.js` | Unchanged | Network interception unaffected |
| `content-isolated.js` | Unchanged | Relay logic unaffected |

---

## Storage Schema Changes

### IndexedDB Version Bump: v2 → v3

```javascript
// In openDatabase() — onupgradeneeded additions
if (oldVersion < 3) {
  // conversations store — one record per problem
  const convStore = database.createObjectStore('conversations', {
    keyPath: 'titleSlug'
  });
  convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
}
```

**conversations record shape:**
```javascript
{
  titleSlug: 'two-sum',           // keyPath — one record per problem
  messages: [                      // ordered array, append-only at runtime
    { role: 'user',      content: '...', timestamp: 1710000000000 },
    { role: 'assistant', content: '...', timestamp: 1710000001234 }
  ],
  updatedAt: 1710000001234         // ms timestamp for sorting in history view
}
```

**Why keyPath: titleSlug (one conversation per problem, not per session):**

The requirement says "new chat starts fresh each review session" — but also "per-problem conversation storage with history browsing." These are slightly in tension. The simplest reading: one active conversation per problem, cleared when user starts a new session. History browsing shows past conversations — which means either appending sessions end-to-end with session markers, or storing multiple records per problem.

**Recommendation:** One record per problem, append-only. Add a session separator message (type: `system`) when starting a new session. This avoids a more complex multi-record schema while still allowing history browsing.

```javascript
// Session separator entry in messages array
{ role: 'system', content: '--- New session ---', timestamp: ... }
```

If the user explicitly wants distinct session history (like separate conversation threads), a `conversationSessions` store with `{ id, titleSlug, startedAt, messages[] }` is the right schema — but adds complexity. Defer to requirements clarification.

---

## New Message Types

| Type | Direction | Payload | Response |
|------|-----------|---------|----------|
| `CHAT_SEND_MESSAGE` | content-chat → background | `{ titleSlug, userMessage }` | `{ reply: string }` or `{ error: string }` |
| `CHAT_LOAD_CONVERSATION` | content-chat → background | `{ titleSlug }` | `{ messages: [] }` or `{ error }` |
| `CHAT_CLEAR_CONVERSATION` | content-chat → background | `{ titleSlug }` | `{ ok: true }` or `{ error }` |
| `CHAT_APPEND` | background → content-chat | `{ messages }` | (fire-and-forget, no response) |

`CHAT_APPEND` is sent from background to the chat panel when `GET_AI_FEEDBACK` completes — it injects the hint/solution exchange into the open panel's message list without requiring the user to reopen the panel.

---

## Data Flow

### Chat Send Flow

```
User types message and presses Send in chat panel
    |
    v
content-chat.js
  - Appends user message to local UI immediately (optimistic)
  - Sets loading indicator
  | chrome.runtime.sendMessage({ type: 'CHAT_SEND_MESSAGE',
  |   payload: { titleSlug, userMessage } })
    v
background.js CHAT_SEND_MESSAGE handler (return true — async):
  1. Load conversation from IDB (conversations store, key: titleSlug)
  2. Append { role: 'user', content: userMessage, timestamp }
  3. Build messages array from conversation.messages
     (include last N messages to stay within token budget)
  4. Call callOpenRouter(apiKey, model, messages)
     → POST openrouter.ai with full messages array
  5. Append { role: 'assistant', content: reply, timestamp }
  6. IDB put() — upsert updated conversation
  7. sendResponse({ reply })
    |
    v (sendResponse callback in content-chat.js)
content-chat.js
  - Replace loading indicator with assistant message in UI
```

### Wrong Submission → Chat Integration Flow

```
User clicks Hint in wrong submission dialog
    |
    v (existing flow)
background.js GET_AI_FEEDBACK handler
  1. Loads submission, calls OpenRouter
  2. sendResponse({ feedback }) → back to content-toast.js dialog
  3. [NEW] After sendResponse:
     - Build messages array for this exchange:
       [{ role: 'user', content: <hint prompt> },
        { role: 'assistant', content: feedback }]
     - Upsert into conversations store (titleSlug)
     - chrome.tabs.sendMessage(tabId, { type: 'CHAT_APPEND', messages })
    |
    v
content-chat.js (if panel is open, receives CHAT_APPEND)
  - Appends the hint/response exchange to the visible message list
  (If panel is closed, the messages are in IDB and will appear on next open)
```

### Load Conversation Flow (Panel Open)

```
User clicks chat button on LeetCode problem page
    |
    v
content-chat.js
  - Parse titleSlug from window.location.pathname
  - chrome.runtime.sendMessage({ type: 'CHAT_LOAD_CONVERSATION',
      payload: { titleSlug } })
    |
    v
background.js CHAT_LOAD_CONVERSATION:
  - IDB get(titleSlug) from conversations store
  - sendResponse({ messages: record?.messages || [] })
    |
    v
content-chat.js
  - Render messages array in panel UI
  - Show empty state if messages is []
```

---

## Architectural Patterns

### Pattern 1: Optimistic UI Append

**What:** Append the user message to the panel UI immediately before the background round-trip completes, then append the assistant message when the response arrives.

**When to use:** Any chat UI with a noticeable API latency (1-3 seconds).

**Trade-offs:** If the API call fails, remove the optimistic message and show an error. Simpler than disabling input; feels more responsive.

**Example:**
```javascript
// content-chat.js
function sendMessage(userText) {
  appendMessage({ role: 'user', content: userText }); // immediate
  setLoading(true);
  chrome.runtime.sendMessage(
    { type: 'CHAT_SEND_MESSAGE', payload: { titleSlug, userMessage: userText } },
    function (response) {
      setLoading(false);
      if (response?.reply) {
        appendMessage({ role: 'assistant', content: response.reply });
      } else {
        removeLastMessage(); // undo optimistic append
        showError(response?.error || 'Failed');
      }
    }
  );
}
```

### Pattern 2: Conversation History in Background, Not Content Script

**What:** The background service worker owns all conversation read/write. The content script only holds in-memory state for the currently rendered panel session.

**When to use:** Always — content scripts can be recreated on navigation or extension reload, losing any state. The background's IDB reference persists.

**Trade-offs:** Every send/load is an async round-trip through `chrome.runtime.sendMessage`. Acceptable — chat messages are human-speed, not high-frequency.

### Pattern 3: Token Budget Truncation for History

**What:** When building the messages array for an OpenRouter call, limit history to the last N message pairs (e.g., last 10 messages) to stay within model context limits without tracking token counts.

**When to use:** Any multi-turn chat that could accumulate many messages over time.

**Trade-offs:** Older context is lost. For LeetCode problem discussions this is acceptable — conversations rarely need >10 exchanges to resolve a question.

```javascript
// background.js — in CHAT_SEND_MESSAGE handler
const MAX_HISTORY = 10;
const recentMessages = conversation.messages
  .filter(m => m.role !== 'system')  // exclude session separators
  .slice(-MAX_HISTORY);
```

### Pattern 4: Fire-and-Forget CHAT_APPEND from Background

**What:** After `GET_AI_FEEDBACK` completes, background writes to IDB then sends `CHAT_APPEND` to the tab. No response expected or awaited.

**When to use:** Background pushing state to a content script — the content script may not be listening (panel closed), and that is fine.

**Trade-offs:** The `chrome.tabs.sendMessage` call may throw if the panel is not listening. Wrap in try/catch and ignore the error (same pattern as `notifyTab`).

---

## Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| `content-main.js` | Network interception (unchanged) | `content-isolated.js` via window.postMessage |
| `content-isolated.js` | Relay postMessage → chrome.runtime (unchanged) | `background.js` via sendMessage |
| `content-toast.js` | Transient dialogs: rating, wrong submission with AI (minor mod) | `background.js` via sendMessage |
| `content-chat.js` | Persistent chat button + side panel, renders conversation | `background.js` via sendMessage (both directions) |
| `background.js` | All data, AI calls, message routing — chat CRUD added | content-toast, content-chat via tabs.sendMessage; OpenRouter; IndexedDB |
| `popup.js` | Dashboard, Settings, conversation history view (new tab/section) | `background.js` via sendMessage |

---

## File Structure After v1.2

```
extension/
├── manifest.json          # + content-chat.js entry
├── background.js          # + IDB v3 migration, chat handlers, GET_AI_FEEDBACK mod
├── content-main.js        # unchanged
├── content-isolated.js    # unchanged
├── content-toast.js       # minor mod: fire CHAT_APPEND after AI feedback
├── content-chat.js        # NEW — persistent chat button + side panel
├── popup.html             # + conversation history section
├── popup.js               # + load/delete conversations
├── popup.css              # minor additions for history UI
├── lib/
│   └── ts-fsrs.umd.js     # unchanged
└── icons/
```

---

## Build Order

Dependencies flow from data layer up to UI:

```
Phase 1: Storage — IDB v3 migration
  - background.js: openDatabase() version bump to 3
  - Add conversations store + updatedAt index in onupgradeneeded
  - Add CRUD helpers: getConversation(), putConversation(), clearConversation()
  RISK: version bump must be backward-compatible — existing v2 data must survive
  TEST: existing submissions, cards, reviewLogs untouched after migration

        |
        v

Phase 2: Chat Message Handler — background.js
  - CHAT_SEND_MESSAGE handler
    (builds messages array, calls callOpenRouter, persists, returns reply)
  - CHAT_LOAD_CONVERSATION handler
  - CHAT_CLEAR_CONVERSATION handler
  - Modify GET_AI_FEEDBACK to write exchange into conversations + send CHAT_APPEND
  TEST: unit-style: send message, verify IDB record, verify OpenRouter called with
        correct messages array; verify existing GET_AI_FEEDBACK still returns feedback

        |
        v

Phase 3: Chat Side Panel UI — content-chat.js (new file)
  - Persistent chat button (fixed position, bottom-right, above wrong-submission panel z)
  - Shadow DOM side panel that slides in from the right
  - Panel open: send CHAT_LOAD_CONVERSATION, render messages
  - Input + send: fire CHAT_SEND_MESSAGE, optimistic append
  - CHAT_APPEND listener: append injected messages when panel is open
  - Empty state, loading state, error state
  - manifest.json: add content-chat.js to content_scripts
  TEST: button visible on leetcode.com/problems/*, panel opens/closes, messages render,
        send message round-trip works, CHAT_APPEND injects correctly

        |
        v

Phase 4: Wrong Submission → Chat Integration
  - content-toast.js: no change needed if background handles CHAT_APPEND automatically
    (background fires CHAT_APPEND after GET_AI_FEEDBACK — Phase 2 handles this)
  TEST: submit wrong answer → get hint → open chat panel → verify exchange appears

        |
        v

Phase 5: Conversation History in Popup
  - popup.html/js: new "Chats" section or tab
  - Load all conversations (index on updatedAt, sorted descending)
  - Show titleSlug + last message preview + delete button
  - Delete: CHAT_CLEAR_CONVERSATION
  TEST: history shows after sending messages, delete removes from IDB + UI
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `openrouter.ai/api/v1/chat/completions` | `fetch()` from `background.js` | Existing pattern — now passes `messages` array (multi-turn) instead of single user message |

### Internal Boundaries (new/modified for v1.2)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `content-chat.js` → `background.js` | `chrome.runtime.sendMessage` for CHAT_SEND_MESSAGE, CHAT_LOAD_CONVERSATION, CHAT_CLEAR_CONVERSATION | Same pattern as existing sendMessage calls; `return true` for async responses |
| `background.js` → `content-chat.js` | `chrome.tabs.sendMessage(tabId, { type: 'CHAT_APPEND', ... })` | Fire-and-forget; tab may not be listening; wrap in try/catch |
| `content-toast.js` → chat | Indirect — background handles CHAT_APPEND after GET_AI_FEEDBACK | content-toast.js does NOT need to know about content-chat.js |
| `background.js` → `conversations` IDB store | `getConversation(db, titleSlug)` / `putConversation(db, record)` | New helpers following same promise-wrapping pattern as existing IDB functions |

---

## Anti-Patterns

### Anti-Pattern 1: Storing Conversation State in the Content Script

**What people do:** Keep the messages array in a module-level variable in `content-chat.js` and only persist to IDB when the panel closes.

**Why it's wrong:** Content scripts are destroyed and recreated on navigation, extension reload, and tab refresh. Any in-memory state is silently lost. The user switches problems, comes back, and the conversation is gone.

**Do this instead:** Persist to IDB on every message via background. The content script only holds the current render state (what's displayed right now).

### Anti-Pattern 2: Sending Full Conversation History on Every Turn Without Truncation

**What people do:** Pass the entire `messages` array to the OpenRouter API on every turn, growing unboundedly.

**Why it's wrong:** Context window limits vary by model (8k–128k tokens). A long conversation on a hard problem can silently fail with a context overflow error, or run up large token costs.

**Do this instead:** Slice to the last N message pairs before building the API request body. Store the full history in IDB regardless — truncation is only for the API payload, not for the stored record.

### Anti-Pattern 3: Having content-chat.js Directly Communicate With content-toast.js

**What people do:** Use window.postMessage between content-chat.js and content-toast.js to coordinate the "inject hint into chat" flow.

**Why it's wrong:** window.postMessage is the MAIN↔ISOLATED bridge, not an ISOLATED↔ISOLATED channel. Two ISOLATED content scripts cannot postMessage each other via window without polluting the page's message bus. More importantly, it creates a tight coupling between two scripts with independent lifecycles.

**Do this instead:** Route through background. `GET_AI_FEEDBACK` handler fires `CHAT_APPEND` to the tab after completing. `content-chat.js` listens for it. The two content scripts never communicate directly.

### Anti-Pattern 4: Opening a New Extension Popup/Tab for Chat History

**What people do:** Create a separate `history.html` page for conversation history.

**Why it's wrong:** The popup (`popup.html`) already has a tabbed UI (Dashboard, Reviews, Settings). Adding conversation history as another tab in the existing popup is zero additional navigation overhead and reuses the existing popup infrastructure.

**Do this instead:** Add a "Chats" section to `popup.js` / `popup.html` — another tab in the existing interface.

### Anti-Pattern 5: Bumping IDB Version Without Handling onblocked

**What people do:** Increment the IDB version without handling the `onblocked` event, causing silent failures when the user has the extension open in multiple tabs.

**Why it's wrong:** If another tab has the DB open at v2, the v3 upgrade is blocked. The `onupgradeneeded` handler never fires. The service worker fails to open the DB.

**Do this instead:** The existing `openDatabase()` already has `request.onblocked = () => {}` (silently wait). Keep this. The `db.onversionchange = () => db.close()` on the module-level `db` reference handles the close-on-upgrade path.

---

## Scaling Considerations

This is a local-only Chrome extension — "scaling" means handling large amounts of local data.

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 10s of problems | No concern — IDB handles this trivially |
| 100s of problems with long histories | Truncate history on API calls (Pattern 3); add pagination to history view in popup |
| 1000+ problems, years of use | Consider IDB cursor-based pagination for history view; consider capping max messages per conversation (e.g. 200 messages) with a "start new chat" prompt |

---

## Sources

- Direct reading of `extension/background.js`, `content-toast.js`, `content-isolated.js`, `content-main.js`, `manifest.json` — HIGHEST confidence
- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — HIGH confidence
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — HIGH confidence
- [IndexedDB API — IDBDatabase.onversionchange](https://developer.mozilla.org/en-US/docs/Web/API/IDBDatabase/versionchange_event) — HIGH confidence
- [OpenRouter API — Chat Completions](https://openrouter.ai/docs/api-reference/chat-completion) — HIGH confidence

---

## Prior Architecture (v1.0/v1.1)

The original v1.0 and v1.1 architecture documents are preserved in git history. Key decisions from those milestones that remain in force:

- API calls in service worker only (CORS + key security)
- Non-streaming responses (no Port complexity)
- Shadow DOM for all extension UI on LeetCode page
- `return true` in `onMessage.addListener` for async handlers
- `store.add()` with ConstraintError suppression for dedup
- UMD bundle for ts-fsrs (no ES modules in service workers)

---

*Architecture research for: Chrome MV3 Extension — v1.2 AI Chat Integration*
*Updated: 2026-03-15*
