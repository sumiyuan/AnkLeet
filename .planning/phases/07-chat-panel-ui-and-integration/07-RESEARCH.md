# Phase 7: Chat Panel UI and Integration - Research

**Researched:** 2026-03-15
**Domain:** Chrome MV3 content script Shadow DOM UI, SPA navigation detection, markdown rendering, hint seeding
**Confidence:** HIGH

---

## Summary

Phase 7 is entirely a front-end content script phase. The back-end data layer (IndexedDB conversations store, CHAT_SEND_MESSAGE / CHAT_LOAD_CONVERSATION / CHAT_CLEAR_CONVERSATION handlers) was completed in Phase 6 and is ready for consumption. This phase creates a new `content-chat.js` content script that injects a persistent chat button and slide-out panel onto every `leetcode.com/problems/*` page, wires it to the background handlers, and handles hint seeding from the wrong-submission panel.

The project already has a reference implementation to follow: `content-toast.js` demonstrates the exact Shadow DOM pattern, closed shadow root style, DOM construction via `createElement`, and `chrome.runtime.sendMessage` call style. The new file follows those conventions verbatim. The wrong-submission hint seeding requires a new `SEED_CHAT_MESSAGE` message type routed through `background.js` — the decision recorded in STATE.md is that `content-toast.js` does NOT change; background.js relays the seed after `GET_AI_FEEDBACK` completes.

LeetCode is a React SPA. The chat button must survive `pushState` navigation to a different problem page. The reliable approach is a `MutationObserver` on `document.body` that detects URL changes (compare `location.pathname` before/after), removes the old panel host, and re-injects for the new problem. The `renderFeedback` function already in `content-toast.js` handles triple-backtick code fences — for full CHAT-04 compliance (bold, bullet lists, inline code) a richer renderer is needed inside `content-chat.js`.

**Primary recommendation:** Create `extension/content-chat.js` as a standalone Shadow DOM content script (same pattern as `content-toast.js`), register it in `manifest.json` at `document_end`, add a `SEED_CHAT_MESSAGE` handler to `background.js` that calls `putConversation`, and add a `SHOW_CHAT_SEED` message from `background.js` to the chat panel after GET_AI_FEEDBACK completes.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CHAT-01 | Persistent chat button on LeetCode problem pages that survives SPA navigation | Shadow DOM host injected at `document_end`; MutationObserver pathname-watch handles SPA navigation; re-inject on problem change |
| CHAT-02 | Send messages, receive AI responses in a threaded conversation | CHAT_SEND_MESSAGE handler already wired in background.js; content script sends message, appends response to thread DOM |
| CHAT-04 | AI responses render markdown with code blocks, bold, bullet lists | Custom inline markdown renderer in content-chat.js — no library needed; extend existing renderFeedback pattern |
| CHAT-05 | Loading indicator while AI responds; inline error on failure | `loadingEl.style.display` toggle pattern already in showWrongSubmissionDialog; replicate exactly |
| CONV-02 | "New Chat" clears thread and starts fresh conversation | CHAT_CLEAR_CONVERSATION handler already wired; button calls it then resets panel DOM |
| CONV-05 | Hint/solution from wrong-submission panel seeded as first message | GET_AI_FEEDBACK in background.js triggers SEED_CHAT_MESSAGE, which calls putConversation; on panel open, CHAT_LOAD_CONVERSATION loads the seeded message |
</phase_requirements>

---

## Standard Stack

### Core (no new npm packages — same stack as existing content scripts)
| Component | Version/State | Purpose | Why Standard |
|-----------|---------------|---------|--------------|
| Shadow DOM (closed) | Browser native | Isolate panel CSS from LeetCode page | Already used by all content-toast.js dialogs; prevents style bleed |
| chrome.runtime.sendMessage | MV3 native | Content script → background communication | Already used by content-toast.js for all handler calls |
| MutationObserver | Browser native | Detect SPA navigation on LeetCode (React pushState) | Most reliable approach for React SPAs; avoids fragile DOM polling |
| No markdown library | — | Inline renderer handles bold/code/lists | Adding a library to a content script requires manifest changes and adds surface area; regex-based inline renderer is sufficient for AI chat responses |

### No new npm packages or manifest permissions required.

All required capabilities (Shadow DOM, sendMessage, MutationObserver) are browser-native and already used in this extension.

---

## Architecture Patterns

### Recommended Project Structure

```
extension/
├── background.js       — Add SEED_CHAT_MESSAGE handler; add SHOW_CHAT_SEED trigger after GET_AI_FEEDBACK
├── content-chat.js     — NEW: chat button + slide-out panel (Shadow DOM)
├── content-toast.js    — No changes
├── content-main.js     — No changes
├── content-isolated.js — No changes
└── manifest.json       — Add content-chat.js entry at document_end
```

### Pattern 1: Shadow DOM Content Script (reference: content-toast.js)

The exact pattern for injecting an isolated UI element:

```javascript
// Source: content-toast.js showWrongSubmissionDialog (lines 500-720)
const host = document.createElement('div');
host.id = 'leetreminder-chat-host';
document.body.appendChild(host);

const shadow = host.attachShadow({ mode: 'closed' });

const style = document.createElement('style');
style.textContent = `/* all CSS scoped to shadow root */`;

// Build DOM with createElement + textContent (NOT innerHTML)
// All text from external sources (user input, AI responses) goes through textContent only
shadow.appendChild(style);
shadow.appendChild(panelEl);
```

**Key constraints from existing code:**
- Always `mode: 'closed'` — prevents LeetCode JS from accessing shadow internals
- Never use `innerHTML` for user-sourced or AI-sourced content — always `textContent` or `createElement`
- All CSS uses `all: initial` on the outermost element to reset inherited page styles

### Pattern 2: SPA Navigation Detection

LeetCode uses React Router with `history.pushState` for problem-to-problem navigation. A `MutationObserver` on `document.title` or `document.body` children is the standard approach:

```javascript
// Source: established pattern for Chrome extension SPA detection
let lastPath = location.pathname;

const navObserver = new MutationObserver(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    handleNavigationChange();
  }
});

navObserver.observe(document.body, { childList: true, subtree: true });

function handleNavigationChange() {
  // Check if still on a problems/* page
  if (!/^\/problems\//.test(location.pathname)) {
    // User left problems area — remove panel
    document.getElementById('leetreminder-chat-host')?.remove();
    return;
  }
  // Re-inject for new problem
  const newSlug = location.pathname.split('/')[2];
  reinitChatPanel(newSlug);
}
```

**Why MutationObserver over `popstate`:** `popstate` fires for back/forward only, not for programmatic `pushState` calls. React Router uses `pushState` for navigation, so `popstate` alone misses most navigations. Observing `document.body` childList catches React's DOM updates.

### Pattern 3: Chat Panel UI Structure

Based on the existing `showWrongSubmissionDialog` panel (content-toast.js lines 500-720) as visual reference:

```
#leetreminder-chat-host (fixed host div)
  shadow root (closed)
    <style>  — all panel CSS
    .chat-button  — fixed position FAB, visible always, bottom-right
    .chat-panel   — slide-out panel (hidden by default)
      .panel-header
        .panel-title  "AI Chat"
        .problem-name  (current problem titleSlug)
        .new-chat-btn  "New Chat"
        .close-btn    "×"
      .messages-area  (scrollable, flex-col)
        .message.user   per-message bubble
        .message.assistant  per-message bubble (markdown rendered)
      .input-area
        textarea  (user input)
        .send-btn  "Send"
      .loading   (hidden by default)
      .error-msg  (hidden by default)
```

### Pattern 4: Markdown Renderer (CHAT-04)

The existing `renderFeedback` in `content-toast.js` only handles triple-backtick code fences. CHAT-04 also requires bold and bullet lists. An inline renderer without external dependencies:

```javascript
// Source: custom pattern — extend existing renderFeedback approach
function renderMarkdown(container, text) {
  container.innerHTML = '';
  // Split on triple-backtick code fences first
  const parts = text.split(/(```[\s\S]*?```)/g);
  for (const part of parts) {
    if (part.startsWith('```')) {
      const body = part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
      const pre = document.createElement('pre');
      pre.textContent = body;
      container.appendChild(pre);
    } else {
      // Process inline: split on newlines for block-level structure
      const lines = part.split('\n');
      let inList = false;
      let ul = null;
      for (const line of lines) {
        if (line.startsWith('- ') || line.startsWith('* ')) {
          // Bullet list item
          if (!inList) { ul = document.createElement('ul'); inList = true; container.appendChild(ul); }
          const li = document.createElement('li');
          appendInlineMarkdown(li, line.slice(2));
          ul.appendChild(li);
        } else {
          if (inList) { inList = false; ul = null; }
          if (line.trim()) {
            const p = document.createElement('p');
            appendInlineMarkdown(p, line);
            container.appendChild(p);
          }
        }
      }
    }
  }
}

function appendInlineMarkdown(el, text) {
  // Handle **bold** and `inline code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  for (const part of parts) {
    if (part.startsWith('**') && part.endsWith('**')) {
      const strong = document.createElement('strong');
      strong.textContent = part.slice(2, -2);
      el.appendChild(strong);
    } else if (part.startsWith('`') && part.endsWith('`')) {
      const code = document.createElement('code');
      code.textContent = part.slice(1, -1);
      el.appendChild(code);
    } else {
      el.appendChild(document.createTextNode(part));
    }
  }
}
```

**XSS safety:** All text ultimately set via `textContent` or `createTextNode` — never `innerHTML`. AI responses cannot inject HTML.

### Pattern 5: CONV-05 Hint Seeding Flow

The STATE.md decision is that `content-toast.js` does not change. The seeding happens in `background.js`:

```
[content-toast.js]
  requestFeedback('hint') → GET_AI_FEEDBACK message

[background.js]
  GET_AI_FEEDBACK handler:
    1. Calls callOpenRouter
    2. sendResponse({ feedback })        // ← existing
    3. NEW: also calls putConversation   // ← add this
       seed message: { role: 'assistant', content: feedback, timestamp: now }
    4. NEW: chrome.tabs.sendMessage(tabId, { type: 'SHOW_CHAT_SEED', titleSlug })
       // signals content-chat.js to reload conversation from IndexedDB

[content-chat.js]
  chrome.runtime.onMessage listener:
    if SHOW_CHAT_SEED: reload conversation from CHAT_LOAD_CONVERSATION
    if panel is open: re-render messages thread
```

**Why route through background.js:** background.js already has the full `submission` record (including titleSlug), the AI response, and the IndexedDB connection — it can do the putConversation in the same async IIFE. The content script receives a lightweight `SHOW_CHAT_SEED` signal and re-fetches.

**Note on tabId availability:** The `sender` object in `GET_AI_FEEDBACK` comes from a content script message. `sender.tab.id` is available. This tabId is used to route `SHOW_CHAT_SEED` back to the correct tab.

### Pattern 6: manifest.json Registration

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
    },
    {
      "matches": ["https://leetcode.com/problems/*"],
      "js": ["content-chat.js"],
      "run_at": "document_end"
    }
  ]
}
```

`document_end` ensures `document.body` is available before injecting the chat host.

### Anti-Patterns to Avoid

- **Do not use chrome.sidePanel API:** STATE.md explicitly records this decision — `chrome.sidePanel` cannot be opened programmatically from a content script. The chat panel is a Shadow DOM overlay injected by `content-chat.js`, not a browser side panel.
- **Do not use innerHTML with AI-sourced text:** AI responses go through `textContent` / `createTextNode` only. The markdown renderer constructs DOM elements directly.
- **Do not skip MutationObserver disconnect on non-problem pages:** If the user navigates away entirely (e.g., to leetcode.com/), the observer should disconnect to avoid unnecessary DOM watching.
- **Do not poll for SPA navigation with setInterval:** MutationObserver is event-driven and more reliable. The existing `content-toast.js` uses MutationObserver (maybeBlurEditor) as a reference.
- **Do not add the sendMessage callback to SHOW_CHAT_SEED emission:** Follow the fire-and-forget pattern from `content-isolated.js` to avoid "message port closed" warnings. Use `void chrome.runtime.lastError` to suppress connection errors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Full parser (marked, remark) | Inline regex renderer (see Pattern 4) | Library requires bundling or importScripts in MV3; inline renderer covers all CHAT-04 requirements with ~40 LOC |
| Chat persistence | Custom storage in content-chat.js | CHAT_LOAD_CONVERSATION / CHAT_SEND_MESSAGE message handlers (Phase 6 built) | Background already has full IndexedDB access; content scripts don't open IndexedDB directly |
| SPA route detection | URL polling with setInterval | MutationObserver on document.body | MutationObserver is event-driven; polling wastes CPU and can miss rapid navigations |
| titleSlug extraction | Parsing complex DOM | `location.pathname.split('/')[2]` | LeetCode URLs are `/problems/{titleSlug}/description` — pathname split is reliable and DOM-independent |

---

## Common Pitfalls

### Pitfall 1: Chat button lost after SPA navigation
**What goes wrong:** User navigates from `/problems/two-sum/` to `/problems/longest-substring/` via React Router. The host div created for two-sum is still in the DOM but `titleSlug` references two-sum. New messages go to the wrong conversation.
**Why it happens:** Content scripts run once at document load; SPA navigation doesn't trigger a new injection.
**How to avoid:** MutationObserver watches `location.pathname`. On change, call `reinitChatPanel(newSlug)` which removes the old host and creates a new one with the updated slug.
**Warning signs:** Messages saved for wrong problem slug; "New Chat" doesn't match the current problem.

### Pitfall 2: Panel opens to empty state after hint seeding
**What goes wrong:** User gets a hint via the wrong-submission panel, opens chat, but sees an empty thread.
**Why it happens:** SHOW_CHAT_SEED arrives but either: (a) background didn't call putConversation before signaling, or (b) panel was already open and didn't re-render.
**How to avoid:** In background.js, `await putConversation(...)` BEFORE `chrome.tabs.sendMessage(tabId, SHOW_CHAT_SEED)`. In content-chat.js, the SHOW_CHAT_SEED handler always calls CHAT_LOAD_CONVERSATION and re-renders regardless of panel visibility.
**Warning signs:** Panel shows empty thread immediately after hint; messages appear only after re-opening panel.

### Pitfall 3: Textarea input blocked by LeetCode's key handlers
**What goes wrong:** User types in the chat textarea but Monaco editor intercepts key events (e.g., Tab indents the editor instead of the textarea).
**Why it happens:** LeetCode registers global keyboard listeners on `document` that intercept Tab, Escape, and arrow keys.
**How to avoid:** In the textarea `keydown` handler, call `event.stopPropagation()` to prevent events from bubbling to LeetCode's listeners. Shadow DOM does NOT automatically stop propagation of keyboard events at the shadow boundary for all browsers.
**Warning signs:** Tab key in textarea indents the Monaco editor; Escape closes LeetCode dialogs.

### Pitfall 4: Send button fires multiple times on Enter key
**What goes wrong:** User presses Enter in textarea; message sends. If no explicit handling, pressing Enter without Shift may trigger duplicate sends.
**Why it happens:** The textarea default for Enter is a newline; if the send button is focused or if keydown fires, it can double-send.
**How to avoid:** Attach `keydown` to textarea: if `event.key === 'Enter' && !event.shiftKey`, call `event.preventDefault()` and trigger send. This also enables the Shift+Enter newline convention.
**Warning signs:** Duplicate messages in thread; blank user messages.

### Pitfall 5: Panel CSS overriding LeetCode's scroll position
**What goes wrong:** The fixed-position panel or button interferes with LeetCode's own overflow scroll containers, causing page jump or scroll lock.
**Why it happens:** CSS `position: fixed` inside a Shadow DOM still affects the page viewport; `overflow: hidden` on an ancestor element can clip a fixed child in some browser versions.
**How to avoid:** Use `position: fixed` on the host element itself (placed on `document.body` as a direct child), not on internal shadow DOM elements. Keep `z-index: 2147483647` as used in existing panels. The existing `showWrongSubmissionDialog` panel positions correctly using this pattern.

### Pitfall 6: SHOW_CHAT_SEED arriving before content-chat.js listener is registered
**What goes wrong:** On a slow page load, background.js emits SHOW_CHAT_SEED but content-chat.js hasn't registered its `onMessage` listener yet. The signal is dropped.
**Why it happens:** Content scripts at `document_end` run after HTML parsing but the page may still be loading. If a hint is requested immediately on page load, the timing window exists.
**How to avoid:** SHOW_CHAT_SEED is a signal to reload — content-chat.js always calls CHAT_LOAD_CONVERSATION on panel open anyway. Missing the signal only means the seeded message appears on next panel open. This is acceptable UX; no special handling needed.

---

## Code Examples

### titleSlug extraction from URL
```javascript
// Source: URL pattern analysis of leetcode.com/problems/{titleSlug}/description
function getCurrentTitleSlug() {
  return location.pathname.split('/')[2] || '';
}
```

### SPA navigation observer
```javascript
// Source: established MV3 content script pattern
let lastPath = location.pathname;

const navObserver = new MutationObserver(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    if (/^\/problems\/[^/]+/.test(location.pathname)) {
      reinitChatPanel(getCurrentTitleSlug());
    } else {
      document.getElementById('leetreminder-chat-host')?.remove();
    }
  }
});

navObserver.observe(document.body, { childList: true, subtree: true });
```

### Sending a message (content-chat.js → background.js)
```javascript
// Source: content-toast.js requestFeedback pattern (lines 684-716)
function sendChatMessage(titleSlug, content, onSuccess, onError) {
  chrome.runtime.sendMessage(
    { type: 'CHAT_SEND_MESSAGE', payload: { titleSlug, content } },
    function (response) {
      if (chrome.runtime.lastError) { onError('Connection lost'); return; }
      if (!response) { onError('No response received'); return; }
      if (response.error) { onError(response.error); return; }
      onSuccess(response.reply, response.messages);
    }
  );
}
```

### SEED_CHAT_MESSAGE handler in background.js
```javascript
// Add to the end of the onMessage handler block in background.js
if (message.type === 'SEED_CHAT_MESSAGE') {
  (async () => {
    if (!db) {
      try { db = await openDatabase(); } catch (err) {
        sendResponse({ error: 'Failed to open database' }); return;
      }
    }
    try {
      const { titleSlug, content } = message.payload;
      const now = Date.now();
      let conversation = await getConversation(db, titleSlug);
      if (!conversation) {
        conversation = { titleSlug, messages: [], createdAt: now, updatedAt: now };
        conversation.messages.push(buildSystemPrompt(titleSlug));
      }
      conversation.messages.push({ role: 'assistant', content, timestamp: now });
      conversation.updatedAt = now;
      await putConversation(db, conversation);
      sendResponse({ ok: true });
    } catch (err) {
      sendResponse({ error: err.message });
    }
  })();
  return true;
}
```

### Triggering SHOW_CHAT_SEED from GET_AI_FEEDBACK (background.js addition)
```javascript
// Inside GET_AI_FEEDBACK handler, after sendResponse({ feedback }):
// Seed the chat conversation (fire-and-forget; tabId is from sender.tab.id)
const seedMsg = { role: 'assistant', content: feedback, timestamp: Date.now() };
// putConversation inline here OR route through SEED_CHAT_MESSAGE
// Then notify content-chat.js:
try {
  await chrome.tabs.sendMessage(sender.tab.id, {
    type: 'SHOW_CHAT_SEED',
    titleSlug: record.titleSlug  // NOTE: record is available in GET_AI_FEEDBACK scope
  });
} catch { /* tab navigated away */ }
```

**Note on GET_AI_FEEDBACK scope:** The current `GET_AI_FEEDBACK` handler loads the submission record from DB. The `titleSlug` is on `submission.titleSlug`. The `sender` object is available in the onMessage callback signature: `(message, sender, sendResponse)`. Use `sender.tab?.id` for the tabId.

### Listening for SHOW_CHAT_SEED in content-chat.js
```javascript
// Source: content-toast.js onMessage listener pattern (lines 722-731)
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.type === 'SHOW_CHAT_SEED') {
    reloadConversation(msg.titleSlug);
  }
});
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| No chat UI in content scripts | Shadow DOM panel injected by content-chat.js | Isolated from LeetCode CSS; no style conflicts |
| Wrong-submission feedback disappears | Hint/solution seeded into conversation history | Users can reference hints in follow-up chat messages |
| Content script re-runs on hard reload only | MutationObserver detects SPA navigation | Chat button stays present across React Router navigations |

**Deprecated/outdated for this phase:**
- `chrome.sidePanel` — explicitly ruled out per STATE.md; cannot be triggered from content scripts without user gesture in Chrome 114+

---

## Open Questions

1. **SHOW_CHAT_SEED message needs titleSlug from GET_AI_FEEDBACK**
   - What we know: `GET_AI_FEEDBACK` loads `submission` which has `submission.titleSlug`. `sender.tab.id` is available.
   - What's unclear: Whether to do the `putConversation` directly inside the `GET_AI_FEEDBACK` handler (no new message type) or route it through a `SEED_CHAT_MESSAGE` handler for cleaner separation.
   - Recommendation: Do it directly in the `GET_AI_FEEDBACK` handler — it already has db, titleSlug, and the feedback text. A separate message type is unnecessary indirection. Add after `sendResponse({ feedback })`.

2. **Panel scroll behavior when new messages arrive**
   - What we know: The messages area needs to auto-scroll to the latest message after send/response.
   - What's unclear: Whether `scrollTop = scrollHeight` is sufficient or whether `scrollIntoView` on the last message is needed.
   - Recommendation: `messagesArea.scrollTop = messagesArea.scrollHeight` after appending a new message. This is sufficient and matches the pattern used in virtually all chat UIs.

3. **Textarea resize behavior**
   - What we know: LeetCode has a fixed-height code editor. A growing textarea could overlap editor content if not bounded.
   - What's unclear: Whether `max-height` + `overflow-y: auto` on the textarea or a fixed single-line textarea is better UX.
   - Recommendation: Fixed `height: 60px` single-line textarea with `resize: none`, consistent with the existing wrong-submission panel aesthetic and the REQUIREMENTS.md note "plain textarea is appropriate."

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — manual / browser testing only |
| Config file | None |
| Quick run command | Load unpacked extension in Chrome, navigate to any leetcode.com/problems/* page |
| Full suite command | Manual end-to-end walkthrough (see Phase Requirements → Test Map) |

No automated test framework is present in the project. All validation is manual using the Chrome extension DevTools.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CHAT-01 | Chat button visible on problems/* page after load | manual | Open DevTools → Elements → search leetreminder-chat-host | N/A |
| CHAT-01 | Chat button still visible after SPA nav to different problem | manual | Navigate via problem list (React Router); verify button still present | N/A |
| CHAT-02 | User can type and send a message, receive AI response | manual | Type in textarea, click Send, verify AI bubble appears | N/A |
| CHAT-04 | AI response with **bold** and `code` renders correctly | manual | Ask AI to respond with bold/code/bullets; verify DOM structure | N/A |
| CHAT-05 | Loading indicator appears during API call | manual | Open DevTools → Network → throttle to Slow 3G; verify spinner | N/A |
| CHAT-05 | Inline error shown when API key missing | manual | Remove API key from settings; send message; verify error text | N/A |
| CONV-02 | "New Chat" clears thread | manual | Send messages, click New Chat, verify empty thread | N/A |
| CONV-02 | "New Chat" starts fresh conversation (old messages gone after reload) | manual | Reload page, open panel; verify messages-area is empty | N/A |
| CONV-05 | Hint from wrong-submission panel appears as first message in chat | manual | Submit wrong answer, click Hint, open chat panel; verify hint shown | N/A |

### Sampling Rate
- **Per task commit:** Reload extension, open a problems/* page, verify chat button appears, open panel
- **Per wave merge:** Full walkthrough: send message → verify response → New Chat → SPA navigation → hint seeding
- **Phase gate:** All manual checks green before `/gsd:verify-work`

### Wave 0 Gaps
- None — no automated test framework to set up. All validation is through Chrome extension manual testing.

---

## Sources

### Primary (HIGH confidence)
- `extension/content-toast.js` — Shadow DOM injection pattern, `renderFeedback`, `showWrongSubmissionDialog` structure, `chrome.runtime.sendMessage` style — direct code inspection
- `extension/background.js` — All Phase 6 handlers (CHAT_SEND_MESSAGE, CHAT_LOAD_CONVERSATION, CHAT_CLEAR_CONVERSATION) available for consumption; `sender.tab.id` availability in GET_AI_FEEDBACK; `buildSystemPrompt` signature
- `extension/manifest.json` — Current content_scripts registration; shows `document_end` pattern
- `.planning/STATE.md` — Architecture decisions: chat panel as Shadow DOM content script (not chrome.sidePanel); wrong-submission seeding routed through background.js; content-toast.js unchanged
- `.planning/REQUIREMENTS.md` — CHAT-01 through CHAT-05, CONV-02, CONV-05 exact requirement text
- `.planning/phases/06-conversation-storage-multi-turn-ai/06-01-SUMMARY.md` — Confirmed Phase 6 deliverables: handlers are live, conversation helpers exist

### Secondary (MEDIUM confidence)
- MutationObserver SPA navigation detection — standard documented approach for Chrome extensions on React SPAs; verified as the correct mechanism by cross-reference with Chrome Extensions developer documentation concepts
- `event.stopPropagation()` for Shadow DOM keyboard isolation — documented Shadow DOM behavior: keyboard events do bubble through shadow boundaries; stopPropagation in textarea keydown is the correct mitigation

### Tertiary (LOW confidence)
- None — all critical claims verified against codebase source code or established browser API behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; all patterns already exist in content-toast.js and background.js
- Architecture: HIGH — directly derived from existing content-toast.js patterns and STATE.md decisions
- CONV-05 seeding flow: HIGH — background.js has all required data (submission, db, tabId via sender.tab.id) in the GET_AI_FEEDBACK handler
- SPA navigation: HIGH — MutationObserver is the standard documented pattern; LeetCode pathname structure confirmed from existing URL references in background.js
- Markdown renderer: HIGH — CHAT-04 requirements are bounded (bold, code, bullets, code blocks); inline renderer without library is sufficient

**Research date:** 2026-03-15
**Valid until:** 2026-06-15 (Shadow DOM and MutationObserver APIs are stable; LeetCode URL structure has been stable throughout v1.0/v1.1 development)
