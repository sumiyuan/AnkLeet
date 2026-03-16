---
phase: 07-chat-panel-ui-and-integration
plan: 01
subsystem: ui
tags: [shadow-dom, content-script, chrome-extension, markdown, spa-navigation, chat]

# Dependency graph
requires:
  - phase: 06-conversation-storage-multi-turn-ai
    provides: CHAT_SEND_MESSAGE, CHAT_LOAD_CONVERSATION, CHAT_CLEAR_CONVERSATION handlers in background.js; putConversation/getConversation/deleteConversation helpers; IndexedDB conversations store
provides:
  - Shadow DOM chat panel injected by content-chat.js on every leetcode.com/problems/* page
  - Floating orange FAB that toggles the slide-out chat panel
  - Full message thread with user/assistant bubbles
  - Inline markdown renderer (code fences, bold, inline code, bullet lists, numbered lists)
  - Loading indicator and inline error message states
  - New Chat button clearing the conversation thread
  - SPA navigation detection via MutationObserver — panel reinitializes for each new problem
  - reloadConversation(titleSlug) function as named contract for Plan 02 (SHOW_CHAT_SEED)
  - SHOW_CHAT_SEED message listener stub (Panel 02 will add the background.js trigger)
affects:
  - 07-02: hint-seeding plan depends on reloadConversation name and SHOW_CHAT_SEED listener

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Shadow DOM closed-mode content script with all styles scoped inside shadow root
    - createElement + textContent for all DOM construction — never innerHTML for external text
    - MutationObserver on document.body for SPA (React Router pushState) navigation detection
    - event.stopPropagation() on textarea keydown to prevent LeetCode Monaco key handler intercept
    - Inline regex markdown renderer — no library; all text via textContent/createTextNode

key-files:
  created:
    - extension/content-chat.js
  modified:
    - extension/manifest.json

key-decisions:
  - "reloadConversation named explicitly for Plan 02 contract — Plan 02 SHOW_CHAT_SEED handler calls this function by name"
  - "SHOW_CHAT_SEED listener registered in Plan 01 so the background.js trigger added in Plan 02 will work immediately without content script changes"
  - "Markdown renderer built inline (no library) — handles all CHAT-04 requirements with ~80 LOC, avoids bundling overhead in MV3 content script"
  - "FAB positioned via host element at document.body level with fixed CSS — avoids overflow clipping from LeetCode ancestor containers"

patterns-established:
  - "Shadow DOM chat panel: host appended to document.body, closed shadow root, all CSS inside style element scoped to shadow root"
  - "SPA navigation: MutationObserver on document.body childList+subtree, compare location.pathname before/after mutation"
  - "Keyboard isolation: textarea keydown always calls event.stopPropagation(); Enter sends, Shift+Enter allows newline"

requirements-completed: [CHAT-01, CHAT-02, CHAT-04, CHAT-05, CONV-02]

# Metrics
duration: 2min
completed: 2026-03-16
---

# Phase 7 Plan 01: Chat Panel UI and Integration Summary

**Shadow DOM chat panel with FAB, message thread, full markdown renderer, SPA navigation detection, and New Chat via content-chat.js**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-16T02:00:04Z
- **Completed:** 2026-03-16T02:02:01Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments

- Created `extension/content-chat.js` (781 lines) — standalone Shadow DOM content script with all chat UI
- Floating orange chat button (FAB) in bottom-right corner visible on every problems/* page
- Slide-out panel with message thread, scrollable messages area, textarea input, loading indicator, and inline error display
- Markdown renderer handles triple-backtick code fences, `**bold**`, `` `inline code` ``, `- bullet` lists, `1. numbered` lists, and regular paragraphs — all text via `textContent`/`createTextNode`
- MutationObserver SPA navigation detection: `reinitChatPanel()` removes/re-injects panel for each new problem
- `reloadConversation(titleSlug)` named function for Plan 02 SHOW_CHAT_SEED contract
- Registered `content-chat.js` in `manifest.json` at `document_end` for problems/* pages

## Task Commits

Each task was committed atomically:

1. **Task 1: Create content-chat.js with chat button, panel, messaging, markdown renderer, and SPA navigation** - `c291210` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `extension/content-chat.js` — Shadow DOM chat panel: FAB, slide-out panel, message thread, markdown renderer, CHAT_SEND/LOAD/CLEAR message passing, SPA navigation observer, SHOW_CHAT_SEED listener
- `extension/manifest.json` — Added content-chat.js content script entry at document_end

## Decisions Made

- Named the conversation-loading function `reloadConversation` explicitly so Plan 02 can call it by name from the SHOW_CHAT_SEED handler without any content script changes
- Registered the SHOW_CHAT_SEED listener in Plan 01 (stub) so no Plan 02 content script modification is needed
- Built inline markdown renderer (no library) — covers all CHAT-04 requirements without bundling overhead

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `content-chat.js` is fully wired to CHAT_SEND_MESSAGE, CHAT_LOAD_CONVERSATION, and CHAT_CLEAR_CONVERSATION
- `reloadConversation(titleSlug)` is a named public function callable from the SHOW_CHAT_SEED listener
- Plan 02 (hint seeding) only needs to add the background.js GET_AI_FEEDBACK → putConversation → chrome.tabs.sendMessage(SHOW_CHAT_SEED) logic
- No blockers

---
*Phase: 07-chat-panel-ui-and-integration*
*Completed: 2026-03-16*
