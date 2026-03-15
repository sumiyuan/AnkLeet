---
phase: 06-conversation-storage-multi-turn-ai
plan: 01
subsystem: database
tags: [indexeddb, chrome-mv3, openrouter, multi-turn, service-worker]

# Dependency graph
requires: []
provides:
  - IndexedDB v3 conversations store with per-problem document schema
  - callOpenRouter refactored to accept messages[] array (multi-turn capable)
  - getConversation, putConversation, deleteConversation IndexedDB helpers
  - buildSystemPrompt function with Socratic method guidance
  - CHAT_SEND_MESSAGE handler with 10-message context cap and keepalive
  - CHAT_LOAD_CONVERSATION handler returning stored conversation or null
  - CHAT_CLEAR_CONVERSATION handler deleting conversation record
affects: [07-chat-panel-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - IndexedDB incremental migration via oldVersion guards (v1/v2 unchanged, v3 added)
    - callOpenRouter now accepts messages[] directly — callers own message construction
    - Service worker keepalive via setInterval(chrome.storage.local.get, 20_000) during async API calls
    - Conversation stored as single document per problem with embedded messages array

key-files:
  created: []
  modified:
    - extension/background.js

key-decisions:
  - "callOpenRouter signature changed from (apiKey, model, submission, mode) to (apiKey, model, messages[]) — callers now build messages array; buildPrompt() retained for GET_AI_FEEDBACK"
  - "System prompt stored in conversation.messages[0] on creation — becomes part of conversation history"
  - "Timestamps stripped from messages before OpenRouter call — API only accepts {role, content}"
  - "Context cap applied as slice(-10) on full messages array including system message"

patterns-established:
  - "Pattern: Conversation helpers (getConversation/putConversation/deleteConversation) follow getCard/putCard pattern exactly"
  - "Pattern: All three chat handlers follow async IIFE + return true pattern from existing handlers"

requirements-completed: [CONV-01, CHAT-03]

# Metrics
duration: 2min
completed: 2026-03-15
---

# Phase 6 Plan 01: Conversation Storage and Multi-Turn AI Summary

**IndexedDB v3 migration with conversations store, messages[] callOpenRouter API, and three multi-turn chat handlers (CHAT_SEND_MESSAGE/LOAD/CLEAR) in background.js**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-15T06:35:30Z
- **Completed:** 2026-03-15T06:37:08Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Upgraded IndexedDB to v3 with additive conversations store (no data loss to existing stores)
- Refactored callOpenRouter to accept messages[] array enabling multi-turn AI conversations
- Added getConversation/putConversation/deleteConversation helpers following existing getCard/putCard pattern
- Added buildSystemPrompt() with Socratic method guidance and prompt injection guard
- Added CHAT_SEND_MESSAGE handler with system prompt seeding, 10-message context cap, and keepalive
- Added CHAT_LOAD_CONVERSATION and CHAT_CLEAR_CONVERSATION handlers
- Updated GET_AI_FEEDBACK to use new callOpenRouter signature (backward compatibility maintained)

## Task Commits

Each task was committed atomically:

1. **Task 1: IndexedDB v3 migration, callOpenRouter refactor, and conversation helpers** - `fe90593` (feat)
2. **Task 2: Add CHAT_SEND_MESSAGE, CHAT_LOAD_CONVERSATION, and CHAT_CLEAR_CONVERSATION handlers** - `14679cb` (feat)

**Plan metadata:** _(to be added by final commit)_

## Files Created/Modified
- `extension/background.js` - IndexedDB v3 migration, refactored callOpenRouter, conversation helpers, buildSystemPrompt, three chat message handlers

## Decisions Made
- callOpenRouter signature changed from (apiKey, model, submission, mode) to (apiKey, model, messages[]) — callers now build the messages array; buildPrompt() is retained and called at the handler level for GET_AI_FEEDBACK
- System prompt stored in conversation.messages[0] on conversation creation — it becomes part of the persisted history and is naturally included in context window slices
- Timestamps are stripped from all messages before the OpenRouter API call via .map(m => ({ role: m.role, content: m.content })) since OpenRouter only accepts {role, content}
- Context cap applied as conversation.messages.slice(-10) on the full messages array including the system message

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Background.js data layer and AI backend are complete and ready for Phase 7 (chat panel UI)
- CHAT_SEND_MESSAGE, CHAT_LOAD_CONVERSATION, CHAT_CLEAR_CONVERSATION handlers available for content script consumption
- No blockers

---
*Phase: 06-conversation-storage-multi-turn-ai*
*Completed: 2026-03-15*

## Self-Check: PASSED

- extension/background.js: FOUND
- 06-01-SUMMARY.md: FOUND
- Commit fe90593 (Task 1): FOUND
- Commit 14679cb (Task 2): FOUND
