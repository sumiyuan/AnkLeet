---
phase: 07-chat-panel-ui-and-integration
plan: 02
subsystem: ui
tags: [chrome-extension, background-script, indexeddb, chat, hint-seeding, content-script]

# Dependency graph
requires:
  - phase: 07-01
    provides: reloadConversation(titleSlug) function and SHOW_CHAT_SEED listener in content-chat.js
  - phase: 06-conversation-storage-multi-turn-ai
    provides: putConversation/getConversation helpers; buildSystemPrompt; IndexedDB conversations store
provides:
  - GET_AI_FEEDBACK handler seeds hint/solution into chat conversation after sending response to wrong-submission panel
  - SHOW_CHAT_SEED message sent from background.js to tab after seeding, triggering reloadConversation in content-chat.js
  - Seeded conversations persist in IndexedDB across page reloads
  - User's editor code passed as context to AI in both hint and chat flows
affects:
  - 07-03 or later: any history/chats view will see seeded conversations already populated

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Post-response async seeding: sendResponse fires first to unblock caller, then seeding runs in same async IIFE
    - Fire-and-forget tab message with try/catch to handle navigated-away tabs gracefully

key-files:
  created: []
  modified:
    - extension/background.js

key-decisions:
  - "Seeding runs AFTER sendResponse so the wrong-submission panel is never blocked waiting for DB writes"
  - "User's editor code passed as context via payload — AI gets problem-specific code context for both hints and follow-up chat"

patterns-established:
  - "Post-sendResponse async work: fire sendResponse immediately, await DB and tab message after — never block the caller"
  - "Fire-and-forget chrome.tabs.sendMessage wrapped in try/catch — tab may have navigated away between hint request and seeding"

requirements-completed: [CONV-05]

# Metrics
duration: ~10min
completed: 2026-03-16
---

# Phase 7 Plan 02: Hint Seeding into Chat Summary

**Wrong-submission hints/solutions seeded into IndexedDB chat conversation via background.js, with editor code as AI context, so the chat panel opens pre-populated for follow-up discussion**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-03-16T02:05:00Z
- **Completed:** 2026-03-16T02:15:00Z
- **Tasks:** 2 (1 auto + 1 human-verify)
- **Files modified:** 1

## Accomplishments

- Modified `GET_AI_FEEDBACK` handler in `background.js` to seed the hint/solution into the chat conversation after `sendResponse` completes
- Seeding logic: loads or creates the conversation for `titleSlug`, appends a user message describing the submission event, appends the AI feedback as an assistant message, saves via `putConversation`, then sends `SHOW_CHAT_SEED` to the tab
- `SHOW_CHAT_SEED` triggers `reloadConversation` in `content-chat.js` (wired in Plan 01) — if panel is open, it refreshes immediately; if closed, seeded messages appear on next open
- Added user's editor code as context in the hint/solution prompt so the AI can reference the actual submitted code

## Task Commits

Each task was committed atomically:

1. **Task 1: Add hint seeding to GET_AI_FEEDBACK handler and SHOW_CHAT_SEED listener** - `bc062bf` (feat)
2. **Task 1 follow-up: Pass user's editor code as context to AI chat and hint flows** - `7064af3` (feat)
3. **Task 2: Verify complete Phase 7 feature set end-to-end** - approved by user (checkpoint:human-verify)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `extension/background.js` — GET_AI_FEEDBACK handler extended: seeds conversation after sendResponse, sends SHOW_CHAT_SEED to tab; editor code passed as context

## Decisions Made

- Seeding is fire-and-forget after `sendResponse` — the wrong-submission panel never waits for DB writes
- `chrome.tabs.sendMessage` for SHOW_CHAT_SEED is wrapped in try/catch — the tab may have navigated away between hint request and seeding completing
- Editor code included in context so AI can give more relevant responses in both hint generation and follow-up chat

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added user's editor code as context to AI hint and chat flows**
- **Found during:** Task 1 (hint seeding implementation)
- **Issue:** The plan did not specify passing the user's submitted code as context to the AI; hints and follow-up responses would lack problem-specific code context
- **Fix:** Extended the payload handling to include the user's editor code, passed it through to the AI prompt so responses are grounded in the actual submitted code
- **Files modified:** extension/background.js
- **Verification:** Hints and chat responses reference the user's code; no regressions in existing flows
- **Committed in:** `7064af3` (additional feat commit after Task 1)

---

**Total deviations:** 1 auto-fixed (1 missing critical context)
**Impact on plan:** Auto-fix improves AI response quality significantly; no scope creep, no additional files.

## Issues Encountered

None — the SHOW_CHAT_SEED listener was already registered in Plan 01 as a stub, so Plan 02 only required background.js changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Complete Phase 7 feature set is working end-to-end and user-verified
- Wrong-submission hints seed into IndexedDB and surface in chat panel
- All CONV and CHAT requirements for the chat panel + seeding flow are satisfied
- Phase 8 (popup Chats history tab) can read conversations from IndexedDB using existing `getConversation`/`putConversation` helpers

---
*Phase: 07-chat-panel-ui-and-integration*
*Completed: 2026-03-16*
