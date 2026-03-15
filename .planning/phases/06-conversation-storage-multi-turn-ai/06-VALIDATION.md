---
phase: 6
slug: conversation-storage-multi-turn-ai
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual / browser testing only |
| **Config file** | None |
| **Quick run command** | Load extension in Chrome, open DevTools → Application → IndexedDB |
| **Full suite command** | Manual end-to-end: send messages, restart browser, verify persistence |
| **Estimated runtime** | ~60 seconds (manual walkthrough) |

---

## Sampling Rate

- **After every task commit:** Reload extension, open any LeetCode problem, open service worker DevTools console, send a CHAT_SEND_MESSAGE via `chrome.runtime.sendMessage`
- **After every plan wave:** Full manual walkthrough: first message → second message (verify history) → restart browser → reload conversation → clear conversation
- **Before `/gsd:verify-work`:** All manual checks green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 6-01-01 | 01 | 1 | CONV-01 | manual-only | DevTools → Application → IndexedDB → leetreminder → conversations | N/A | ⬜ pending |
| 6-01-02 | 01 | 1 | CONV-01 | manual-only | Verify record created on first message, updated on subsequent | N/A | ⬜ pending |
| 6-01-03 | 01 | 1 | CONV-01 | manual-only | Verify submissions/cards stores intact after v2→v3 migration | N/A | ⬜ pending |
| 6-01-04 | 01 | 1 | CHAT-03 | manual-only | Network tab → filter openrouter.ai → inspect messages array in request body | N/A | ⬜ pending |
| 6-01-05 | 01 | 1 | CHAT-03 | manual-only | Verify CHAT_SEND_MESSAGE returns { ok, reply, messages } | N/A | ⬜ pending |
| 6-01-06 | 01 | 1 | CHAT-03 | manual-only | Verify CHAT_LOAD_CONVERSATION returns stored messages | N/A | ⬜ pending |
| 6-01-07 | 01 | 1 | CHAT-03 | manual-only | Verify CHAT_CLEAR_CONVERSATION deletes record | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no automated test framework to set up.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Conversation persists after browser restart | CONV-01 | Requires browser restart — no automated harness | 1. Send message 2. Close/reopen browser 3. Check IndexedDB for conversation record |
| v2→v3 migration preserves existing data | CONV-01 | Requires DB version change at extension load | 1. Load extension with v2 data 2. Verify submissions/cards stores unchanged |
| Multi-turn context in OpenRouter payload | CHAT-03 | Requires network inspection of real API call | 1. Send 2+ messages 2. Check Network tab for messages array in request body |
| Service worker stays alive during slow API call | CHAT-03 | Requires timing/throttle simulation | 1. Throttle network 2. Send message 3. Verify response arrives |

---

## Validation Sign-Off

- [ ] All tasks have manual verification steps documented
- [ ] Sampling continuity: manual check after every task commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
