---
phase: 3
slug: dashboard-reviews-notifications
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-13
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — manual browser testing (consistent with phases 1-2) |
| **Config file** | none |
| **Quick run command** | Reload extension in `chrome://extensions`; open popup; verify state |
| **Full suite command** | Full manual UAT covering all 5 requirements below |
| **Estimated runtime** | ~2 minutes manual |

---

## Sampling Rate

- **After every task commit:** Reload extension in `chrome://extensions`; open popup; verify rendered state
- **After every plan wave:** Full manual UAT covering all 5 requirements
- **Before `/gsd:verify-work`:** Full suite must pass
- **Max feedback latency:** ~30 seconds (reload + visual check)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | 01 | 1 | DASH-01 | manual | Reload ext; open popup; check dashboard shows today's problems | N/A | ⬜ pending |
| TBD | 01 | 1 | DASH-02 | manual | Open popup; verify review queue with links and rating buttons | N/A | ⬜ pending |
| TBD | 01 | 1 | DASH-03 | manual | Enter API key, toggle notifs, close/reopen; verify persistence | N/A | ⬜ pending |
| TBD | 02 | 1 | NOTF-01 | manual | Wait for alarm or trigger from DevTools; verify notification fires | N/A | ⬜ pending |
| TBD | 02 | 1 | NOTF-02 | manual | Verify badge number matches due card count | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. No automated test framework is established for this project — all verification is manual UAT, consistent with Phases 1 and 2.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard shows today's problems with attempt counts | DASH-01 | Chrome extension popup UI requires browser context | Solve a problem on LeetCode; open popup; verify activity list |
| Review queue shows due cards with links and rating buttons | DASH-02 | Requires live extension context with IndexedDB data | Open popup with due cards; click link (new tab); rate card (animation + removal) |
| Settings saves without reload | DASH-03 | Requires popup lifecycle (close/reopen) | Enter API key, toggle notifications, close popup, reopen; verify values persisted |
| Browser notification fires when reviews due | NOTF-01 | Requires Chrome notification permission and alarm system | Ensure due cards exist; wait for alarm tick or trigger via DevTools; check notification |
| Badge shows due count | NOTF-02 | Requires live extension icon in browser toolbar | Verify badge number on icon matches count of due cards |

---

## Validation Sign-Off

- [x] All tasks have manual verify or Wave 0 dependencies
- [x] Sampling continuity: manual check after every task commit
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
