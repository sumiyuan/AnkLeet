---
phase: 5
slug: wrong-submission-dialog
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — no automated test infrastructure exists in this project |
| **Config file** | None |
| **Quick run command** | Manual: reload extension in chrome://extensions, submit wrong answer on LeetCode |
| **Full suite command** | Manual verification per success criteria checklist below |
| **Estimated runtime** | ~60 seconds per manual check |

---

## Sampling Rate

- **After every task commit:** Manual smoke test — reload extension, submit wrong answer, verify dialog
- **After every plan wave:** Full manual verification protocol (all 7 checks below)
- **Before `/gsd:verify-work`:** All manual verifications must pass
- **Max feedback latency:** ~60 seconds per manual test cycle

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | AIFB-01 | manual-smoke | Reload ext, submit wrong answer, verify dialog appears | ❌ manual | ⬜ pending |
| 05-01-02 | 01 | 1 | AIFB-02 | manual | Click Hint, verify loading + nudge response | ❌ manual | ⬜ pending |
| 05-01-03 | 01 | 1 | AIFB-03 | manual | Click Full Solution, verify loading + code response | ❌ manual | ⬜ pending |
| 05-01-04 | 01 | 1 | AIFB-04 | manual | Verify response renders inline in dialog | ❌ manual | ⬜ pending |
| 05-01-05 | 01 | 1 | Regression | manual | Submit accepted answer, verify rating dialog still works | ❌ manual | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements.* No new test framework or fixtures needed — all verification is manual for this Chrome extension content script phase.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dialog appears on wrong submission | AIFB-01 | Chrome extension content script injection requires real browser + LeetCode page | Reload extension, submit wrong answer, verify persistent dialog with Hint/Full Solution buttons |
| Hint returns nudge without revealing answer | AIFB-02 | Requires real OpenRouter API call + subjective quality check of AI response | Click Hint, verify loading state, then text response without code blocks |
| Full Solution returns explanation + code | AIFB-03 | Requires real OpenRouter API call + code block rendering verification | Click Full Solution, verify loading state, then response with `<pre>` code blocks |
| Response appears inline in dialog | AIFB-04 | Visual verification that no popup/new tab opens | Confirm feedback renders in `.feedback-area` within Shadow DOM dialog |
| Accepted submission shows rating dialog | Regression | End-to-end browser behavior | Submit accepted answer, verify FSRS rating dialog appears unchanged |
| No API key shows inline error | Error UX | Requires clearing API key + verifying error message rendering | Delete API key in Settings, submit wrong, click AI button, verify error in dialog |
| Dismiss button closes dialog | UX | Visual verification | Click Dismiss, verify dialog removed from DOM |

---

## Validation Sign-Off

- [ ] All tasks have manual verification protocol defined
- [ ] Sampling continuity: manual smoke test after each commit
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s per manual test
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
