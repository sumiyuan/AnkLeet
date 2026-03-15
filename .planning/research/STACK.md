# Stack Research

**Domain:** Chrome Extension MV3 — Interactive AI chat with per-problem conversation storage (v1.2 addendum)
**Researched:** 2026-03-15
**Confidence:** HIGH (all critical claims verified against official Chrome docs, MDN, and OpenRouter API docs)

---

> **Scope note:** This file supersedes the v1.1 STACK.md for v1.2 decisions.
> The validated stack (plain MV3 JS, IndexedDB v2, ts-fsrs UMD, Shadow DOM, OpenRouter fetch) is
> already shipped. Only additions and changes needed for v1.2 AI Chat are documented here.

---

## Summary: Zero New Libraries

Like v1.1, v1.2 requires **no new npm packages or external library files.** Every new capability
is built on primitives already in the codebase:

- Chat panel UI → Shadow DOM content script (same pattern as wrong-submission panel)
- Conversation storage → IndexedDB schema migration to v3 (same `onupgradeneeded` pattern as v1→v2)
- Multi-turn AI → Pass accumulated messages array to existing OpenRouter `fetch` call
- Keepalive during API calls → `chrome.storage.local.get` ping already in use

---

## Recommended Stack — v1.2 Additions Only

### Chat Panel UI

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Content-script Shadow DOM panel | built-in | Persistent chat button + collapsible panel injected into LeetCode pages | Exact same pattern as the existing wrong-submission side panel in `content-toast.js`. No new permissions. Works without user-gesture restrictions. Stays in sync with LeetCode DOM navigation via `MutationObserver`. Panel survives page-within-SPA transitions because content script persists |
| `chrome.runtime.sendMessage` | built-in | Content script → service worker messaging for AI requests | Already wired. Each chat message sends `SEND_CHAT_MESSAGE` to service worker; response carries assistant reply |

**Why NOT `chrome.sidePanel` API:**

The `chrome.sidePanel` API requires the `sidePanel` permission and can only be opened programmatically
in response to a user gesture (a click handler). As of late 2024, `sidePanel.open()` no longer
works when called from inside a content script message handler or after an `await` — it must be
called synchronously in a direct browser action handler. This conflicts with the requirement to
automatically open the chat when a wrong submission occurs.

The content-script fixed panel avoids this entirely. The existing wrong-submission panel is already
a fixed-position panel injected via Shadow DOM — the chat panel is the same concept, extended to
persist across the page session rather than being dismissed after one use.

### Conversation Storage (IndexedDB v3)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| IndexedDB `conversations` store | v3 migration | One document per problem (`titleSlug` as keyPath), stores metadata and embedded messages array | Embedding messages directly into the conversation document is simpler than a separate messages store for this scale. A typical conversation is 5-30 messages. A separate store would require two-store transactions for every read/write with no performance benefit at this scale |
| `onupgradeneeded` migration | built-in | Add `conversations` store when upgrading from v2 | Identical pattern to v1→v2 migration already in `openDatabase()`. Increment version from 2 to 3, create store in `oldVersion < 3` branch |

**Schema for `conversations` store:**

```javascript
// keyPath: 'titleSlug' — one conversation document per problem
{
  titleSlug: 'two-sum',          // keyPath
  title: 'Two Sum',              // display name
  createdAt: 1741000000000,      // timestamp of first message
  updatedAt: 1741000000000,      // timestamp of last message
  messages: [                    // embedded array — append-only
    { role: 'user',      content: '...', timestamp: 1741000000000 },
    { role: 'assistant', content: '...', timestamp: 1741000001000 }
  ]
}
```

Indexes needed:
- `updatedAt` (non-unique) — for sorting conversation history list by recency

**Why one document per problem (not per session):**

The requirement is "per-problem conversation history" with "new chat starts fresh each review
session." The simplest implementation is a single document per `titleSlug` with an array of
messages. "Start fresh" means truncating the messages array when a new session begins — not
creating a new IndexedDB record. This avoids unbounded document growth and keeps queries simple
(get by `titleSlug`, no cursor iteration).

If multi-session history is needed later, the messages array can include a `sessionId` field per
message and the schema extends without a migration.

### Multi-Turn AI via OpenRouter

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| OpenRouter `/chat/completions` with `messages` array | existing | Send full conversation history with each request | OpenRouter follows the OpenAI Chat Completions format. Multi-turn requires passing accumulated `[{role, content}]` array. No streaming. Same `callOpenRouter` pattern already in `background.js` — extend to accept the messages array instead of building it from a single submission |

**Messages array construction:**

```javascript
// System prompt is a fixed string, not in the messages array for OpenRouter
// Build messages array from stored conversation:
const messages = conversation.messages.map(m => ({
  role: m.role,     // 'user' or 'assistant'
  content: m.content
}));
// Append the new user message
messages.push({ role: 'user', content: userInput });

// Pass to OpenRouter
body: JSON.stringify({
  model: model,
  messages: messages,
  // Optional: system prompt via top-level system field or as first message
})
```

OpenRouter accepts `system` as a top-level field (Anthropic-style) or as the first message
with `role: 'system'`. Using a top-level `system` field is cleaner and avoids including it
in the stored messages array.

### Manifest Changes Required

**Add `sidePanel` permission:** NOT required — using content-script panel approach.

**No new `host_permissions`:** OpenRouter is already in `host_permissions`. No new external origins.

**No new content script entries required for the chat panel.** The chat panel can live in
`content-toast.js` (the existing ISOLATED world content script that already handles the
wrong-submission panel) or in a new `content-chat.js` file registered alongside it. A separate
file is recommended for maintainability given the chat panel will be substantially larger code.

Add to `manifest.json` content_scripts:
```json
{
  "matches": ["https://leetcode.com/problems/*"],
  "js": ["content-chat.js"],
  "run_at": "document_end"
}
```

### Service Worker Keepalive

The existing keepalive pattern is correct and sufficient:

```javascript
const keepAlive = setInterval(() => chrome.storage.local.get('_ping'), 20_000);
```

**Verified:** Calling `chrome.storage.local.get()` resets the extension service worker idle timer.
Source: [Chrome developer blog — Longer extension service worker lifetimes](https://developer.chrome.com/blog/longer-esw-lifetimes).

The 5-minute single-request maximum still applies. For non-streaming AI responses from OpenRouter
models, responses complete in 1-5 seconds — well within the limit. The keepalive is redundant for
chat but harmless to keep for consistency with the existing GET_AI_FEEDBACK pattern.

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `chrome.sidePanel` API | Requires user-gesture to open programmatically; `sidePanel.open()` from content script no longer works; adds `sidePanel` permission; creates a separate chrome-extension:// page that requires content-script messaging to access LeetCode DOM | Content-script Shadow DOM fixed panel (already proven in this codebase) |
| Separate `chatMessages` IndexedDB store | Two-store transactions for every read/write; no performance benefit at chat scale (5-30 messages); more complex cursor queries for history browsing | Embedded messages array inside `conversations` document |
| React / Preact / any UI framework | No build step in this project; Shadow DOM with `document.createElement` is already the established pattern; framework bundle would require adding a bundler | Vanilla DOM construction in content script (existing pattern) |
| Streaming responses | Requires `chrome.runtime.connect()` ports instead of `sendMessage` for streaming from service worker to content script; significant complexity for marginal UX gain given 1-3s response times | Single `await response.json()` (existing pattern) |
| WebSocket keepalive | Chrome 116+ keeps service workers alive during active WebSocket connections, but this is overkill — `storage.local.get` ping is simpler and already proven | `chrome.storage.local.get('_ping')` interval |
| Session-per-conversation IDs | Premature complexity; per-problem single document with message truncation on "new chat" satisfies requirements with no added schema complexity | Single document per `titleSlug` with truncatable messages array |

---

## Integration Points

### IndexedDB Migration (v2 → v3)

Increment the `indexedDB.open('leetreminder', 3)` call and add a `oldVersion < 3` branch:

```javascript
if (oldVersion < 3) {
  const convStore = database.createObjectStore('conversations', {
    keyPath: 'titleSlug'
  });
  convStore.createIndex('updatedAt', 'updatedAt', { unique: false });
}
```

Users upgrading from v1.2 will have `onupgradeneeded` fire automatically. Existing `submissions`,
`cards`, and `reviewLogs` stores are untouched.

### Service Worker Message Handler

Add two new message types to the existing `chrome.runtime.onMessage.addListener` block:

| Message Type | Direction | Purpose |
|---|---|---|
| `SEND_CHAT_MESSAGE` | content → service worker | User sends a message; service worker fetches AI, saves to IndexedDB, returns reply |
| `GET_CONVERSATION` | content → service worker | Load conversation history for current problem on panel open |
| `DELETE_CONVERSATION` | content → service worker | Clear conversation for a problem (from history view) |
| `GET_ALL_CONVERSATIONS` | popup → service worker | List all conversations for history browsing in popup |

### Wrong Submission Integration

When `showWrongSubmissionDialog` generates a hint or full solution, it currently renders the
feedback inline. For v1.2, after receiving feedback from `GET_AI_FEEDBACK`, the content script
also dispatches a `SAVE_TO_CHAT` message (or the service worker handles this internally within
`GET_AI_FEEDBACK`). Service-worker-side integration is cleaner: the `GET_AI_FEEDBACK` handler
already has the submission data and the response — it can write to the `conversations` store
before `sendResponse`.

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Content-script Shadow DOM panel | `chrome.sidePanel` API | Use sidePanel only if the extension needs to stay visible while navigating across different domains, or if the panel needs access to all Chrome APIs without content script messaging. Not applicable here — the chat is per-problem and LeetCode-specific |
| Embedded messages array in conversation document | Separate `chatMessages` store with foreign key | Use separate store only if messages need to be queried individually (e.g., full-text search across all messages), or if conversations routinely exceed hundreds of messages. Neither applies here |
| Truncation-on-new-session | Multiple session records per problem | Use multiple sessions if users need to browse previous session history. Out of scope for v1.2; can be added by extending the schema without migration |
| Extend existing `content-toast.js` / add `content-chat.js` | Rewrite all content scripts into one file | Separate files maintain clear separation of concerns and keep each script reviewable in isolation |

---

## Version Compatibility

| Component | Current Version | v1.2 Change | Compatibility Notes |
|-----------|-----------------|-------------|---------------------|
| IndexedDB | v2 | Bump to v3 | `onupgradeneeded` handles migration; existing stores untouched |
| OpenRouter API | existing | Pass `messages` array | Same endpoint `/chat/completions`; already accepts multi-message arrays |
| `content-toast.js` | existing | No changes required | Wrong submission panel integrates via service worker, not content script |
| `background.js` | existing | Add 3-4 new message handlers | Additive; existing handlers unchanged |
| `manifest.json` | v1 | Add `content-chat.js` entry | No new permissions required |

---

## Sources

- [Chrome sidePanel API reference](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) — HIGH confidence (official docs); confirmed `sidePanel.open()` requires user gesture and cannot be called from content script message handlers
- [Longer extension service worker lifetimes — Chrome blog](https://developer.chrome.com/blog/longer-esw-lifetimes) — HIGH confidence (official Chrome blog); confirmed `chrome.storage.local.get()` resets idle timer; Chrome 110+ behavior
- [OpenRouter Chat Completions API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request) — HIGH confidence (official docs); confirmed OpenAI-compatible messages array format with `role`/`content` fields
- [MDN — Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) — HIGH confidence (official MDN); `onupgradeneeded` migration pattern, `oldVersion` comparison
- [Chrome extensions — Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — HIGH confidence (official docs); ISOLATED world, `chrome.runtime.sendMessage` from content scripts
- Community confirmation: `sidePanel.open()` from content script broken since late 2024 — [Chromium extensions group](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/WRGFOAHxoaY) — MEDIUM confidence (community reports, multiple corroborating posts)

---

*Stack research for: v1.2 AI Chat — interactive chat panel + conversation storage in existing MV3 extension*
*Researched: 2026-03-15*
