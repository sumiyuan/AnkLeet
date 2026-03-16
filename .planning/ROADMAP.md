# Roadmap: LeetReminder

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-03-13)
- ✅ **v1.1 AI Feedback** — Phases 4-5 (shipped 2026-03-15)
- 🔄 **v1.2 AI Chat** — Phases 6-8 (active)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-03-13</summary>

- [x] **Phase 1: Foundation and Capture** - MV3 scaffold, IndexedDB schema, submission interception
- [x] **Phase 2: FSRS Scheduling Engine** - Card creation, FSRS rating, due-today queue
- [x] **Phase 3: Dashboard, Reviews, and Notifications** - Popup UI tabs, alarm badge, browser notifications

</details>

<details>
<summary>✅ v1.1 AI Feedback (Phases 4-5) — SHIPPED 2026-03-15</summary>

- [x] **Phase 4: API Integration** - Background service worker calls OpenRouter, reads existing API key, handles errors (completed 2026-03-14)
- [x] **Phase 5: Wrong Submission Dialog** - Side panel with Hint/Full Solution buttons and inline AI response (completed 2026-03-15)

</details>

### v1.2 AI Chat (Phases 6-8)

- [x] **Phase 6: Conversation Storage and Multi-Turn AI** - IndexedDB conversations store, background chat handlers, multi-turn OpenRouter integration (completed 2026-03-15)
- [ ] **Phase 7: Chat Panel UI and Integration** - Persistent chat button, Shadow DOM panel, message rendering, wrong submission seeding
- [ ] **Phase 8: Conversation History** - Popup Chats tab with history browsing and deletion

## Phase Details

### Phase 6: Conversation Storage and Multi-Turn AI
**Goal**: The data layer and AI backend for chat are fully operational — conversations persist and multi-turn context is sent to the AI
**Depends on**: Phase 5 (existing callOpenRouter and GET_AI_FEEDBACK)
**Requirements**: CONV-01, CHAT-03
**Success Criteria** (what must be TRUE):
  1. Sending multiple messages to OpenRouter carries the full conversation history in the messages array (multi-turn context works end-to-end in background.js)
  2. A conversation record for a problem is created in IndexedDB on the first message and updated on every subsequent exchange — data survives browser restart
  3. The IndexedDB schema migrates from v2 to v3 without data loss when the extension loads alongside existing submissions and cards
  4. CHAT_SEND_MESSAGE, CHAT_LOAD_CONVERSATION, and CHAT_CLEAR_CONVERSATION handlers respond correctly from background.js
**Plans:** 1/1 plans complete
Plans:
- [ ] 06-01-PLAN.md — IndexedDB v3 migration, callOpenRouter refactor, and chat message handlers

### Phase 7: Chat Panel UI and Integration
**Goal**: Users can have a live AI conversation on any LeetCode problem page, with wrong-submission hints seeded automatically into the chat
**Depends on**: Phase 6
**Requirements**: CHAT-01, CHAT-02, CHAT-04, CHAT-05, CONV-02, CONV-05
**Success Criteria** (what must be TRUE):
  1. A chat button is visible and clickable on every leetcode.com/problems/* page, including after SPA navigation to a different problem
  2. User can open the panel, type a message, send it, and receive an AI response rendered with markdown (code blocks, bold, bullet lists)
  3. User sees a loading indicator while the AI responds and an inline error message if the API call fails or the API key is missing
  4. Clicking "New Chat" clears the visible thread and starts a fresh conversation
  5. After receiving a hint or solution from the wrong-submission panel, opening the chat panel shows that hint/solution as the first message in the conversation
**Plans**: TBD

### Phase 8: Conversation History
**Goal**: Users can browse and manage all past AI conversations for every problem from the popup
**Depends on**: Phase 7
**Requirements**: CONV-03, CONV-04
**Success Criteria** (what must be TRUE):
  1. The popup contains a Chats tab listing all problems that have at least one saved conversation, sorted by most recently updated
  2. Selecting a problem in the list displays its conversation messages
  3. User can delete a conversation with a confirmation step, and the conversation is removed from the list immediately
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation and Capture | v1.0 | 2/2 | Complete | 2026-03-13 |
| 2. FSRS Scheduling Engine | v1.0 | 2/2 | Complete | 2026-03-13 |
| 3. Dashboard, Reviews, and Notifications | v1.0 | 3/3 | Complete | 2026-03-13 |
| 4. API Integration | v1.1 | 1/1 | Complete | 2026-03-14 |
| 5. Wrong Submission Dialog | v1.1 | 1/1 | Complete | 2026-03-15 |
| 6. Conversation Storage and Multi-Turn AI | 1/1 | Complete   | 2026-03-15 | - |
| 7. Chat Panel UI and Integration | 1/2 | In Progress|  | - |
| 8. Conversation History | v1.2 | 0/? | Not started | - |
