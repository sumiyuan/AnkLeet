---
phase: 2
slug: fsrs-scheduling-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual (Chrome DevTools) — no test runner in project |
| **Config file** | none — no test framework detected |
| **Quick run command** | Manual: open extension on LeetCode, verify via DevTools IndexedDB inspector |
| **Full suite command** | Manual: verify all 4 requirement behaviors via DevTools console |
| **Estimated runtime** | ~120 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Manual smoke test — verify card/log entries in IndexedDB
- **After every plan wave:** All four requirement behaviors verified via DevTools console
- **Before `/gsd:verify-work`:** All success criteria manually confirmed
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | FSRS-01 | manual | Verify card created in IndexedDB after first accepted submission | N/A | ⬜ pending |
| 02-01-02 | 01 | 1 | FSRS-02 | manual | Send RATE_REVIEW message via DevTools, inspect card.due updated | N/A | ⬜ pending |
| 02-01-03 | 01 | 1 | FSRS-03 | manual | Set card due dates, call GET_DUE_TODAY, verify only due cards returned | N/A | ⬜ pending |
| 02-01-04 | 01 | 1 | FSRS-04 | manual | Review cards with different ratings, verify stats accuracy | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extension/lib/` directory — create for vendored ts-fsrs UMD bundle
- [ ] Vendor `ts-fsrs@5.2.3` UMD bundle into `extension/lib/`
- [ ] Debug helper (`__leetreminderDebug`) for DevTools console queries (optional)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Card created on first accepted submission | FSRS-01 | Requires real Chrome extension context + LeetCode page | Submit accepted solution, check IndexedDB for new card entry |
| Card due date updates after rating | FSRS-02 | Requires message passing in extension context | Call RATE_REVIEW via DevTools SW console, inspect card.due change |
| Due-today query filters correctly | FSRS-03 | Requires IndexedDB with seeded data | Manually set due dates, call GET_DUE_TODAY, verify filter |
| Stats accuracy | FSRS-04 | Requires accumulated review history | Complete multiple reviews, verify retention/count/streak |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions
- [ ] Sampling continuity: manual verification after each task commit
- [ ] Wave 0 covers vendored library setup
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
