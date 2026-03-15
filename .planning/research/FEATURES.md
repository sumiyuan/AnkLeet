# Feature Research

**Domain:** Interactive AI chat side panel with per-problem conversation history (Chrome extension, MV3)
**Researched:** 2026-03-15
**Confidence:** HIGH (UX patterns from ChatGPT/VS Code/Cursor/Gemini Workspace), MEDIUM (Chrome extension-specific implementation details)

> **Scope note:** This is v1.2 milestone research. The existing v1.0–v1.1 features (submission
> capture, FSRS queue, rating dialog, toast, badge, settings, one-shot AI feedback popup) are
> already built. This file covers ONLY the NEW chat features being added.

---

## What the Existing Pipeline Already Provides (Dependencies)

The v1.1 wrong-submission panel provides these hooks that v1.2 extends:

| Existing piece | How v1.2 uses it |
|----------------|-----------------|
| Shadow DOM popup pattern in `content-toast.js` | Chat panel is a new persistent Shadow DOM host alongside the existing popup |
| `chrome.runtime.sendMessage` + background `callOpenRouter` | Chat uses same OpenRouter call path, wrapping multi-turn messages array |
| `settings.openRouterApiKey` + `settings.aiModel` | Chat reads same stored key and model — no new settings needed |
| IndexedDB (currently: `submissions`, `cards`, `reviewLogs` stores) | New `conversations` store added at DB version bump |
| Existing hint/solution text produced in v1.1 panel | First turn of chat is pre-populated from that output, not duplicated |
| Problem `titleSlug` from URL (`/problems/([^/]+)`) | Chat keyed per-problem by `titleSlug` |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist in any AI chat interface. Missing these = product feels broken or unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Persistent chat trigger button on LeetCode problem pages | Every AI coding tool (Cursor, Copilot, Gemini Workspace) has a persistent button that opens the panel; ad-hoc manual open is not a workflow | LOW | Fixed-position button injected via content script; stays across navigation within the problem page |
| Toggle open/close | User needs to focus on code without panel in the way; all side panels in VS Code/Cursor are togglable | LOW | Single button toggles. Panel state (open/closed) does not persist across page loads — default closed |
| Message input field + send action | Core of any chat: textarea at bottom, submit on Enter or Send button | LOW | Enter to send is the ChatGPT/Claude standard; Shift+Enter for newline |
| User message displayed above AI response | Chat bubble pattern: user message right-aligned or labeled, AI response left-aligned/labeled | LOW | Shadow DOM prevents LeetCode styles interfering; simple flex column layout |
| Loading / thinking indicator while AI responds | Without it the UI appears frozen during the 2–5 second API call | LOW | "Thinking..." text or animated dots; identical to the loading state in v1.1 popup |
| Error states: missing API key, API failure | OpenRouter 429, network errors, missing key are routine; user must see actionable message not a broken UI | LOW | Reuse v1.1 error handling logic; show inline error in chat thread |
| Per-session conversation continuity | User sends several follow-up messages in one sitting; each message adds to the thread — AI "remembers" what was said earlier | MEDIUM | All messages in current session passed in `messages[]` array to OpenRouter; no special backend needed |
| Close / clear / new chat ability | User finishes a problem and wants a fresh chat for the next one | LOW | "New chat" button clears the current in-memory thread; prompts save or discard |
| Markdown rendering of AI responses | AI outputs code blocks, bold text, bullet lists; raw backtick text is noticeably bad for code explanations | LOW | Minimal regex renderer already planned/exists from v1.1 panel; same approach applies here |
| Scroll to latest message | As the thread grows, the view should stay pinned to the most recent message automatically | LOW | Standard CSS `overflow-y: auto` + `scrollIntoView` on new message append |

### Differentiators (Competitive Advantage)

Features that set this product apart. Not required, but add meaningful value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-problem conversation history persisted to IndexedDB | Conversation survives page reload, browser restart; user can return to a problem next week and see prior chat. No other LeetCode-specific tool provides this | MEDIUM | New `conversations` IndexedDB store; key by `titleSlug`; auto-save on every message sent |
| History browser in popup or panel: list past conversations by problem | User can review old hints without re-solving; reinforces learning. Gemini Workspace and ChatGPT sidebar both show conversation list | MEDIUM | Either a new tab in the popup or a "History" pane that slides in from the panel; each item shows titleSlug + last-message preview + date |
| Delete individual conversation | User wants to clean up spoiled solutions; privacy hygiene | LOW | Per-item delete button in history list; confirms before delete |
| v1.1 hint/solution output seeded as first message in chat | User clicks "Hint" from wrong-submission panel → hint is the opening AI turn in the chat for that problem; no duplication, no context loss | MEDIUM | Wrong-submission panel sends a message to the chat panel (or directly writes to the conversations store) before opening; chat panel displays it as the first assistant turn |
| Problem context auto-injected as system prompt | Problem slug and language passed automatically; user never has to say "I'm solving two-sum in Python". Cursor/Copilot do this with file context | LOW | System prompt template: "The user is solving LeetCode problem `{titleSlug}` in `{lang}`." Populated from URL + last submission record |
| Model selector carries over from v1.1 settings | User already configured their preferred model for hints; chat uses same model without extra setup | LOW | Read `settings.aiModel` same as v1.1; no new UI needed |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem obvious but create significant problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-open chat on wrong submission | "Smart and proactive" | Interrupts focus at exactly the wrong moment (user is reading the error); also duplicates with wrong-submission panel, causing two UI surfaces to appear simultaneously | Keep chat button passive; let user open it when they choose |
| Streaming responses in chat | Token-by-token display is standard in ChatGPT/Claude | MV3 service worker streaming via `chrome.runtime.connect` is valid but adds meaningful complexity; non-streaming responses on OpenRouter are 1–3s, acceptable for v1.2 | Non-streaming in v1.2; streaming deferred to v1.3+ when the base chat is stable |
| Sync conversation history across devices | "I use multiple computers" | Requires a backend, user accounts, and encryption for API keys in transit — completely out of stated scope; adds privacy risk | Local-only; explicitly call out in UI ("Saved locally on this device") |
| Infinite conversation history (no cleanup) | "Keep everything" | IndexedDB has no hard limit, but unbounded growth causes slow history queries and storage bloat over months of daily use | Soft limit: keep the 20 most recent messages per problem; show a notice when older messages are trimmed. Alternatively, keep last N conversations (e.g., 50 problems) with delete-all option |
| Full problem statement scraping to inject as context | "More context = better answers" | LeetCode's DOM changes frequently; scraping is fragile and may break silently. GraphQL requires rotating auth cookies. | Use titleSlug + user's code + status in system prompt. Claude can infer the problem from these alone with high accuracy |
| Rich text editor for user input | "Format my code properly" | Users are asking short follow-up questions, not writing documents; a textarea is appropriate. Rich editors add bundle weight and keyboard trap complexity in Shadow DOM | Plain `<textarea>` with monospace font; markdown in AI response only |
| Export / share conversation | "I want to share my solution journey" | Niche use case; adds file download logic or share API; out of scope for a spaced-repetition focus | Defer indefinitely; if requested by multiple users, ship later |

---

## Feature Dependencies

```
[Chat trigger button] (persistent, all LeetCode problem pages)
    └──opens──> [Chat side panel]
                    ├──requires──> [settings.openRouterApiKey]  (already exists v1.1)
                    ├──requires──> [settings.aiModel]           (already exists v1.1)
                    ├──reads──>    [conversations store in IndexedDB]
                    │                  └──requires──> [DB schema v3 migration]
                    │                                     └──requires──> [DB version bump in background.js]
                    │
                    ├──sends──>    [User message + full thread to background]
                    │                  └──background calls OpenRouter with messages[] array
                    │                  └──returns complete AI response (non-streaming)
                    │                  └──content script appends response to thread
                    │                  └──auto-saves updated thread to IndexedDB
                    │
                    ├──pre-seeded by──> [v1.1 wrong-submission hint/solution output]
                    │                       └──v1.1 panel writes first AI turn to conversations store
                    │                       └──chat panel loads it as conversation[0] on open
                    │
                    └──history view──> [List of past conversations by titleSlug]
                                           ├──reads──> [conversations store, all records]
                                           ├──allows──> [open/resume past conversation]
                                           └──allows──> [delete individual conversation]
```

### Dependency Notes

- **DB schema v3 must land before any conversation feature:** The `conversations` store does not exist yet. A DB version bump with `onupgradeneeded` is the first implementation task. All other chat features depend on this.
- **v1.1 panel integration is a soft dependency:** If the seed-from-hint feature is deferred, the chat panel still works fully as a standalone blank conversation. The seed is an enhancement, not a blocker.
- **Background message handler extension:** `background.js` needs a new `CHAT_MESSAGE` handler that accepts `{ messages: [...], titleSlug, lang }` and calls `callOpenRouter` with the full messages array (not a single-shot prompt). The existing `callOpenRouter` function will need a refactor to support multi-turn `messages[]` vs the v1.1 single-turn prompt approach.
- **History view location:** The history browser (listing past conversations) can live in either the popup (`popup.html`) or as a slide-in pane within the chat panel itself. The popup approach avoids content-script complexity; the in-panel approach keeps context local to the problem page. This is an open design decision that does not affect data storage.

---

## MVP Definition

### Launch With (v1.2)

Minimum viable product — what's needed to validate the interactive chat concept.

- [ ] Chat trigger button (fixed-position) on all `leetcode.com/problems/*` pages
- [ ] Slide-in chat panel (Shadow DOM) with message thread, input field, send button
- [ ] Per-problem conversation persisted to IndexedDB `conversations` store
- [ ] Full conversation thread passed as `messages[]` to OpenRouter on each send (multi-turn context)
- [ ] Loading state during API call; error state for missing key and API failures
- [ ] Markdown rendering of AI responses (code blocks, bold, bullets — reuse v1.1 renderer)
- [ ] New chat / clear conversation button (wipes in-memory thread; deletes from IndexedDB)
- [ ] DB schema v3 migration that adds `conversations` store

### Add After Validation (v1.2.x)

Features to add once the core chat loop is confirmed working.

- [ ] v1.1 hint/solution output seeded as first chat turn — improves continuity between panels
- [ ] Conversation history browser — list past conversations, delete individual ones
- [ ] Soft message limit per conversation (20 messages) with visible trim notice
- [ ] "Thinking..." animated indicator vs static text (minor polish)

### Future Consideration (v1.3+)

Defer until chat is stable and used.

- [ ] Streaming responses via `chrome.runtime.connect` long-lived port
- [ ] Cross-problem pattern insights ("you consistently struggle with sliding window")
- [ ] Conversation export (text copy of thread)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Persistent chat trigger button | HIGH | LOW | P1 |
| Chat panel with message thread + input | HIGH | MEDIUM | P1 |
| Multi-turn conversation (messages[] to OpenRouter) | HIGH | MEDIUM | P1 |
| IndexedDB conversations store (schema v3) | HIGH | LOW | P1 |
| Auto-save conversation on each message | HIGH | LOW | P1 |
| Loading + error states | HIGH | LOW | P1 |
| Markdown rendering (reuse v1.1) | MEDIUM | LOW | P1 |
| New chat / clear button | MEDIUM | LOW | P1 |
| Seed first turn from v1.1 hint output | HIGH | MEDIUM | P2 |
| Conversation history browser (popup or in-panel) | MEDIUM | MEDIUM | P2 |
| Delete individual conversation | MEDIUM | LOW | P2 |
| Soft message limit with trim notice | LOW | LOW | P2 |
| Streaming responses | MEDIUM | HIGH | P3 |
| Cross-problem pattern analysis | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## UX Pattern Reference

Drawn from production AI tools (ChatGPT, Claude.ai, Cursor, VS Code Copilot, Gemini Workspace side panel):

**Panel layout (top to bottom):**
1. Header: problem name + "New chat" button + close button
2. Message thread: scrollable list, newest at bottom
3. Input area: textarea (Enter = send, Shift+Enter = newline) + Send button

**Message display:**
- User messages: right-aligned or "You:" labeled, plain text
- AI messages: left-aligned or "AI:" labeled, markdown rendered
- Loading: "Thinking..." with animated ellipsis, replaces send button during in-flight call
- Error: inline red message in the thread, "Retry" action

**Conversation history (if in popup):**
- List sorted by last-active descending
- Each row: problem title (from titleSlug) + last-message preview + date
- Tap row: opens problem page and/or loads that conversation in panel
- Trash icon per row: delete with confirmation

**New chat behavior:**
- Clears in-memory thread
- Does NOT auto-delete the persisted history (user must explicitly delete from history view)
- This matches ChatGPT: starting a new chat archives the old one

---

## Sources

- [Gemini Workspace Conversation History in Side Panel](https://workspaceupdates.googleblog.com/2026/02/gemini-conversation-history-is-coming-to-side-panel-in-google-workspace.html) — production side-panel chat pattern (HIGH confidence — official Google announcement)
- [PatternFly Chatbot Conversation History](https://www.patternfly.org/patternfly-ai/chatbot/chatbot-conversation-history/) — component-level UX for history drawer, search, new chat, grouped by date (HIGH confidence — design system documentation)
- [AI Chat UI Best Practices — DEV Community](https://dev.to/greedy_reader/ai-chat-ui-best-practices-designing-better-llm-interfaces-18jj) — message rendering, streaming indicators, error states (MEDIUM confidence — community article)
- [Chrome Extension Side Panel API](https://developer.chrome.com/docs/extensions/reference/api/sidePanel) — Chrome MV3 native side panel (HIGH confidence — official Chrome docs)
- [Cursor Forum: Toggle chat panel button](https://forum.cursor.com/t/guys-stop-messing-around-the-ui-toggle-chat-panel-button-is-needed/154636) — real-world user expectation for persistent toggle (MEDIUM confidence — community forum)
- [Where should AI sit in your UI? — UX Collective](https://uxdesign.cc/where-should-ai-sit-in-your-ui-1710a258390e) — AI panel placement patterns, left/right anchoring, F-scan alignment (MEDIUM confidence — UX article)
- LeetReminder codebase: `background.js`, `content-toast.js`, `manifest.json`, `content-isolated.js` — existing infrastructure and constraints (HIGH confidence — direct code inspection)

---

*Feature research for: Interactive AI chat + conversation history — LeetReminder v1.2 milestone*
*Researched: 2026-03-15*
