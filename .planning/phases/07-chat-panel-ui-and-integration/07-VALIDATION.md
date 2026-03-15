---
phase: 7
slug: chat-panel-ui-and-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-15
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual / browser testing only |
| **Config file** | None |
| **Quick run command** | Load unpacked extension in Chrome, navigate to any leetcode.com/problems/* page |
| **Full suite command** | Manual end-to-end walkthrough (see Per-Task Verification Map) |
| **Estimated runtime** | ~120 seconds (manual walkthrough) |

---

## Sampling Rate

- **After every task commit:** Reload extension, open a problems/* page, verify chat button appears, open panel
- **After every plan wave:** Full walkthrough: send message → verify response → New Chat → SPA navigation → hint seeding
- **Before `/gsd:verify-work`:** All manual checks green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | CHAT-01 | manual | Open DevTools → Elements → search leetreminder-chat-host | N/A | ⬜ pending |
| 07-01-02 | 01 | 1 | CHAT-01 | manual | Navigate via problem list (React Router); verify button still present | N/A | ⬜ pending |
| 07-01-03 | 01 | 1 | CHAT-02 | manual | Type in textarea, click Send, verify AI bubble appears | N/A | ⬜ pending |
| 07-01-04 | 01 | 1 | CHAT-04 | manual | Ask AI to respond with bold/code/bullets; verify DOM structure | N/A | ⬜ pending |
| 07-01-05 | 01 | 1 | CHAT-05 | manual | Open DevTools → Network → throttle to Slow 3G; verify spinner | N/A | ⬜ pending |
| 07-01-06 | 01 | 1 | CHAT-05 | manual | Remove API key from settings; send message; verify error text | N/A | ⬜ pending |
| 07-01-07 | 01 | 1 | CONV-02 | manual | Send messages, click New Chat, verify empty thread | N/A | ⬜ pending |
| 07-01-08 | 01 | 1 | CONV-02 | manual | Reload page, open panel; verify messages-area is empty | N/A | ⬜ pending |
| 07-01-09 | 01 | 1 | CONV-05 | manual | Submit wrong answer, click Hint, open chat panel; verify hint shown | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no automated test framework to set up. All validation is through Chrome extension manual testing.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat button visible on problems/* page | CHAT-01 | Chrome extension UI requires live browser | Load extension, navigate to problems page, verify button |
| Chat button survives SPA navigation | CHAT-01 | React Router navigation requires live browser | Navigate between problems via LeetCode UI |
| Send message and receive AI response | CHAT-02 | Requires live API key and extension context | Type message, send, verify response bubble |
| Markdown rendering (bold, code, bullets) | CHAT-04 | DOM structure inspection in live browser | Ask AI for formatted response, inspect elements |
| Loading indicator during API call | CHAT-05 | Requires network throttling in live browser | Throttle network, send message, verify spinner |
| Error on missing API key | CHAT-05 | Requires live extension settings | Remove API key, send message, verify error |
| New Chat clears thread | CONV-02 | UI state verification in live browser | Send messages, click New Chat, verify clear |
| Hint seeding from wrong submission | CONV-05 | Requires full extension flow (submit → hint → chat) | Submit wrong answer, get hint, open chat panel |

---

## Validation Sign-Off

- [ ] All tasks have manual verification instructions
- [ ] Sampling continuity: per-commit reload + verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
