# Pitfalls Research

**Domain:** Chrome MV3 extension — adding interactive AI chat with per-problem conversation persistence (v1.2)
**Researched:** 2026-03-15
**Confidence:** HIGH for MV3/message passing/IndexedDB items (verified against official Chrome docs and real Chromium issue threads); MEDIUM for LeetCode SPA navigation items (closed-source frontend)

---

## Critical Pitfalls

### Pitfall 1: Service Worker Terminated Mid-Conversation Turn

**What goes wrong:**
The user sends a chat message, the service worker begins the OpenRouter API call, and Chrome terminates the worker before the response arrives. `sendResponse` is never called. The chat UI shows a permanent spinner with no way to recover. The conversation message has already been written to IndexedDB as "pending" — on the next load the UI shows a phantom unfinished message.

**Why it happens:**
Chrome terminates an MV3 service worker after 30 seconds of inactivity. A `fetch()` to OpenRouter that does not touch any Chrome extension API does not reset the idle timer. The existing v1.1 heartbeat pattern (polling `chrome.storage.local.get('_ping')` every 20s) already addresses this for single AI calls — but the chat feature sends multi-turn conversations and the heartbeat must be present in every new message handler that calls the AI.

**How to avoid:**
Carry the existing keepalive pattern into the new `SEND_CHAT_MESSAGE` handler without exception:

```js
const keepAlive = setInterval(() => chrome.storage.local.get('_ping'), 20_000);
try {
  const reply = await callOpenRouter(apiKey, model, messages);
  sendResponse({ reply });
} catch (err) {
  sendResponse({ error: err.message });
} finally {
  clearInterval(keepAlive);
}
```

Do not write the user's message to IndexedDB as a "pending" record before the response arrives. Write both the user message and the assistant reply together in a single transaction only after the response succeeds. This prevents phantom pending messages if the worker dies mid-call.

**Warning signs:**
- New chat message handler added without the `setInterval` keepalive block
- User message written to DB before `sendResponse` is called
- Chat shows permanent spinner after 30+ second idle with DevTools closed

**Phase to address:**
Phase 1 (service worker chat handler) — before any UI work.

---

### Pitfall 2: Conversation History Not Bounded — Token Count Grows Silently Until Request Fails

**What goes wrong:**
The chat sends the full conversation history as the `messages` array to OpenRouter on every turn. After 10–20 exchanges on a complex problem, the accumulated tokens exceed the model's context window. OpenRouter returns a 400 error ("context_length_exceeded" or similar). The user sees an error mid-conversation with no explanation.

**Why it happens:**
Storing and replaying the full message history is the simplest implementation. Developers add it without thinking about accumulated token size. The issue is invisible during development (small conversations) but hits users in real use.

**How to avoid:**
Cap the messages sent to OpenRouter: send only the system prompt plus the last N turns (e.g., last 10 messages, ~5 exchanges). For the chat feature specifically, a rolling window of the most recent messages is sufficient since users are solving a single active problem. Optionally, track approximate token counts using a character/4 heuristic and trim when approaching 80% of the model's known context window.

Also: the `max_tokens` on the response (currently 1024 in v1.1) stays correct for chat — do not increase it, or input + output risks exceeding the context ceiling on models with smaller windows (e.g., some 8K context models).

**Warning signs:**
- `messages` array passed to OpenRouter built from `conversation.messages` without any length limit
- No token-count check or message-count limit before the API call
- Error messages from OpenRouter mentioning "context_length" or "too many tokens"
- Models with 8K context windows selected and conversations exceeding ~30 messages

**Phase to address:**
Phase 1 (service worker chat handler) — cap messages array before the first working implementation.

---

### Pitfall 3: IndexedDB Schema Migration (v2 → v3) Blocks Upgrade If Tabs Are Open

**What goes wrong:**
The `conversations` store is added to IndexedDB in a v3 migration. A user with LeetCode open in two tabs upgrades the extension. The first tab opens the new v3 database and begins the upgrade. The second tab still has the v2 database open. Chrome dispatches `onblocked` on the first tab's open request. The upgrade never completes. The extension silently fails to open the DB. The chat feature is broken until the user closes all LeetCode tabs.

**Why it happens:**
IndexedDB requires all connections to a database to close before a version upgrade can proceed. Content scripts and popup.js both open the DB. If any connection does not handle `onversionchange` by calling `db.close()`, the upgrade blocks indefinitely.

**How to avoid:**
The existing `openDatabase()` already sets `db.onversionchange = () => db.close()` on success — this handles the existing v2 scenario correctly. The v3 migration must preserve this. Additionally:

- The `onblocked` handler (currently a no-op) should be made visible in development (`console.warn`) so this failure mode is detectable.
- If any new code opens the database (e.g., a new content script that reads conversations), that code must also set `db.onversionchange = () => db.close()`.
- Test the migration with two LeetCode tabs open and a third tab triggering the extension update to verify it completes.

The migration itself is safe: just add a new `conversations` object store in the `oldVersion < 3` block. Do not restructure existing stores. Existing data is preserved automatically.

**Warning signs:**
- `request.onblocked` firing and upgrade not completing (test: open two LeetCode tabs, then reload the extension with the version bumped to 3)
- Any new `indexedDB.open('leetreminder', 3)` call that does not set `db.onversionchange`
- "IDBDatabase: The database connection is closing" errors in the console

**Phase to address:**
Phase 1 (IndexedDB schema migration) — test with two open tabs before shipping.

---

### Pitfall 4: Persistent Chat Button Disappears on LeetCode SPA Navigation

**What goes wrong:**
The chat button is injected into the LeetCode problem page DOM. The user navigates from one problem to another (LeetCode is a React SPA — navigation happens via `history.pushState` without a full page reload). The old button is destroyed with the React virtual DOM. The new problem page does not trigger a new `document_start` injection because the content script lifecycle does not re-run on soft navigations. The chat button never appears on the second problem.

**Why it happens:**
Chrome content scripts declared in `manifest.json` run only on full page loads (`document_start` / `document_end`). SPA navigation using the History API does not trigger a new content script injection. The existing `content-toast.js` avoids this problem because toasts are transient (they remove themselves). A persistent chat button is different: it must survive or be re-created on each problem URL.

**How to avoid:**
Add a `popstate` / `hashchange` listener inside the content script that detects problem URL changes and re-mounts the chat button. Use `MutationObserver` to detect when the LeetCode problem container mounts (since the DOM re-renders on navigation). Guard against double-injection by checking for the button's host element ID before creating it.

```js
function mountChatButton() {
  if (document.getElementById('leetreminder-chat-host')) return; // already mounted
  // inject button
}

// Initial mount
mountChatButton();

// Re-mount on SPA navigation
window.addEventListener('popstate', () => {
  document.getElementById('leetreminder-chat-host')?.remove();
  setTimeout(mountChatButton, 300); // wait for React to re-render
});
```

The 300ms delay is empirical — LeetCode's React tree typically re-renders within that window. Use a MutationObserver targeting the problem title element for a more robust approach.

**Warning signs:**
- Chat button appears on first problem load but not after navigating to a second problem
- No `popstate` or URL change listener in the content script
- No guard against double-injection (will cause two buttons on manual reload)

**Phase to address:**
Phase 2 (chat button content script) — test by navigating between two problems without reloading.

---

### Pitfall 5: Wrong Submission Hint Saved to Conversation Creates Schema Mismatch

**What goes wrong:**
The requirement says "Hint/solution output from the wrong submission panel should also be saved into the chat conversation history." This means the existing `showWrongSubmissionDialog` flow (in `content-toast.js`) must write to the new `conversations` IndexedDB store — but that store only exists after the v3 schema migration. If the wrong submission panel fires on a fresh install before any problem chat has been opened, the `conversations` store may not yet be initialized.

In practice, the store is created on every install/upgrade via `onupgradeneeded`, so it always exists. The real risk is a code path that opens a transaction on the `conversations` store without checking that the database is at version 3. If an old code path opens the DB at version 2 (i.e., hard-codes version 2), the new store will not be present and the transaction will fail with `NotFoundError`.

**Why it happens:**
Multiple files open the DB independently. If `background.js` is updated to v3 but a content script still calls `indexedDB.open('leetreminder', 2)`, the content script gets a v2 connection and cannot access `conversations`.

**How to avoid:**
Centralize the database version constant. Define `const DB_VERSION = 3` in a single shared location. All DB opens must use this constant. For the content script specifically, do not open IndexedDB directly — route all DB operations through `chrome.runtime.sendMessage` to the service worker. This keeps IndexedDB access in one place (background.js) and avoids version-mismatch risk in content scripts.

**Warning signs:**
- `indexedDB.open('leetreminder', 2)` hard-coded in any file after the v3 migration
- Content script opening IndexedDB directly rather than messaging the background
- `NotFoundError: No objectStore named 'conversations' in this transaction` in the console

**Phase to address:**
Phase 1 (IndexedDB schema) — establish the "background.js owns all DB access" rule before writing any new DB code.

---

### Pitfall 6: Shadow DOM Chat Panel Breaks on LeetCode's Dark/Light Theme Toggle

**What goes wrong:**
LeetCode has a user-controlled dark/light theme toggle. The existing Shadow DOM components use hardcoded `#282828` backgrounds and `#e0e0e0` text — they were designed for dark mode only and happen to look acceptable in both modes. The chat panel is more complex (input field, message bubbles, timestamps) and hardcoded colors will be obviously wrong in light mode: dark text on dark background in dark mode, but light panel against a light page in light mode.

**Why it happens:**
The existing `content-toast.js` components are small (toasts, dialogs) and appear briefly — style mismatch is tolerable. The chat panel is persistent and large. Hardcoding one theme is a shortcut that works at panel size but fails at chat panel size.

**How to avoid:**
Use CSS `prefers-color-scheme` inside the Shadow DOM to switch between dark and light theme values. Since the Shadow DOM is isolated from the page, `prefers-color-scheme` reflects the OS/browser preference, which usually matches the LeetCode theme choice. Alternatively, detect LeetCode's `dark` class on `<html>` from inside the content script and pass a theme attribute to the Shadow DOM host:

```js
const isDark = document.documentElement.classList.contains('dark');
host.setAttribute('data-theme', isDark ? 'dark' : 'light');
```

Then use `[data-theme="dark"]` and `[data-theme="light"]` selectors inside the Shadow DOM.

This is a quality-of-life issue, not a blocker, but it will generate user complaints immediately if unaddressed.

**Warning signs:**
- All color values hardcoded to dark theme values only
- No theme detection or `prefers-color-scheme` media query in Shadow DOM styles
- Chat panel tested only against LeetCode's dark theme

**Phase to address:**
Phase 2 (chat panel UI) — design for both themes from the start, not as a polish pass.

---

### Pitfall 7: `chrome.runtime.sendMessage` From Content Script Fails If Service Worker Not Yet Active

**What goes wrong:**
The user opens a LeetCode problem page. The content script initializes immediately (`document_start`). It sends a message to load the existing conversation for this problem. The service worker is not yet active (it terminated 30 seconds after the last Chrome event). The `sendMessage` call throws "Could not establish connection. Receiving end does not exist." The conversation history is never loaded. The chat panel shows as empty even though a history exists.

**Why it happens:**
MV3 service workers are not persistent. They are started on demand by incoming messages, but there is a brief window during which the worker is spinning up and cannot receive messages. The existing `content-isolated.js` already handles this for `SUBMISSION_CAPTURED` with a 500ms retry. The same pattern is needed for the new `LOAD_CONVERSATION` and `SEND_CHAT_MESSAGE` message types.

**How to avoid:**
Wrap all `sendMessage` calls from the chat content script in the same retry pattern used in `content-isolated.js`:

```js
function sendWithRetry(message, callback, attempt = 1) {
  chrome.runtime.sendMessage(message, (response) => {
    if (chrome.runtime.lastError) {
      if (attempt === 1) {
        setTimeout(() => sendWithRetry(message, callback, 2), 600);
      } else {
        callback(null); // give up after one retry
      }
      return;
    }
    callback(response);
  });
}
```

For conversation loading (which runs at page-load time), a 600ms retry on first failure is sufficient. The worker wakes up quickly once poked.

**Warning signs:**
- `chrome.runtime.sendMessage` called directly without `lastError` check or retry logic
- Conversation fails to load on first page visit after browser restart
- Works reliably in DevTools (DevTools keeps the service worker alive) but fails in normal use

**Phase to address:**
Phase 2 (content script messaging) — add retry wrapper before connecting the chat panel's load sequence.

---

### Pitfall 8: Conversation History View Loads All Messages at Once — Performance Degrades With Long Histories

**What goes wrong:**
The conversation history view renders all stored conversations for all problems from IndexedDB in a single read. A user with 100+ LeetCode problems, each with a multi-turn chat history, loads thousands of messages into the DOM at once. The popup becomes slow to open and sluggish to scroll.

**Why it happens:**
"Load all and render" is the simplest implementation. At MVP scale (5–10 problems) it is unnoticeable. It becomes a problem after extended use.

**How to avoid:**
Paginate by problem: load the list of problems with conversations first (one record per problem — just the problem title, slug, and message count). Load individual conversation messages only when the user selects a problem. Do not load message bodies for conversations the user has not opened. A single IndexedDB `getAll()` on a `conversationMeta` index (or equivalent) is fast even at 200+ problems.

**Warning signs:**
- Single `getAll()` that fetches all conversations and all messages on popup open
- No lazy loading of per-problem messages
- Noticeable pause when opening the history view after 50+ conversations

**Phase to address:**
Phase 3 (conversation history view) — design the data access pattern before building the UI.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Send full conversation history to OpenRouter without capping | Less code, no truncation logic | Context window exceeded after ~15 exchanges; request fails with 400 | Never — cap at N turns from day one |
| Write user message to DB before AI responds | Simpler state tracking | Phantom pending messages after service worker death | Never for chat — write both turns together on success |
| Hard-code DB version number in multiple files | Less refactoring | Version mismatch breaks DB access after any migration | Never — centralize DB_VERSION constant |
| Persistent button injected without SPA re-mount logic | Works on first load | Button disappears on problem navigation | Never for persistent UI |
| Load all conversation history on popup open | Simpler query | Slow popup after extended use | MVP with ≤20 problems; add lazy load before v1.2 ships |
| All hardcoded dark-theme colors | Matches current usage | Broken appearance on LeetCode light mode | MVP if noted as known issue; fix before store submission |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| OpenRouter multi-turn chat | Sending full `messages` array without length cap | Slice to last N messages before each API call |
| OpenRouter chat | Re-using v1.1 single-message prompt builder unchanged | Build a proper `messages` array with `system`, `user`, and `assistant` roles |
| IndexedDB v3 migration | Any file hard-coding version 2 after migration | Single `DB_VERSION = 3` constant; all opens reference it |
| IndexedDB from content script | Opening DB directly in content script | Route all DB access through background service worker via `sendMessage` |
| Shadow DOM chat panel | Testing only against LeetCode dark theme | Test against both themes; add `prefers-color-scheme` or theme detection |
| Content script messaging | No retry on first `sendMessage` after worker wake-up | Wrap in retry helper (600ms delay, one retry attempt) |
| Wrong submission → chat integration | Saving hint to DB from `content-toast.js` directly | Send `SAVE_TO_CONVERSATION` message to background; background writes to DB |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Unbounded conversation history sent to OpenRouter | API 400 errors after 15+ exchanges; increasing latency | Rolling window of last N messages (e.g., 10) | After ~10 back-and-forth turns with verbose responses |
| Loading all conversations on popup open | Popup sluggish to open after 50+ problem histories | Load problem list first; load messages on demand | After ~50 problems with chat histories |
| Storing full AI responses in IndexedDB repeatedly | DB grows without bound; storage quota eventually exceeded | Store response text only (not full API JSON); no dedup needed for chat | Unlikely at typical use scale, but flag for future monitoring |
| Re-rendering full message list on every new message | Chat panel jitters/repaints on long conversations | Append new messages to DOM rather than full re-render | After ~100 messages in a single conversation |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| API key accessed from content script to include in chat messages | Key exposed to page JavaScript | Background service worker reads key; content script sends only message text |
| Chat message text rendered with `innerHTML` without sanitization | XSS from AI-generated HTML in chat responses | Pipe all AI response text through the existing `renderFeedback()` function or DOMPurify |
| Conversation data logged to `console.log` | User code and AI advice visible in DevTools logs | No logging of conversation content beyond debug mode |
| User messages sent to OpenRouter without prompt injection guard | Problem code in messages could contain adversarial instructions | Keep the existing system prompt injection guard from v1.1 |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No indication that a previous conversation exists when opening chat | User starts typing unaware that history exists | Show previous messages immediately on panel open; don't start with blank slate |
| "New session" behavior unclear — old messages visible but not sent as context | User confused about whether AI "remembers" previous conversation | Clear visual divider between sessions; label "New session" at the start of each new chat |
| Wrong submission hint appended to chat with no separator from subsequent chat | User cannot distinguish AI feedback from interactive chat | Visual badge or label: "Wrong submission hint" vs "Chat" message type |
| Delete confirmation not shown before clearing conversation | User accidentally deletes long helpful conversation | Confirm dialog before delete; "Undo" for 5 seconds post-delete |
| Chat panel and wrong submission panel both visible simultaneously | Overlapping UI is confusing and cluttered | Opening chat panel closes the wrong submission panel and vice versa |
| No scroll-to-bottom on new message | User loses track of latest message in long conversations | Auto-scroll to bottom on new message append; pause if user has manually scrolled up |

---

## "Looks Done But Isn't" Checklist

- [ ] **SPA navigation:** Chat button appears on the second problem after navigating from the first — verify without page reload
- [ ] **Service worker wake-up:** Conversation loads correctly on first visit after browser restart (service worker was not running)
- [ ] **Multi-turn keepalive:** 30-second keepalive heartbeat is present in the `SEND_CHAT_MESSAGE` handler — check via code review, not just by testing short responses
- [ ] **Token cap:** Send 15+ messages in a single conversation and verify the 16th does not return a context window error from OpenRouter
- [ ] **DB migration:** Open two LeetCode tabs, bump DB to version 3, reload extension — verify both tabs continue working and migration completes
- [ ] **Wrong submission → chat integration:** Trigger a wrong submission, click Hint, then open the chat panel — verify the hint appears as a message in the conversation history
- [ ] **New session semantics:** Start a chat, close panel, reopen — verify history is restored; start a new session — verify old messages are visible but a divider marks the new session
- [ ] **Delete conversation:** Delete a conversation from the history view — verify it is gone from IndexedDB, not just from the UI

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Service worker killed mid-chat | MEDIUM | Add keepalive to chat handler; add "retry" button to chat UI for failed messages |
| Context window exceeded | LOW | Add message count cap to API call builder; existing conversations unaffected |
| DB migration blocked by open tabs | LOW | User closes LeetCode tabs; extension retries DB open; no data lost |
| Phantom pending messages in DB | MEDIUM | Add migration script to remove messages with no `assistantContent`; add status field to messages |
| SPA button disappears | LOW | Add `popstate` listener + re-mount guard; no data loss |
| Conversation history slow to load | MEDIUM | Refactor DB query to load problem list first, messages on demand |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Service worker killed mid-chat | Phase 1: SW chat handler | Test: idle 35s with DevTools closed, send chat message — response arrives |
| Unbounded token context | Phase 1: SW chat handler | Test: send 15 messages — no 400 context error from OpenRouter |
| IndexedDB migration blocking | Phase 1: DB schema migration | Test: two LeetCode tabs open during extension reload with DB v3 |
| Phantom pending messages | Phase 1: DB schema migration | Test: kill service worker mid-call — verify no orphaned pending messages |
| Wrong submission → chat write path | Phase 1: DB schema migration | Code review: wrong submission hint writes via background.js only |
| Persistent button lost on SPA navigation | Phase 2: Chat button content script | Test: navigate between two problems — button present on both |
| Service worker wake-up messaging | Phase 2: Content script messaging | Test: restart browser, open LeetCode — conversation loads on first send |
| Dark/light theme | Phase 2: Chat panel UI | Visual test: LeetCode light mode — panel is readable |
| History view performance | Phase 3: Conversation history view | Test: 50 problems with history — popup opens in under 300ms |
| Delete conversation UX | Phase 3: Conversation history view | Test: delete with confirmation; verify DB record removed |

---

## Sources

- [Chrome Extension Service Worker Lifecycle — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — 30s idle termination, Chrome API calls reset timer (HIGH confidence)
- [Longer Extension Service Worker Lifetimes — Chrome for Developers](https://developer.chrome.com/blog/longer-esw-lifetimes) — Chrome 110+ event-driven lifetime rules (HIGH confidence)
- [MV3 ServiceWorker implementation is completely unreliable — Chromium Extensions Group](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/jpFZj1p7mJc) — real-world service worker termination failure reports (MEDIUM confidence)
- [Solved: Message Port Closed Before Response — Extension.Ninja](https://www.extension.ninja/blog/post/solved-message-port-closed-before-response-was-received/) — `lastError` handling pattern (MEDIUM confidence)
- [IDBOpenDBRequest: upgradeneeded event — MDN](https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/upgradeneeded_event) — schema migration mechanics, `onblocked` behavior (HIGH confidence)
- [Storage quotas and eviction criteria — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria) — IndexedDB storage limits and eviction policy (HIGH confidence)
- [Content scripts — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — injection lifecycle, SPA navigation caveat (HIGH confidence)
- [Isolating Styles in Chrome Extensions with Shadow DOM — Sweets.chat](https://sweets.chat/blog/article/isolating-styles-in-chrome-extensions-with-shadow-dom) — `all: initial` pattern, event propagation across shadow boundary (MEDIUM confidence)
- [OpenRouter API Reference](https://openrouter.ai/docs/api/reference/overview) — context window limits per model, message array format (HIGH confidence)
- [IndexedDB Max Storage Size — RxDB](https://rxdb.info/articles/indexeddb-max-storage-limit.html) — quota limits, QuotaExceededError handling (MEDIUM confidence)

---

## Preserved: v1.1 Pitfalls (Still Fully Relevant)

The following pitfalls from the v1.1 milestone (OpenRouter/AI feedback integration) remain valid. The v1.2 chat feature uses the same patterns — all mitigations carry forward:

- **Missing `anthropic-dangerous-direct-browser-access` header** → N/A (using OpenRouter, not Anthropic direct); OpenRouter has no equivalent header requirement but still needs `host_permissions`
- **`openrouter.ai` not in `host_permissions`** → Already present in manifest; ensure it stays on every manifest update
- **Service worker terminated mid-request** → Keepalive pattern already implemented; must be copied to new chat handler (see Pitfall 1 above)
- **`return true` lost when service worker dies** → `lastError` check in content script; must be added to chat message send path
- **API key visibility in DevTools** → Unchanged; key stays in service worker only
- **Markdown rendering via `renderFeedback()`** → Chat responses need the same renderer; do not duplicate it
- **Unhandled 401/429 error states** → Chat message handler needs the same error classification

Full detail for v1.1 pitfalls is in git history (commit prior to 2026-03-13) and the v1.1 version of this file.

---

*Pitfalls research for: interactive AI chat + conversation persistence in Chrome MV3 extension (v1.2)*
*Researched: 2026-03-15*
