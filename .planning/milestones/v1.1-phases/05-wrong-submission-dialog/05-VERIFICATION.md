---
phase: 05-wrong-submission-dialog
verified: 2026-03-15T00:00:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Submit a wrong answer on any LeetCode problem — verify side panel appears"
    expected: "A fixed bottom-right panel appears with red 'Wrong Submission' title, problem name, purple 'Hint' button, and green 'Full Solution' button"
    why_human: "Shadow DOM dialog visibility and layout cannot be verified without a browser"
  - test: "Click the Hint button — verify loading state and response content"
    expected: "Both buttons disable, 'Getting hint...' text appears, then within ~5s a Socratic nudge appears (no algorithm name, no code)"
    why_human: "Requires live OpenRouter API call and runtime behavior; prompt correctness is a UX/content judgment"
  - test: "Click Dismiss, re-trigger wrong submission, click Full Solution"
    expected: "Loading state appears, then response includes a code block rendered in a dark monospace pre element"
    why_human: "Code fence rendering in Shadow DOM and API response quality require visual inspection"
  - test: "Click outside the panel (on LeetCode page content) — verify no dismissal"
    expected: "Panel stays open; only the X close button dismisses it"
    why_human: "Interaction behavior requires manual testing; no overlay click handler exists in code (verified) but needs confirmation"
  - test: "Submit a correct/accepted answer — verify FSRS rating dialog appears, not the wrong-submission panel"
    expected: "Centered overlay with 'Submission Captured', 'How did it go?', and Again/Hard/Good/Easy buttons"
    why_human: "Runtime branching between SHOW_RATING and SHOW_WRONG_SUBMISSION requires live submission to confirm"
---

# Phase 5: Wrong Submission Dialog — Verification Report

**Phase Goal:** Users see a persistent wrong-submission dialog on the LeetCode page with AI feedback buttons that render the response inline
**Verified:** 2026-03-15
**Status:** human_needed (all automated checks passed; 5 items require live browser testing)
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | After a wrong submission, a persistent dialog appears on the LeetCode page with Hint and Full Solution buttons | VERIFIED | `saveSubmission()` sends `SHOW_WRONG_SUBMISSION` for non-Accepted results (background.js:428-435); `showWrongSubmissionDialog()` builds a Shadow DOM side panel with `.ai-btn.hint` and `.ai-btn.full` buttons (content-toast.js:389-609); onMessage handler wires the two (content-toast.js:617-619) |
| 2 | Clicking Hint shows loading state then renders a text nudge without revealing the answer | VERIFIED (automated) / ? (runtime) | `requestFeedback('hint')` disables buttons and shows "Getting hint..." (content-toast.js:573-577); `buildPrompt` uses mode instruction that forbids algorithm name and code in hint mode (background.js:522-524); `renderFeedback` called on success (content-toast.js:602); actual API output needs human review |
| 3 | Clicking Full Solution shows loading state then renders explanation with code blocks | VERIFIED (automated) / ? (runtime) | `requestFeedback('full')` shows "Getting full solution..." (content-toast.js:577); `renderFeedback` splits on triple-backtick fences and creates `<pre>` blocks with `textContent` (content-toast.js:356-372); API response quality needs human review |
| 4 | AI response appears inline in the dialog — no popup or new tab | VERIFIED | `renderFeedback(feedbackArea, response.feedback)` writes into `.feedback-area` div inside the Shadow DOM panel (content-toast.js:602); no `window.open`, `chrome.tabs.create`, or external navigation in the response path |
| 5 | Accepted submissions still show the FSRS rating dialog unchanged | VERIFIED | `saveSubmission()` branches explicitly: `statusDisplay === 'Accepted'` → `SHOW_RATING` (background.js:413-427); all other statuses → `SHOW_WRONG_SUBMISSION` (background.js:428-435); `showRatingDialog()` is unmodified |

**Score:** 5/5 truths verified (automated); 3/5 require additional human confirmation for runtime behavior

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `extension/content-toast.js` | showWrongSubmissionDialog, renderFeedback, renderError, SHOW_WRONG_SUBMISSION handler | VERIFIED | 621 lines; all four symbols present at lines 356, 377, 389, 617; no stubs |

**Wiring check:**
- `showWrongSubmissionDialog` called from onMessage listener at line 618 — WIRED
- `renderFeedback` called from `requestFeedback` callback at line 602 — WIRED
- `renderError` called on three error paths at lines 587, 593, 599 — WIRED
- `requestFeedback` defined as inner function at line 573, called by hintBtn (line 607) and fullBtn (line 608) — WIRED

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `content-toast.js` | `background.js` GET_AI_FEEDBACK handler | `chrome.runtime.sendMessage({ type: 'GET_AI_FEEDBACK', payload: { submissionId, mode } })` | VERIFIED | Pattern found at content-toast.js:580-581; background.js handles at line 108 |
| `content-toast.js` | `background.js` saveSubmission | onMessage listener for SHOW_WRONG_SUBMISSION | VERIFIED | Handler branch at content-toast.js:617-619; background sends SHOW_WRONG_SUBMISSION at background.js:429-435 |
| `background.js` callOpenRouter | OpenRouter API | `fetch('https://openrouter.ai/api/v1/chat/completions')` | VERIFIED | background.js:554; reads `settings.aiModel` at line 131; reads `settings.openRouterApiKey` at line 126 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| AIFB-01 | 05-01-PLAN.md | User sees popup with Hint and Full Solution buttons on wrong submission | SATISFIED | `showWrongSubmissionDialog()` with `.ai-btn.hint` and `.ai-btn.full`; wired from `SHOW_WRONG_SUBMISSION` |
| AIFB-02 | 05-01-PLAN.md | User receives a hint nudging toward solution without revealing the answer | SATISFIED (code) / ? (output quality) | `buildPrompt` mode='hint' instruction: "Give a Socratic hint … WITHOUT revealing the algorithm name or showing any code" (background.js:522-524) |
| AIFB-03 | 05-01-PLAN.md | User receives a full solution with explanation and code | SATISFIED (code) / ? (output quality) | `buildPrompt` mode='full' instruction: "Provide a complete solution with explanation and working code" (background.js:525); `renderFeedback` renders code fences as `<pre>` blocks |
| AIFB-04 | 05-01-PLAN.md | AI response displayed inline in the popup on the LeetCode page | SATISFIED | Response rendered into `feedbackArea` inside Shadow DOM panel on the LeetCode page; no navigation away |

**Orphaned requirements check:** REQUIREMENTS.md maps AIFB-01 through AIFB-04 exclusively to Phase 5. No orphaned requirements found.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | No anti-patterns detected |

Checks run:
- TODO/FIXME/PLACEHOLDER: none found in `content-toast.js`
- Empty implementations (return null, return {}, => {}): none in new functions
- innerHTML with API-sourced text: none — `container.innerHTML = ''` is safe clear before rendering; all API text uses `textContent` (content-toast.js:363, 369, 380, 524-540)
- Stub handlers (only preventDefault): none — requestFeedback performs real sendMessage with callback

---

### Scope Deviations from Plan (User-Approved)

The implementation deviates from the plan spec in two areas, both approved by the user during the checkpoint:

1. **Side panel instead of centered overlay** — Plan specified a centered overlay with `max-width: 480px`. Implemented as a fixed bottom-right side panel (`width: 340px`, `position: fixed; bottom: 20px; right: 20px`). This satisfies the goal more ergonomically (does not block the code editor). The plan's AIFB-04 requirement ("inline in the popup") is still met.

2. **AI model selector in Settings** — Plan did not include this. `popup.html` and `popup.js` were extended with a `<select id="ai-model">` for 5 OpenRouter models. `background.js` reads `settings.aiModel` at line 131. This is additive and does not affect any requirement.

3. **content-isolated.js sendMessage error fixes** — Plan listed only `content-toast.js` as modified. `content-isolated.js` was also updated to handle "port closed" and "context invalidated" errors with a try/catch retry pattern. This is a bug fix that improves reliability of the submission capture pipeline.

These deviations strengthen the implementation and do not contradict any requirement.

---

### Human Verification Required

#### 1. Wrong Submission Panel Appearance

**Test:** On any LeetCode problem, submit a deliberately wrong answer (e.g., return null).
**Expected:** A fixed bottom-right side panel appears with a red "Wrong Submission" title, the problem name in grey, a purple "Hint" button, and a green "Full Solution" button. Panel does not cover the code editor.
**Why human:** Shadow DOM layout and visual positioning cannot be verified statically.

#### 2. Hint Button — Loading State and Response Quality

**Test:** Click the Hint button.
**Expected:** Both buttons become disabled (greyed out), "Getting hint..." text appears below the buttons, then within ~5 seconds a text response appears. Response should be a Socratic nudge — no algorithm name, no code.
**Why human:** Requires a live OpenRouter API key and call. Prompt output quality is a content judgment.

#### 3. Full Solution Button — Code Block Rendering

**Test:** Dismiss the panel, submit another wrong answer, click "Full Solution".
**Expected:** "Getting full solution..." loading text, then a response that includes at least one dark-background monospace code block rendered visually as a `<pre>` element.
**Why human:** Requires API call; code block rendering in Shadow DOM needs visual confirmation.

#### 4. No Backdrop Dismiss

**Test:** While the panel is open, click anywhere on the LeetCode page outside the panel.
**Expected:** Panel stays open. Only the X button in the panel header closes it.
**Why human:** Interaction behavior; no `overlay.addEventListener('click')` exists in the panel code (verified), but confirmation requires manual test.

#### 5. Accepted Submission Regression Check

**Test:** Submit a correct answer to any problem.
**Expected:** The FSRS rating dialog (centered overlay, "Submission Captured", "How did it go?", four rating buttons) appears — not the AI feedback panel.
**Why human:** Runtime branching between the two dialog types requires a real accepted submission.

---

### Gaps Summary

No gaps. All five observable truths are verified at the code level. The phase goal is achieved: the wrong-submission dialog exists, is substantive, is wired to the GET_AI_FEEDBACK backend, renders responses inline, and does not regress the FSRS flow.

Five human verification items remain open — these cover runtime behavior, API output quality, and visual appearance that cannot be confirmed by static code inspection.

---

_Verified: 2026-03-15_
_Verifier: Claude (gsd-verifier)_
