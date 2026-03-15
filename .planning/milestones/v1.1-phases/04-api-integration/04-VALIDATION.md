---
phase: 4
slug: api-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — Chrome extension, manual verification via DevTools |
| **Config file** | None |
| **Quick run command** | Manual: DevTools console in chrome://extensions service worker |
| **Full suite command** | Manual verification per success criteria checklist |
| **Estimated runtime** | ~2 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Manual DevTools verification
- **After every plan wave:** Full manual verification checklist
- **Before `/gsd:verify-work`:** All manual verifications must pass
- **Max feedback latency:** ~120 seconds (manual)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 4-01-01 | 01 | 1 | API-01 | manual | DevTools: send GET_AI_FEEDBACK message | N/A | ⬜ pending |
| 4-01-02 | 01 | 1 | API-02 | manual | DevTools: verify key read from chrome.storage.local | N/A | ⬜ pending |
| 4-01-03 | 01 | 1 | API-03 | manual | DevTools: test with invalid/missing key | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — no test framework needed. All verification is manual via Chrome DevTools.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| API call returns text response | API-01 | Chrome extension service worker — no test runner | Load extension, set valid OpenRouter key, send GET_AI_FEEDBACK message via DevTools, confirm response |
| Key read from settings | API-02 | Settings stored in chrome.storage.local | Set key in Settings, trigger handler, verify key is used in fetch |
| Graceful error handling | API-03 | Requires simulating API errors | Test with: (1) no key, (2) invalid key (401), (3) observe error messages in response |

---

## Validation Sign-Off

- [x] All tasks have manual verify protocol
- [x] Sampling continuity: manual verify after each task
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
