# Project Research Summary

**Project:** LeetReminder v1.2 — Interactive AI Chat
**Domain:** Chrome Extension MV3 — Persistent AI chat panel with per-problem conversation history
**Researched:** 2026-03-15
**Confidence:** HIGH

## Executive Summary

LeetReminder v1.2 adds an interactive AI chat panel to an already-shipped Chrome MV3 extension. The core challenge is not building a chat application from scratch — it is integrating a persistent, stateful UI component into a constrained environment (MV3 service workers, ISOLATED content scripts, an existing IndexedDB schema, and a React SPA host page) without introducing new libraries or permissions. Research confirms the entire feature can be delivered by extending patterns already proven in v1.1: Shadow DOM content script panels, the existing `callOpenRouter` fetch path, and `onupgradeneeded` IndexedDB migrations. Every new capability maps directly to an established pattern in the codebase.

The recommended approach is additive rather than architectural: a new `content-chat.js` content script for the persistent chat button and panel, an IndexedDB version bump from v2 to v3 adding a `conversations` store, new message handlers in `background.js` for chat CRUD, and a minor modification to `GET_AI_FEEDBACK` to write hint/solution exchanges into the conversation record. No new npm packages, no new permissions, no build step changes. The OpenRouter API already accepts a `messages[]` array for multi-turn context — extending the existing single-turn call to multi-turn is a surgical change.

The top risks are MV3-specific: service worker termination during an in-flight API call, unbounded conversation history overflowing model context windows, IndexedDB schema migration blocking when multiple tabs are open, and the chat button disappearing on LeetCode's SPA navigation. All four have well-documented prevention strategies that must be implemented from the first working version — they cannot be bolted on later without rework.

---

## Key Findings

### Recommended Stack

No new libraries are required. v1.2 builds entirely on primitives already in the codebase. The chat panel UI follows the exact same Shadow DOM injection pattern as the existing wrong-submission panel in `content-toast.js`. Multi-turn AI uses the existing OpenRouter `fetch` call extended to accept a `messages[]` array. Conversation persistence uses the existing `onupgradeneeded` migration pattern to add a new `conversations` store at IndexedDB version 3.

**Core technologies:**
- Content-script Shadow DOM panel (`content-chat.js`, new file) — persistent chat button and slide-in panel — same proven pattern as wrong-submission panel; avoids `chrome.sidePanel` API which cannot open programmatically from content scripts as of late 2024
- IndexedDB `conversations` store (v3 migration) — one document per problem (`titleSlug` keyPath), embedded `messages[]` array — simpler than a separate messages store at chat conversation scale (5–30 messages); single `onupgradeneeded` branch identical to the v1→v2 migration
- OpenRouter `/chat/completions` with `messages[]` array — existing endpoint, existing `callOpenRouter` function extended to pass accumulated history; no streaming required (1–3s responses are acceptable for non-streaming)
- `chrome.runtime.sendMessage` — existing messaging infrastructure; background service worker owns all DB access and AI calls; content scripts never touch IndexedDB directly
- `chrome.storage.local.get('_ping')` keepalive at 20s interval — already proven in v1.1; must be carried into the new `CHAT_SEND_MESSAGE` handler

### Expected Features

**Must have (table stakes) — v1.2 launch:**
- Persistent chat trigger button on all `leetcode.com/problems/*` pages
- Toggle open/close for the chat panel (default closed)
- Message input (Enter = send, Shift+Enter = newline) with send button
- User message and AI response rendering with markdown (reuse v1.1 renderer)
- Loading indicator and inline error states (missing key, API failure)
- Per-session conversation continuity via `messages[]` array passed to OpenRouter
- New chat / clear conversation button
- IndexedDB `conversations` store with auto-save on every message pair
- DB schema v3 migration

**Should have (competitive differentiators) — v1.2.x post-validation:**
- Per-problem conversation history persisted across sessions (survives page reload/browser restart)
- Conversation history browser in popup (list by problem, delete individual conversations)
- v1.1 hint/solution output seeded as first chat turn for continuity
- Soft message limit per conversation (20 messages) with visible trim notice

**Defer (v1.3+):**
- Streaming responses via `chrome.runtime.connect` long-lived ports
- Cross-problem pattern insights
- Conversation export

**Confirmed anti-features (do not build):**
- Auto-open chat on wrong submission — conflicts with wrong-submission panel, interrupts focus at the wrong moment
- Device sync — requires backend infrastructure, out of scope
- LeetCode DOM scraping for problem context — fragile, breaks silently; use `titleSlug` + language instead

### Architecture Approach

The architecture follows the service worker hub pattern established in v1.0: `background.js` owns all data (IndexedDB) and all AI calls (OpenRouter), while content scripts own only rendering state. `content-chat.js` is a new ISOLATED world content script that manages the persistent chat button and Shadow DOM panel. It communicates exclusively with `background.js` via `chrome.runtime.sendMessage`. The background pushes hint/solution exchanges into the open chat panel via `chrome.tabs.sendMessage` (fire-and-forget `CHAT_APPEND`). `content-toast.js` does not need to know about `content-chat.js` — integration routes through the background, keeping the two content scripts fully decoupled.

**Major components:**
1. `content-chat.js` (NEW) — persistent chat button, Shadow DOM side panel, renders conversation, sends/receives messages via background
2. `background.js` (MODIFIED) — IDB v3 migration, `CHAT_SEND_MESSAGE` / `CHAT_LOAD_CONVERSATION` / `CHAT_CLEAR_CONVERSATION` handlers, modified `GET_AI_FEEDBACK` to write exchange to `conversations` store and fire `CHAT_APPEND`
3. `conversations` IndexedDB store (NEW) — keyPath `titleSlug`, embedded `messages[]` array, `updatedAt` index for history sort
4. `popup.js` / `popup.html` (MODIFIED) — new "Chats" tab for conversation history browse and delete

### Critical Pitfalls

1. **Service worker killed mid-conversation turn** — wrap every `CHAT_SEND_MESSAGE` handler in a `setInterval(() => chrome.storage.local.get('_ping'), 20_000)` keepalive; write user message and AI reply to IndexedDB in a single transaction only after the response succeeds (no phantom pending messages if the worker dies mid-call)

2. **Unbounded conversation history overflows model context window** — cap the messages array sent to OpenRouter to the last 10 messages before every API call; store the full history in IDB regardless; this must be in place from the first working implementation, not added as a patch

3. **IndexedDB v2→v3 migration blocked by open tabs** — preserve the existing `db.onversionchange = () => db.close()` pattern; ensure any new code that opens the DB sets this handler; test with two LeetCode tabs open during extension reload

4. **Chat button disappears on LeetCode SPA navigation** — add `popstate` listener with re-mount logic and a double-injection guard; use 300ms delay or MutationObserver on the problem title element for reliable re-mount timing

5. **`sendMessage` fails if service worker not yet active** — wrap all `sendMessage` calls from `content-chat.js` in the existing retry helper pattern (600ms delay, one retry attempt); the service worker wakes up quickly once poked

---

## Implications for Roadmap

Based on research, the architecture document's 5-phase build order is the correct sequence. Dependencies flow strictly from data layer up to UI — no phase can be started until its prerequisite is complete.

### Phase 1: Storage and Service Worker Foundation

**Rationale:** All chat features depend on the `conversations` IndexedDB store existing and the background chat handlers being present. This must ship before any UI work. Multiple critical pitfalls (service worker termination, token overflow, DB migration blocking, schema version mismatch) must be addressed here before UI complexity is added.

**Delivers:** IDB v3 migration with `conversations` store; `CHAT_SEND_MESSAGE`, `CHAT_LOAD_CONVERSATION`, `CHAT_CLEAR_CONVERSATION` handlers in `background.js`; `callOpenRouter` refactored to accept a `messages[]` array; modified `GET_AI_FEEDBACK` that writes hint exchange to `conversations` and fires `CHAT_APPEND`

**Addresses:** DB schema v3 migration (P1), multi-turn conversation context (P1)

**Avoids:** Service worker killed mid-turn (keepalive in handler), token overflow (cap at last 10 messages before API call), DB migration blocking (preserve `onversionchange` handler), phantom pending messages (single-transaction write on success only), schema version mismatch (centralize `DB_VERSION = 3` constant; background owns all DB access)

### Phase 2: Chat Panel UI

**Rationale:** UI depends on the backend handlers from Phase 1. The Shadow DOM panel, SPA re-mount logic, theme detection, and `sendMessage` retry wrapper must all be in place before integration testing is possible.

**Delivers:** `content-chat.js` — persistent chat button (fixed position), Shadow DOM slide-in panel, message thread rendering with markdown, loading/error states, `CHAT_APPEND` listener; `manifest.json` updated with new content script entry

**Uses:** Shadow DOM pattern from `content-toast.js`, markdown renderer from v1.1 (reuse, do not duplicate), `sendMessage` retry pattern from `content-isolated.js`

**Avoids:** SPA navigation button loss (popstate listener + re-mount guard), service worker wake-up failure (retry wrapper), dark/light theme breakage (detect LeetCode `dark` class on `<html>` and pass as `data-theme` attribute to Shadow DOM host)

### Phase 3: Wrong Submission Integration

**Rationale:** Soft dependency — the chat panel works standalone without this. But seeding the first chat turn from the v1.1 hint output is a key differentiator and is architecturally trivial once Phase 1 is complete (the background already fires `CHAT_APPEND` after `GET_AI_FEEDBACK`). Verifying the end-to-end flow is a critical integration test.

**Delivers:** Verified integration path — wrong submission hint appears as first message in chat panel when panel is opened after getting a hint; `content-toast.js` requires no changes (background handles it automatically)

**Avoids:** Schema mismatch (background-only DB writes established in Phase 1 ensure no content script opens IndexedDB directly)

### Phase 4: Conversation History in Popup

**Rationale:** History browsing is a differentiating P2 feature. It reuses the `conversations` store from Phase 1 and adds only popup UI. Must be designed with lazy loading from the start to avoid the history-view performance trap at 50+ problems.

**Delivers:** New "Chats" tab in `popup.html` — list of conversations sorted by `updatedAt` descending, per-problem delete with confirmation dialog, lazy message loading (load problem list first; load messages only when a conversation is selected)

**Avoids:** History view performance degradation (metadata-first query; never load all messages on popup open)

### Phase 5: Polish and Limits

**Rationale:** UX completeness before any external distribution. Addresses UX pitfalls that won't be caught in functional testing but will generate immediate user complaints.

**Delivers:** Soft message limit (20 messages per conversation) with trim notice; session separator markers in conversation thread so users understand what AI does and does not remember; panel/wrong-submission mutual exclusion (opening one closes the other); scroll-to-bottom behavior on new message append; delete confirmation dialog

**Avoids:** All remaining UX pitfalls — confused session semantics, overlapping panels, accidental conversation delete

### Phase Ordering Rationale

- Storage must come before UI: the `conversations` store must exist before any content script tries to load or save conversations
- Service worker handlers must come before content script UI: `CHAT_SEND_MESSAGE` must work end-to-end before the panel sends its first real message
- Wrong submission integration comes after the chat panel is working: it is the integration of two complete subsystems, not a foundational dependency
- History view comes after the core chat loop is validated: it needs real conversation data in IDB to test meaningfully
- Polish phase last: UX details that do not affect core functionality but must be in place before store submission

### Research Flags

Phases with standard patterns (no research-phase needed):
- **Phase 1:** IndexedDB migration and OpenRouter messages-array extension are well-documented patterns already used in this codebase; all new handlers follow the existing `background.js` message handler structure
- **Phase 2:** Shadow DOM injection follows the exact same pattern as `content-toast.js`; SPA re-mount pattern is documented with official Chrome content script lifecycle docs
- **Phase 3:** No new patterns — fully handled by the `GET_AI_FEEDBACK` modification designed in Phase 1
- **Phase 4:** Standard popup tab addition using existing popup infrastructure; lazy loading is a standard IndexedDB cursor pattern
- **Phase 5:** Pure UX polish; no novel patterns or external integrations

No phases require `/gsd:research-phase` during planning. All required patterns are either already proven in the codebase or verified against official Chrome/MDN documentation.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All claims verified against official Chrome docs, MDN, and OpenRouter API docs; no new libraries required; `chrome.sidePanel` limitation confirmed by official docs and multiple community reports |
| Features | HIGH | UX patterns drawn from production AI tools (ChatGPT, Cursor, Gemini Workspace side panel); Chrome extension constraints verified against official documentation; existing codebase constraints confirmed by direct code reading |
| Architecture | HIGH | Based on direct reading of the existing codebase; all new components follow already-established patterns; component boundaries and message types fully specified |
| Pitfalls | HIGH | Critical pitfalls verified against official Chrome documentation and real Chromium issue threads; MV3 service worker termination behavior confirmed in official blog posts |

**Overall confidence:** HIGH

### Gaps to Address

- **History view location (popup "Chats" tab vs. in-panel slide-in pane):** Both approaches are architecturally sound. Research recommends the popup tab (reuses existing popup infrastructure, no added complexity in the content script). Final decision deferred to requirements — does not affect the data storage design.

- **Session semantics ("new chat" behavior):** Architecture recommends a `role: 'system'` session separator message inserted into the `messages[]` array rather than separate IndexedDB records per session. This means "start fresh" clears the in-memory thread but appends a divider to the persisted record. The exact UX (what the divider looks like, whether AI context resets) needs a product decision before implementation.

- **Soft message limit (20 per conversation):** Research recommends this as a storage guard, separate from the token cap (last 10 messages to OpenRouter). The token cap is a Phase 1 must-have. The storage limit is listed as a v1.2.x item. Clarify during task planning whether storage limit ships with v1.2 core or as a follow-on.

- **LeetCode theme detection reliability:** `document.documentElement.classList.contains('dark')` is the recommended approach, but LeetCode's DOM is closed-source. Flag for smoke-testing on both themes before every release; add a fallback to `prefers-color-scheme` if the class is absent.

---

## Sources

### Primary (HIGH confidence)
- [Chrome sidePanel API reference](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) — confirmed `sidePanel.open()` requires direct user gesture; cannot call from content script message handlers after late 2024
- [Longer extension service worker lifetimes — Chrome blog](https://developer.chrome.com/blog/longer-esw-lifetimes) — confirmed `chrome.storage.local.get()` resets idle timer (Chrome 110+)
- [OpenRouter Chat Completions API](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request) — confirmed OpenAI-compatible `messages[]` array format with `role`/`content` fields
- [MDN — Using IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API/Using_IndexedDB) — `onupgradeneeded` migration pattern, `oldVersion` comparison, `onblocked` behavior
- [Chrome extensions — Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — ISOLATED world lifecycle, SPA navigation caveat, `document_end` injection timing
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — 30s idle termination confirmed; Chrome API call resets timer
- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — `return true` for async handlers, `lastError` handling, `chrome.tabs.sendMessage` fire-and-forget pattern
- [IDBOpenDBRequest: upgradeneeded event — MDN](https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/upgradeneeded_event) — schema migration mechanics, `onblocked` behavior
- LeetReminder codebase — `background.js`, `content-toast.js`, `manifest.json`, `content-isolated.js` — direct code inspection for existing patterns and constraints

### Secondary (MEDIUM confidence)
- [Chromium Extensions Group — `sidePanel.open()` breakage](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/WRGFOAHxoaY) — multiple corroborating community reports of content-script sidePanel.open failure since late 2024
- [MV3 ServiceWorker reliability — Chromium Extensions Group](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/jpFZj1p7mJc) — real-world service worker termination failure reports
- [Extension.Ninja — Message Port Closed Before Response](https://www.extension.ninja/blog/post/solved-message-port-closed-before-response-was-received/) — `lastError` handling pattern
- [Gemini Workspace Conversation History in Side Panel](https://workspaceupdates.googleblog.com/2026/02/gemini-conversation-history-is-coming-to-side-panel-in-google-workspace.html) — production side-panel chat UX pattern reference
- [PatternFly Chatbot Conversation History](https://www.patternfly.org/patternfly-ai/chatbot/chatbot-conversation-history/) — history drawer UX: search, new chat, grouped-by-date patterns
- [AI Chat UI Best Practices — DEV Community](https://dev.to/greedy_reader/ai-chat-ui-best-practices-designing-better-llm-interfaces-18jj) — message rendering, loading states, error states
- [Isolating Styles in Chrome Extensions with Shadow DOM — Sweets.chat](https://sweets.chat/blog/article/isolating-styles-in-chrome-extensions-with-shadow-dom) — `all: initial` pattern, event propagation across shadow boundary

---

*Research completed: 2026-03-15*
*Ready for roadmap: yes*
