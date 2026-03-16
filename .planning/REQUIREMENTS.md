# Requirements: LeetReminder

**Defined:** 2026-03-15
**Core Value:** Users never forget a LeetCode problem — every submission is tracked and the FSRS algorithm surfaces problems for review at the optimal time.

## v1.2 Requirements

Requirements for AI Chat milestone. Each maps to roadmap phases.

### Chat Panel

- [x] **CHAT-01**: User can open/close an AI chat panel via a persistent button on LeetCode problem pages
- [x] **CHAT-02**: User can send messages and receive AI responses in a threaded conversation within the panel
- [x] **CHAT-03**: AI remembers prior messages in the conversation (multi-turn context sent to OpenRouter)
- [x] **CHAT-04**: AI responses render markdown with code blocks, bold, and bullet lists
- [x] **CHAT-05**: User sees loading state while AI responds and error messages on failure

### Conversation Storage

- [x] **CONV-01**: Conversations are saved per-problem to IndexedDB and persist across page reloads
- [x] **CONV-02**: User can start a new chat which archives the previous conversation
- [ ] **CONV-03**: User can browse past conversations for a problem in a history view
- [ ] **CONV-04**: User can delete individual past conversations
- [x] **CONV-05**: Hints/solutions from the wrong-submission panel are saved as the opening message of the chat conversation

## Future Requirements

### Streaming

- **STRM-01**: AI responses stream token-by-token via chrome.runtime.connect long-lived port

### Insights

- **INSG-01**: Cross-problem pattern analysis ("you consistently struggle with sliding window")

## Out of Scope

| Feature | Reason |
|---------|--------|
| Streaming AI responses | MV3 service worker streaming adds complexity; non-streaming is 1-3s, acceptable for v1.2 |
| Cloud sync / conversation export | Local-only for privacy; no backend |
| Auto-open chat on wrong submission | Interrupts focus; duplicates with existing wrong-submission panel |
| Full problem statement scraping | LeetCode DOM is fragile; titleSlug + user code is sufficient context |
| Rich text editor for user input | Users ask short questions; plain textarea is appropriate |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CHAT-01 | Phase 7 | Complete |
| CHAT-02 | Phase 7 | Complete |
| CHAT-03 | Phase 6 | Complete |
| CHAT-04 | Phase 7 | Complete |
| CHAT-05 | Phase 7 | Complete |
| CONV-01 | Phase 6 | Complete |
| CONV-02 | Phase 7 | Complete |
| CONV-03 | Phase 8 | Pending |
| CONV-04 | Phase 8 | Pending |
| CONV-05 | Phase 7 | Complete |

**Coverage:**
- v1.2 requirements: 10 total
- Mapped to phases: 10
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 after roadmap creation*
