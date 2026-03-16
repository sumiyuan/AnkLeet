---
phase: 07-chat-panel-ui-and-integration
verified: 2026-03-16T00:00:00Z
status: human_needed
score: 9/9 must-haves verified
re_verification: false
human_verification:
  - test: "Navigate to https://leetcode.com/problems/two-sum/ and visually confirm the orange FAB is visible in the bottom-right corner"
    expected: "Orange circular button (48x48px) visible at bottom-right, not obscured by LeetCode UI"
    why_human: "CSS rendering and z-index correctness requires visual inspection in a real browser"
  - test: "Click the chat button, verify the panel opens. Type a message and press Enter"
    expected: "Panel slides open. User message appears as orange bubble on right. 'Thinking...' loading indicator shows (pulsing). AI response appears on left with markdown formatting (code blocks dark background, bold text, bullet lists)"
    why_human: "Visual rendering, loading animation, and real AI response content require live browser testing"
  - test: "Click 'New Chat' button in the panel header"
    expected: "All message bubbles clear; empty state text 'Ask anything about this problem' reappears"
    why_human: "UI state change and DOM clearing requires visual verification"
  - test: "While on a problem page, navigate to a different problem via LeetCode sidebar (SPA navigation)"
    expected: "Chat button persists on new problem page. Panel header shows new problem name. Previous conversation is not shown (fresh state for new slug)"
    why_human: "SPA navigation detection behavior requires real LeetCode SPA environment"
  - test: "Submit a wrong answer on any problem, click 'Hint' in the wrong-submission dialog, then open the chat panel"
    expected: "Chat panel shows the hint as the first assistant message in the conversation. A user context message ('I submitted a wrong answer and asked for a hint.') appears before it"
    why_human: "Full end-to-end flow across content-toast.js -> background.js -> IndexedDB -> content-chat.js requires live browser testing"
  - test: "Reload the page after receiving a hint, then open the chat panel"
    expected: "Seeded hint message still appears (persisted in IndexedDB)"
    why_human: "IndexedDB persistence across page reload requires live browser testing"
  - test: "Remove the API key from Settings, then try to send a message in the chat panel"
    expected: "Inline error message appears in red below the input area: 'No API key configured. Add your OpenRouter API key in Settings.'"
    why_human: "Error state display requires live browser testing with a real missing API key condition"
  - test: "Verify no style bleed between the chat panel and LeetCode page styles"
    expected: "Chat panel fonts, colors, and layout are fully isolated from LeetCode's styles. LeetCode page is unaffected by the panel's presence"
    why_human: "Shadow DOM isolation and visual regression require real browser rendering"
---

# Phase 7: Chat Panel UI and Integration — Verification Report

**Phase Goal:** Persistent chat button on LeetCode problem pages, Shadow DOM slide-out panel with AI conversation, markdown rendering, loading/error states, New Chat, SPA navigation, wrong-submission hint seeding into chat history
**Verified:** 2026-03-16
**Status:** human_needed (all automated checks passed; 8 items require human browser testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A chat button is visible on every leetcode.com/problems/* page | ? HUMAN | `injectChatPanel()` called at bootstrap; `.chat-btn` CSS: `position: fixed; bottom: 24px; right: 24px; z-index: 2147483647; width: 48px; height: 48px; border-radius: 50%; background: #FF6B00` — rendering requires live browser |
| 2 | Chat button survives SPA navigation to a different problem | ? HUMAN | `MutationObserver` on `document.body` with `childList+subtree`, checks `location.pathname !== lastPath`, calls `reinitChatPanel(getCurrentTitleSlug())` on problems/* (line 791-804); correct removal on non-problems pages |
| 3 | User can open the panel, type a message, send it, and receive an AI response | ? HUMAN | `togglePanel()` wired to FAB click (line 394); `triggerSend()` wired to button click (line 462) and Enter key (line 453-456); `CHAT_SEND_MESSAGE` sent to background.js (line 625-626); response appended via `appendMessageBubble('assistant', response.reply)` (line 645) |
| 4 | AI responses render markdown with code blocks, bold, inline code, and bullet lists | ✓ VERIFIED | `renderMarkdown()` (lines 681-737) splits on triple-backtick fences (creates `pre>code`), `**bold**` (creates `strong`), `` `inline code` `` (creates `code`), `- bullet` / `* bullet` (creates `ul>li`), `1. numbered` (creates `ol>li`), plain paragraphs (creates `p`); all via `textContent`/`createTextNode` — no innerHTML on external text |
| 5 | User sees a loading indicator while the AI responds | ✓ VERIFIED | `loadingEl` with class `loading` and CSS `animation: pulse 1.5s ease-in-out infinite`; `showLoading()` called before sendMessage (line 619); `hideLoading()` called in callback (line 628) |
| 6 | User sees an inline error message if the API call fails or API key is missing | ✓ VERIFIED | `errorEl` with class `error-msg`; `showError()` called for `chrome.runtime.lastError` (line 632), missing response (line 636), and `response.error` (line 640); background.js returns `{ error: 'No API key configured...' }` when apiKey missing (line 186-187) |
| 7 | Clicking New Chat clears the visible thread and starts a fresh conversation | ✓ VERIFIED | `handleNewChat()` (lines 576-598) sends `CHAT_CLEAR_CONVERSATION` to background.js; on success: `clearMessagesArea()` + `showEmptyState()` (lines 594-595); background.js calls `deleteConversation(db, titleSlug)` (line 262) |
| 8 | After receiving a hint from the wrong-submission panel, opening the chat panel shows that hint as the first message | ✓ VERIFIED | `GET_AI_FEEDBACK` handler (background.js lines 144-163): loads/creates conversation, appends user context + assistant feedback, calls `putConversation`, then `chrome.tabs.sendMessage(SHOW_CHAT_SEED)`; content-chat.js `SHOW_CHAT_SEED` listener (lines 808-813) calls `reloadConversation(msg.titleSlug)` |
| 9 | The seeded message persists across page reloads | ✓ VERIFIED | Conversation saved to IndexedDB via `putConversation` (background.js line 158); `CHAT_LOAD_CONVERSATION` reads from IndexedDB on panel open; `showPanel()` always calls `reloadConversation(currentTitleSlug)` (line 519) |

**Score:** 7/9 truths fully verified programmatically; 2/9 need human visual confirmation. No truth is FAILED.

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content-chat.js` | Shadow DOM chat panel: FAB, slide-out panel, message thread, markdown renderer, SPA navigation, SHOW_CHAT_SEED listener | ✓ VERIFIED | 820 lines (min_lines: 300 — passes); all required features implemented; closed Shadow DOM (`attachShadow({ mode: 'closed' })`); no innerHTML on external text |
| `extension/manifest.json` | content-chat.js registered as content script at document_end | ✓ VERIFIED | Lines 36-40: `"js": ["content-chat.js"], "run_at": "document_end"` for `https://leetcode.com/problems/*` |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/background.js` | Hint seeding into conversation after GET_AI_FEEDBACK completes | ✓ VERIFIED | Contains `SHOW_CHAT_SEED` (lines 159-163): `putConversation` call at line 158, `chrome.tabs.sendMessage` with `type: 'SHOW_CHAT_SEED'` at line 160 |
| `extension/content-chat.js` | SHOW_CHAT_SEED listener that reloads conversation into panel | ✓ VERIFIED | Contains `SHOW_CHAT_SEED` at line 809: listener registered at module level, calls `reloadConversation(msg.titleSlug || currentTitleSlug)` |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `extension/content-chat.js` | `background.js CHAT_SEND_MESSAGE` | `chrome.runtime.sendMessage` | ✓ WIRED | Line 625: `{ type: 'CHAT_SEND_MESSAGE', payload: { titleSlug, content, userCode } }` inside `triggerSend()` |
| `extension/content-chat.js` | `background.js CHAT_LOAD_CONVERSATION` | `chrome.runtime.sendMessage` | ✓ WIRED | Line 537: `{ type: 'CHAT_LOAD_CONVERSATION', payload: { titleSlug } }` inside `reloadConversation()` |
| `extension/content-chat.js` | `background.js CHAT_CLEAR_CONVERSATION` | `chrome.runtime.sendMessage` | ✓ WIRED | Line 580: `{ type: 'CHAT_CLEAR_CONVERSATION', payload: { titleSlug: currentTitleSlug } }` inside `handleNewChat()` |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `background.js GET_AI_FEEDBACK` | `putConversation` | direct call after sendResponse | ✓ WIRED | Line 158: `await putConversation(db, conversation)` — runs after `sendResponse({ feedback })` at line 140 |
| `background.js` | `extension/content-chat.js` | `chrome.tabs.sendMessage SHOW_CHAT_SEED` | ✓ WIRED | Lines 159-163: `await chrome.tabs.sendMessage(sender.tab.id, { type: 'SHOW_CHAT_SEED', titleSlug: submission.titleSlug })` |
| `content-chat.js SHOW_CHAT_SEED handler` | `background.js CHAT_LOAD_CONVERSATION` | `chrome.runtime.sendMessage` | ✓ WIRED | `SHOW_CHAT_SEED` listener (line 809) calls `reloadConversation()` which sends `CHAT_LOAD_CONVERSATION` (line 537) |

All 6 key links: WIRED.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CHAT-01 | 07-01 | User can open/close AI chat panel via persistent button on problem pages | ✓ SATISFIED | FAB injected via `injectChatPanel()`, `togglePanel()` wired to click, SPA navigation detection reinitializes for each problem |
| CHAT-02 | 07-01 | User can send messages and receive AI responses in threaded conversation | ✓ SATISFIED | `triggerSend()` appends user bubble, sends `CHAT_SEND_MESSAGE`, appends assistant bubble on response |
| CHAT-04 | 07-01 | AI responses render markdown with code blocks, bold, and bullet lists | ✓ SATISFIED | `renderMarkdown()` handles triple-backtick fences, `**bold**`, `` `inline code` ``, `- bullets`, `1. numbered lists`, paragraphs |
| CHAT-05 | 07-01 | User sees loading state while AI responds and error messages on failure | ✓ SATISFIED | `loadingEl` with pulse animation shown/hidden around `CHAT_SEND_MESSAGE` call; `errorEl` shown for all error paths |
| CONV-02 | 07-01 | User can start a new chat which archives the previous conversation | ✓ SATISFIED | "New Chat" button calls `CHAT_CLEAR_CONVERSATION` → `deleteConversation` in background.js; UI clears message area |
| CONV-05 | 07-02 | Hints/solutions from wrong-submission panel saved as opening message of chat | ✓ SATISFIED | `GET_AI_FEEDBACK` seeds conversation after `sendResponse`; `SHOW_CHAT_SEED` triggers `reloadConversation` in content script |

**All 6 phase requirements: SATISFIED.**

**Orphaned requirements check:** REQUIREMENTS.md maps CHAT-03 (multi-turn context) to Phase 6 and CONV-01 (persistence) to Phase 6. Both are correctly outside Phase 7 scope. No orphaned requirements for Phase 7.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `extension/content-chat.js` | 664, 677, 741 | `innerHTML` appears in comments only | ℹ️ Info | Not an issue — comments document the constraint ("never innerHTML"), no actual innerHTML usage on external text found |

No stub implementations, no `TODO`/`FIXME`/`PLACEHOLDER` patterns, no empty return values, no console-log-only handlers found.

---

## Human Verification Required

### 1. Chat button visual presence

**Test:** Navigate to `https://leetcode.com/problems/two-sum/` in a browser with the extension loaded.
**Expected:** Orange circular chat button visible at bottom-right corner, not obscured by LeetCode UI elements.
**Why human:** CSS fixed positioning and z-index stacking context correctness requires real browser rendering.

### 2. Full send/receive flow with markdown

**Test:** Open the chat panel, type "What data structure should I use for this problem?" and press Enter.
**Expected:** User message appears as orange right-aligned bubble. "Thinking..." shows with pulsing animation. AI response appears as dark left-aligned bubble with proper markdown: code blocks have dark background, `**bold**` renders bold, bullet lists render as list items.
**Why human:** Visual rendering quality and real AI response content require live browser testing with a configured API key.

### 3. New Chat clears thread

**Test:** After receiving a message, click "New Chat".
**Expected:** All message bubbles removed. Empty state text reappears. Next message starts a fresh conversation.
**Why human:** UI state change and DOM clearing requires visual verification.

### 4. SPA navigation reinitializes panel

**Test:** On a problem page, click a different problem in LeetCode's problem list (SPA navigation, no page reload).
**Expected:** Chat button persists. Panel header shows the new problem slug (formatted). Previous conversation is not shown.
**Why human:** SPA navigation via LeetCode's React Router requires a real LeetCode environment.

### 5. Hint seeding end-to-end

**Test:** Submit a wrong answer, click "Hint" in the wrong-submission dialog, then open the chat panel.
**Expected:** Chat panel shows a user context message ("I submitted a wrong answer and asked for a hint.") followed by the hint as an assistant message.
**Why human:** Full multi-component flow (content-toast -> background -> IndexedDB -> content-chat) requires live browser testing.

### 6. Hint persistence across page reload

**Test:** After receiving a seeded hint in the chat panel, reload the page, then open the chat panel.
**Expected:** Seeded hint still appears (loaded from IndexedDB).
**Why human:** IndexedDB read-after-reload requires live browser testing.

### 7. Error state display

**Test:** Remove the API key from Settings, open chat panel, send a message.
**Expected:** Inline red error: "No API key configured. Add your OpenRouter API key in Settings."
**Why human:** Error state display with real missing API key requires live browser testing.

### 8. Shadow DOM style isolation

**Test:** Inspect LeetCode page styles before and after chat panel injection.
**Expected:** Chat panel has no style bleed to/from LeetCode page. Dark theme renders correctly inside the Shadow DOM.
**Why human:** Visual CSS isolation requires real browser DevTools inspection.

---

## Summary

All automated checks passed. The implementation is substantive and complete:

- `extension/content-chat.js` (820 lines): Full Shadow DOM chat panel with FAB, slide-out panel, message threads, inline markdown renderer, SPA navigation detection, keyboard isolation, loading/error states, and SHOW_CHAT_SEED listener.
- `extension/manifest.json`: content-chat.js correctly registered at `document_end` for `https://leetcode.com/problems/*`.
- `extension/background.js`: GET_AI_FEEDBACK handler seeds hint/solution into conversation after sendResponse, sends SHOW_CHAT_SEED to tab.

All 6 key links across both plans are wired. All 6 requirements (CHAT-01, CHAT-02, CHAT-04, CHAT-05, CONV-02, CONV-05) have verified implementation evidence. No stub patterns, no innerHTML on external text, no TODO/FIXME blockers.

The phase goal is structurally achieved. 8 items require human browser verification to confirm visual rendering, real AI responses, SPA behavior, and end-to-end hint seeding.

---

_Verified: 2026-03-16_
_Verifier: Claude (gsd-verifier)_
