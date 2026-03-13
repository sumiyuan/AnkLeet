---
phase: 1
slug: foundation-and-capture
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-13
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual E2E (Chrome extension — no Node.js runtime) |
| **Config file** | none — Wave 0 creates extension shell |
| **Quick run command** | Load unpacked extension, open LeetCode problem page, check console |
| **Full suite command** | Submit AC + WA solutions, verify IndexedDB records, toast, browser restart persistence |
| **Estimated runtime** | ~60 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Load unpacked extension in Chrome; open any LeetCode problem page; check browser console for errors
- **After every plan wave:** Full E2E: submit AC + WA solution; verify both records in IndexedDB; verify toast appears and dismisses; restart browser and confirm records persist
- **Before `/gsd:verify-work`:** All manual test rows below must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | CAPT-01 | manual-e2e | Load unpacked, submit AC, verify IndexedDB | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 1 | CAPT-01 | manual-e2e | Submit WA, verify IndexedDB entry | ❌ W0 | ⬜ pending |
| 01-01-03 | 01 | 1 | CAPT-01 | manual-e2e | Visual: toast appears bottom-right, dismisses ~2s | ❌ W0 | ⬜ pending |
| 01-01-04 | 01 | 1 | CAPT-02 | manual-e2e | Inspect IndexedDB record: code, result, timestamp, title, difficulty, tags, URL | ❌ W0 | ⬜ pending |
| 01-01-05 | 01 | 1 | CAPT-01 | manual-e2e | Restart Chrome, submit, verify record appears | ❌ W0 | ⬜ pending |
| 01-01-06 | 01 | 1 | STOR-01 | manual-e2e | Verify submissions in IndexedDB, settings in chrome.storage.local | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `extension/manifest.json` — MV3 manifest shell
- [ ] `extension/background.js` — service worker skeleton with top-level listener stubs
- [ ] `extension/content-main.js` — MAIN world fetch override stub
- [ ] `extension/content-isolated.js` — ISOLATED world relay stub
- [ ] `extension/content-toast.js` — Shadow DOM toast stub
- [ ] `extension/icons/` — placeholder icon files (16, 48, 128px)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Accepted submission triggers capture | CAPT-01 | Chrome extension network interception cannot run in Node.js/jsdom | Load unpacked, solve easy problem, submit AC, check DevTools > Application > IndexedDB |
| Wrong answer triggers capture | CAPT-01 | Same — requires real Chrome + LeetCode | Submit intentionally wrong solution, verify IndexedDB entry |
| Toast appears and auto-dismisses | CAPT-01 | Visual UI in real page context | Watch bottom-right corner after submission |
| Record has all metadata fields | CAPT-02 | Requires real LeetCode GraphQL response | Expand IndexedDB record, verify all fields non-null |
| Survives browser restart | CAPT-01 | Requires actual Chrome restart | Close Chrome, reopen, submit, verify |
| Settings in chrome.storage.local | STOR-01 | Requires Chrome storage APIs | DevTools > Application > Local Storage (extension) |

---

## Validation Sign-Off

- [ ] All tasks have manual verification procedures defined
- [ ] Sampling continuity: every task commit checked via console load
- [ ] Wave 0 covers all extension shell files
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
