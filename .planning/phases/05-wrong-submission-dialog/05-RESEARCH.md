# Phase 5: Wrong Submission Dialog - Research

**Researched:** 2026-03-14
**Domain:** Chrome Extension Shadow DOM UI — content-toast.js dialog with AI feedback rendering
**Confidence:** HIGH (primary sources: direct codebase inspection of all relevant source files; Phase 4 implementation verified complete)

---

## Summary

Phase 5 is a single-file UI change to `content-toast.js`. The entire backend is already live from Phase 4: `background.js` has the `GET_AI_FEEDBACK` handler, `callOpenRouter()`, `buildPrompt()`, and `getSubmissionById()`. The service worker is already sending `SHOW_WRONG_SUBMISSION` (with `submissionId`, `titleSlug`, and `title`) to content-toast.js for every non-Accepted submission. Content-toast.js currently has no handler for `SHOW_WRONG_SUBMISSION` — it only handles `SHOW_TOAST` and `SHOW_RATING`.

The work is: add `showWrongSubmissionDialog(submissionId, titleSlug, title)` to content-toast.js and wire it into the `onMessage.addListener` block. The dialog follows the exact same Shadow DOM pattern as the existing `showRatingDialog`. It must include "Hint" and "Full Solution" buttons, a loading state, an AI response rendering area (plain text or markdown-lite), and a dismiss control. No new files, no new dependencies, no manifest changes.

The key decision for the planner is how to render the AI response text. The OpenRouter response is plain text that may contain markdown formatting (code blocks with triple backticks, bold, bullet lists). Options are: (a) `textContent` — safe but loses formatting, (b) `innerHTML` with a sanitized markdown-to-HTML renderer — richer but requires a library or hand-rolled converter, (c) a minimal hand-rolled renderer that handles only code blocks and newlines. Given the project has no bundler and the existing codebase uses only vanilla JS with no external libraries in content scripts, the minimal hand-rolled approach is the pragmatic choice.

**Primary recommendation:** Add `showWrongSubmissionDialog()` to `content-toast.js` following the `showRatingDialog` pattern. Render AI text via a minimal converter that handles code fences and newlines. Send `GET_AI_FEEDBACK` from button click handlers and render the response or error inline. Handle `chrome.runtime.lastError` in the callback.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AIFB-01 | User sees a popup with "Hint" and "Full Solution" buttons when a wrong submission is detected | `SHOW_WRONG_SUBMISSION` is already sent by background.js with `submissionId`; content-toast.js needs `showWrongSubmissionDialog()` that renders these two buttons |
| AIFB-02 | User receives a hint that nudges toward the solution without revealing the answer | `GET_AI_FEEDBACK` with `mode: 'hint'` already calls OpenRouter with the Socratic hint prompt; Phase 5 only needs to send the message and render the text response |
| AIFB-03 | User receives a full solution with explanation and code | `GET_AI_FEEDBACK` with `mode: 'full'` already calls OpenRouter with the full-solution prompt; Phase 5 renders the text response including code blocks |
| AIFB-04 | AI response is displayed inline in the popup on the LeetCode page — no popup or new tab | Response renders in the Shadow DOM dialog's feedback content area; `removeHost()` pattern ensures no stacking dialogs; no new window or tab opened |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vanilla JS DOM APIs | built-in | Create Shadow DOM dialog, add event listeners, render text | Established project pattern; no bundler; no frameworks used in content scripts |
| `chrome.runtime.sendMessage` | built-in | Send `GET_AI_FEEDBACK` to background, receive response | Same pattern already used for `RATE_REVIEW` in `showRatingDialog` |
| `chrome.runtime.lastError` | built-in | Detect service worker disconnection in message callback | Required defensive check; missing it causes uncaught error if worker died |

### No New Dependencies

Zero new libraries. The content script already has no external dependencies. Adding a markdown library would require either bundling (no bundler) or a `<script>` tag (not available in content scripts) or a new `lib/` file loaded via `web_accessible_resources`. All are out of scope. A minimal hand-rolled text renderer is the correct approach.

### Alternatives Considered

| Recommended | Alternative | Tradeoff |
|-------------|-------------|---------|
| Minimal hand-rolled markdown renderer (code fences + newlines) | `marked.js` or `markdown-it` | External library requires bundler or `web_accessible_resources` entry + `lib/` copy; adds 40-100KB for marginal benefit in a hint/solution dialog |
| `textContent` for error messages, minimal HTML for feedback | Full `innerHTML` with DOMPurify sanitization | DOMPurify would need to be a lib/ file; error messages are safe strings we control anyway |
| Reuse existing `leetreminder-toast-host` Shadow DOM host ID | Separate host element per dialog type | `removeHost()` already cleans up by ID; a second ID would require a new cleanup function and risk leaving orphan elements |

---

## Architecture Patterns

### Affected Files

Only one file changes in Phase 5:

| File | Change |
|------|--------|
| `extension/content-toast.js` | Add `showWrongSubmissionDialog(submissionId, titleSlug, title)`; add `SHOW_WRONG_SUBMISSION` branch in `onMessage.addListener` |

All other files are unchanged. `background.js`, `manifest.json`, `content-main.js`, `content-isolated.js`, and `popup.js` are unmodified.

### Recommended Structure

`content-toast.js` will have four public-ish functions after this phase:

```
showToast(message)                          — unchanged
showRatingDialog(titleSlug, title)          — unchanged
showWrongSubmissionDialog(submissionId,     — NEW
    titleSlug, title)
maybeBlurEditor()                           — unchanged (runs at load)
```

The `onMessage.addListener` block gains one new branch:
```javascript
} else if (msg.type === 'SHOW_WRONG_SUBMISSION') {
  showWrongSubmissionDialog(msg.submissionId, msg.titleSlug, msg.title);
}
```

### Pattern 1: showWrongSubmissionDialog() — Shadow DOM Dialog

**What:** A persistent, dismissible dialog (no auto-dismiss) with "Hint" and "Full Solution" buttons. Follows `showRatingDialog` structure exactly: create host div, attach closed shadow root, inject `<style>`, build DOM tree, append to `document.body`.

**When to use:** Called once per `SHOW_WRONG_SUBMISSION` message. `removeHost()` is called first to clear any previous dialog.

**Verified existing elements to reuse:**
- `.overlay` — full-screen translucent backdrop, centers dialog
- `.dialog` — the card with padding, border-radius, box-shadow
- `.dialog-title`, `.dialog-problem` — title + problem name slots
- `overlay.addEventListener('click', ...)` — dismiss on backdrop click
- `removeHost()` — removes `#leetreminder-toast-host`

**New elements needed:**
- `.ai-buttons` — row of two buttons ("Hint", "Full Solution")
- `.ai-btn` — styled like `.rating-btn` but in different colors
- `.feedback-area` — scrollable text area for rendered AI response
- `.loading-state` — spinner or pulsing text shown while API call is in flight
- `.dismiss-link` — styled like `.skip-btn` — closes dialog with `host.remove()`

**Example skeleton:**
```javascript
// Source: direct codebase inspection of content-toast.js showRatingDialog pattern
function showWrongSubmissionDialog(submissionId, titleSlug, title) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'leetreminder-toast-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    /* reuse: .overlay, .dialog, .dialog-title, .dialog-problem, .skip-btn styles */
    .ai-buttons { display: flex; gap: 8px; justify-content: center; margin-bottom: 12px; }
    .ai-btn {
      all: initial;
      display: inline-block;
      padding: 8px 18px;
      border-radius: 6px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      color: #fff;
      box-sizing: border-box;
      transition: opacity 0.15s;
    }
    .ai-btn:hover { opacity: 0.85; }
    .ai-btn:disabled { opacity: 0.4; cursor: default; }
    .ai-btn.hint { background: #7c6af7; }
    .ai-btn.full { background: #4caf50; }
    .feedback-area {
      margin-top: 12px;
      font-size: 13px;
      color: #d0d0d0;
      text-align: left;
      max-height: 320px;
      overflow-y: auto;
      white-space: pre-wrap;
      line-height: 1.5;
    }
    .feedback-area code {
      background: #1e1e1e;
      border-radius: 4px;
      padding: 2px 5px;
      font-family: monospace;
      font-size: 12px;
      color: #ce9178;
    }
    .feedback-area pre {
      background: #1e1e1e;
      border-radius: 6px;
      padding: 10px;
      overflow-x: auto;
      font-family: monospace;
      font-size: 12px;
      color: #ce9178;
      margin: 8px 0;
    }
    .loading { color: #888; font-size: 13px; margin-top: 12px; }
    .error-msg { color: #e05c5c; font-size: 13px; margin-top: 12px; }
  `;

  // ... build overlay > dialog > [title, problem, ai-buttons, feedback-area, dismiss]
  // ... wire button click handlers (see Pattern 2)
}
```

### Pattern 2: Button Click — Send GET_AI_FEEDBACK, Render Response

**What:** On click, disable both buttons, show loading state, send `GET_AI_FEEDBACK` to background, then render response or error. Allow re-clicking (undo disable) only if an error occurs, so the user can retry.

**When to use:** Applied to both "Hint" and "Full Solution" buttons. Mode is `'hint'` or `'full'` respectively.

**Example:**
```javascript
// Source: direct codebase inspection — matches RATE_REVIEW pattern in showRatingDialog
function requestFeedback(mode, submissionId, hintBtn, fullBtn, feedbackArea, loadingEl) {
  hintBtn.disabled = true;
  fullBtn.disabled = true;
  loadingEl.textContent = mode === 'hint' ? 'Getting hint...' : 'Getting full solution...';
  loadingEl.style.display = 'block';
  feedbackArea.innerHTML = '';

  chrome.runtime.sendMessage(
    { type: 'GET_AI_FEEDBACK', payload: { submissionId, mode } },
    function (response) {
      loadingEl.style.display = 'none';

      if (chrome.runtime.lastError) {
        renderError(feedbackArea, 'Connection lost — please try again');
        hintBtn.disabled = false;
        fullBtn.disabled = false;
        return;
      }
      if (!response) {
        renderError(feedbackArea, 'No response received — please try again');
        hintBtn.disabled = false;
        fullBtn.disabled = false;
        return;
      }
      if (response.error) {
        renderError(feedbackArea, response.error);
        hintBtn.disabled = false;
        fullBtn.disabled = false;
        return;
      }

      renderFeedback(feedbackArea, response.feedback);
      // Keep buttons disabled after success — one AI response per click session
    }
  );
}
```

### Pattern 3: Minimal Markdown Renderer

**What:** Convert plain text with optional markdown (code fences, inline code, bold) to safe DOM nodes. Do NOT use `innerHTML` with raw API text — that is an XSS vector even inside Shadow DOM.

**When to use:** Applied to `response.feedback` text before inserting into `feedbackArea`.

**Why not textContent:** The AI responses for "Full Solution" will contain code blocks formatted with triple backticks. Rendering them as plain text with `pre-wrap` is passable but code blocks will show the backtick markers as literal characters. A minimal converter that handles only triple-backtick fences creates significantly better UX with minimal risk.

**Safe approach — create DOM nodes, never inject HTML from API text:**
```javascript
// Source: safe DOM node creation pattern — no innerHTML on API-sourced text
function renderFeedback(container, text) {
  container.innerHTML = ''; // clear previous
  const segments = text.split(/(```[\s\S]*?```)/g);
  for (const seg of segments) {
    if (seg.startsWith('```') && seg.endsWith('```')) {
      // Extract language tag and code body
      const inner = seg.slice(3, -3);
      const firstNewline = inner.indexOf('\n');
      const code = firstNewline >= 0 ? inner.slice(firstNewline + 1) : inner;
      const pre = document.createElement('pre');
      pre.textContent = code.trimEnd(); // textContent — safe
      container.appendChild(pre);
    } else if (seg.trim()) {
      const p = document.createElement('p');
      p.style.cssText = 'margin: 6px 0; white-space: pre-wrap;';
      p.textContent = seg; // textContent — safe
      container.appendChild(p);
    }
  }
}

function renderError(container, message) {
  container.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'error-msg';
  el.textContent = message; // textContent — safe; message is our own string
  container.appendChild(el);
}
```

### Pattern 4: Updated onMessage.addListener Block

**What:** Add one new branch to the existing listener. The existing listener is at the bottom of content-toast.js.

**Current (lines 353-359):**
```javascript
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.type === 'SHOW_TOAST') {
    showToast('\u2713 Submission captured');
  } else if (msg.type === 'SHOW_RATING') {
    showRatingDialog(msg.titleSlug, msg.title);
  }
});
```

**After Phase 5:**
```javascript
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.type === 'SHOW_TOAST') {
    showToast('\u2713 Submission captured');
  } else if (msg.type === 'SHOW_RATING') {
    showRatingDialog(msg.titleSlug, msg.title);
  } else if (msg.type === 'SHOW_WRONG_SUBMISSION') {
    showWrongSubmissionDialog(msg.submissionId, msg.titleSlug, msg.title);
  }
});
```

### Anti-Patterns to Avoid

- **`innerHTML` with API response text:** The feedback string comes from OpenRouter. Even though it is unlikely to contain malicious HTML, using `innerHTML` is unnecessary — always set `textContent` on DOM nodes you create. The minimal renderer above handles code blocks without `innerHTML` on user/API data.
- **Auto-dismissing the wrong submission dialog:** The user must read the AI response. Do not set a timeout. Only dismiss on explicit button click or backdrop click.
- **Enabling retry after successful AI response:** Once feedback has been rendered, keep buttons disabled or hide them. Allowing re-click would make another API call, burning user credits.
- **Not checking `chrome.runtime.lastError`:** In Chrome extension content script callbacks, failing to check `chrome.runtime.lastError` when the callback receives `undefined` (worker died) throws an uncaught error. Always check it before reading `response`.
- **Stacking multiple dialogs:** `removeHost()` at the top of `showWrongSubmissionDialog` prevents this. Verify this is called before any DOM creation.
- **Using a different host element ID:** Must remain `leetreminder-toast-host` so `removeHost()` works uniformly for all dialog types.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing (full spec) | Custom full-spec parser | Minimal code-fence splitter only | Full markdown spec is large; the AI response only uses code blocks and text paragraphs; a 20-line splitter is sufficient |
| HTML sanitization | Custom sanitizer | `element.textContent = value` on created DOM nodes | Never assign API text to `innerHTML`; `textContent` escapes all HTML automatically |
| API error classification | Custom error codes | Read `response.error` string from background | Background already classifies all errors into user-readable strings; display them directly |
| Loading spinner animation | Custom CSS keyframe animation | Pulsing text or ellipsis CSS animation | A `::after` CSS animation on a simple element avoids extra DOM; or just static "Getting hint..." text is sufficient |

**Key insight:** The entire backend is already done. Phase 5 is pure UI. The only tricky part is rendering AI text safely without a markdown library.

---

## Common Pitfalls

### Pitfall 1: Not Checking `chrome.runtime.lastError` in sendMessage Callback

**What goes wrong:** When the service worker is terminated mid-request, the content script's `sendMessage` callback is called with `undefined`. Accessing `response.feedback` throws `TypeError: Cannot read properties of undefined`. Chrome also logs "Unchecked runtime.lastError" in the console — a visible error signal to the user.

**Why it happens:** Chrome's message passing does not guarantee the callback will receive a non-null response. If the port closes (worker died), the callback fires with no arguments.

**How to avoid:** Always check `chrome.runtime.lastError` first, then check `!response`, then check `response.error`, then read `response.feedback`. See Pattern 2 above.

**Warning signs:** AI button click does nothing visible; DevTools console shows "Could not establish connection. Receiving end does not exist."

---

### Pitfall 2: Dialog Dismissed Before User Reads AI Response

**What goes wrong:** Backdrop click (`e.target === overlay`) dismisses the dialog including the AI response. If the user accidentally clicks the backdrop, the feedback disappears.

**Why it happens:** The existing `showRatingDialog` uses the same backdrop-dismiss pattern, which is correct for a quick rating. For a feedback dialog with content the user wants to read, this is more disruptive.

**How to avoid:** Options: (a) keep the backdrop-dismiss but accept the tradeoff (simplest), (b) remove backdrop-dismiss from the wrong submission dialog — only the explicit dismiss link closes it. Option (b) is safer for UX. The planner should choose one approach.

**Warning signs:** User feedback "I kept losing the AI response when scrolling."

---

### Pitfall 3: `pre-wrap` + Long Code Blocks Overflow the Dialog

**What goes wrong:** Full solution responses often include code blocks with long lines. Without `overflow-x: auto` on `<pre>` elements, the dialog expands beyond the viewport width or clips content.

**Why it happens:** Shadow DOM dialogs with `max-width: 360px` are narrow. Code blocks with 60+ character lines overflow.

**How to avoid:** Apply `overflow-x: auto` to `.feedback-area pre`. Also set `max-height` on `.feedback-area` with `overflow-y: auto` so very long responses scroll rather than push the dialog off screen.

**Warning signs:** Dialog wider than viewport; horizontal scrollbar on the outer page.

---

### Pitfall 4: Both Buttons Left Enabled During API Call

**What goes wrong:** If buttons are not disabled when a request is in flight, the user can click "Hint" then "Hint" again, sending two concurrent `GET_AI_FEEDBACK` messages. Both callbacks will render their response into the same `feedbackArea`, with whichever resolves last "winning" — creating a flickering/overwriting UX.

**Why it happens:** No explicit disabled state management.

**How to avoid:** Disable both buttons (`hintBtn.disabled = true; fullBtn.disabled = true`) at the start of the click handler. Only re-enable on error (to allow retry). Leave disabled after success.

**Warning signs:** Two different responses flashing in sequence; extra API credits consumed.

---

### Pitfall 5: Dialog Not Appearing Because `SHOW_WRONG_SUBMISSION` Message Is Dropped

**What goes wrong:** If `content-toast.js` is not yet loaded when `background.js` sends `SHOW_WRONG_SUBMISSION` (e.g., the page is still loading), `chrome.tabs.sendMessage` throws and the message is silently swallowed by the `try/catch` in `notifyTab()`.

**Why it happens:** `notifyTab()` already has a `try/catch` that swallows all send errors (by design — the tab may have navigated away). If content-toast.js hasn't mounted yet, the message is lost.

**How to avoid:** Content-toast.js uses `run_at: document_end` in manifest.json — it loads after the DOM is ready. The submission check flow happens after the LeetCode submission API responds (which takes at least 1-3 seconds), by which time `document_end` will have fired. This timing is the same as the existing `SHOW_RATING` flow, which works correctly. No change needed. But verify the message timing in testing.

**Warning signs:** Wrong submission captured (confirmed in IndexedDB) but no dialog appears.

---

## Code Examples

Verified patterns from direct codebase inspection:

### Full showWrongSubmissionDialog() Skeleton

```javascript
// Source: direct codebase inspection — follows showRatingDialog pattern exactly
function showWrongSubmissionDialog(submissionId, titleSlug, title) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'leetreminder-toast-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .overlay {
      all: initial; display: flex; align-items: center; justify-content: center;
      position: fixed; inset: 0; background: rgba(0,0,0,0.4);
      z-index: 2147483647; font-family: system-ui, -apple-system, sans-serif;
    }
    .dialog {
      background: #282828; color: #e0e0e0; border-radius: 12px;
      padding: 24px 28px; max-width: 420px; width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5); text-align: center;
    }
    .dialog-title { font-size: 15px; font-weight: 600; margin-bottom: 6px; color: #e05c5c; }
    .dialog-problem {
      font-size: 13px; color: #a0a0a0; margin-bottom: 18px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .ai-buttons { display: flex; gap: 8px; justify-content: center; }
    .ai-btn {
      all: initial; display: inline-block; padding: 8px 18px; border-radius: 6px;
      font-family: system-ui, sans-serif; font-size: 13px; font-weight: 500;
      cursor: pointer; color: #fff; box-sizing: border-box; transition: opacity 0.15s;
    }
    .ai-btn:hover:not(:disabled) { opacity: 0.85; }
    .ai-btn:disabled { opacity: 0.4; cursor: default; }
    .ai-btn.hint { background: #7c6af7; }
    .ai-btn.full  { background: #4caf50; }
    .loading { color: #888; font-size: 13px; margin-top: 12px; display: none; }
    .feedback-area {
      margin-top: 12px; text-align: left; max-height: 300px;
      overflow-y: auto; font-size: 13px; color: #d0d0d0;
    }
    .feedback-area p { margin: 6px 0; white-space: pre-wrap; line-height: 1.5; }
    .feedback-area pre {
      background: #1e1e1e; border-radius: 6px; padding: 10px;
      overflow-x: auto; font-family: monospace; font-size: 12px;
      color: #ce9178; margin: 8px 0;
    }
    .error-msg { color: #e05c5c; font-size: 13px; margin-top: 12px; }
    .skip-btn {
      all: initial; display: inline-block; margin-top: 14px; padding: 4px 8px;
      font-family: system-ui, sans-serif; font-size: 12px; color: #666; cursor: pointer;
    }
    .skip-btn:hover { color: #999; }
  `;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const dialog = document.createElement('div');
  dialog.className = 'dialog';

  const titleEl = document.createElement('div');
  titleEl.className = 'dialog-title';
  titleEl.textContent = 'Wrong Submission';

  const problemEl = document.createElement('div');
  problemEl.className = 'dialog-problem';
  problemEl.textContent = title || titleSlug.replace(/-/g, ' ');

  const buttonsEl = document.createElement('div');
  buttonsEl.className = 'ai-buttons';

  const hintBtn = document.createElement('button');
  hintBtn.className = 'ai-btn hint';
  hintBtn.textContent = 'Hint';

  const fullBtn = document.createElement('button');
  fullBtn.className = 'ai-btn full';
  fullBtn.textContent = 'Full Solution';

  buttonsEl.appendChild(hintBtn);
  buttonsEl.appendChild(fullBtn);

  const loadingEl = document.createElement('div');
  loadingEl.className = 'loading';

  const feedbackArea = document.createElement('div');
  feedbackArea.className = 'feedback-area';

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'skip-btn';
  dismissBtn.textContent = 'Dismiss';
  dismissBtn.addEventListener('click', function () { host.remove(); });

  function requestFeedback(mode) {
    hintBtn.disabled = true;
    fullBtn.disabled = true;
    loadingEl.textContent = mode === 'hint' ? 'Getting hint...' : 'Getting full solution...';
    loadingEl.style.display = 'block';
    feedbackArea.innerHTML = '';

    chrome.runtime.sendMessage(
      { type: 'GET_AI_FEEDBACK', payload: { submissionId, mode } },
      function (response) {
        loadingEl.style.display = 'none';

        if (chrome.runtime.lastError) {
          renderError(feedbackArea, 'Connection lost — please try again');
          hintBtn.disabled = false;
          fullBtn.disabled = false;
          return;
        }
        if (!response) {
          renderError(feedbackArea, 'No response received — please try again');
          hintBtn.disabled = false;
          fullBtn.disabled = false;
          return;
        }
        if (response.error) {
          renderError(feedbackArea, response.error);
          hintBtn.disabled = false;
          fullBtn.disabled = false;
          return;
        }

        renderFeedback(feedbackArea, response.feedback);
      }
    );
  }

  hintBtn.addEventListener('click', function () { requestFeedback('hint'); });
  fullBtn.addEventListener('click', function () { requestFeedback('full'); });

  dialog.appendChild(titleEl);
  dialog.appendChild(problemEl);
  dialog.appendChild(buttonsEl);
  dialog.appendChild(loadingEl);
  dialog.appendChild(feedbackArea);
  dialog.appendChild(dismissBtn);
  overlay.appendChild(dialog);

  shadow.appendChild(style);
  shadow.appendChild(overlay);

  // Only dismiss on explicit button — backdrop click does NOT dismiss
  // (user needs to read the AI response without accidental dismissal)
}
```

### Minimal Markdown Renderer (no innerHTML on API text)

```javascript
// Source: safe DOM construction — no external library, no innerHTML on API data
function renderFeedback(container, text) {
  container.innerHTML = ''; // safe: resets our own element
  const segments = text.split(/(```[\s\S]*?```)/g);
  for (const seg of segments) {
    if (seg.startsWith('```') && seg.endsWith('```')) {
      const inner = seg.slice(3, -3);
      const firstNewline = inner.indexOf('\n');
      const code = firstNewline >= 0 ? inner.slice(firstNewline + 1) : inner;
      const pre = document.createElement('pre');
      pre.textContent = code.trimEnd(); // textContent — XSS-safe
      container.appendChild(pre);
    } else if (seg.trim()) {
      const p = document.createElement('p');
      p.textContent = seg; // textContent — XSS-safe
      container.appendChild(p);
    }
  }
}

function renderError(container, message) {
  container.innerHTML = '';
  const el = document.createElement('div');
  el.className = 'error-msg';
  el.textContent = message; // message is our own string
  container.appendChild(el);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `showToast()` auto-dismiss for wrong submissions | `showWrongSubmissionDialog()` persistent dialog | Phase 5 | User can read AI response without time pressure |
| `SHOW_TOAST` message for non-Accepted | `SHOW_WRONG_SUBMISSION` with `submissionId` | Phase 4 (already done) | Phase 5 receives the submission ID it needs |
| No AI feedback in extension | "Hint" and "Full Solution" from OpenRouter via background | Phase 4 backend + Phase 5 UI | New feature |

**Phase 4 is complete.** The following already exist and must not be rebuilt:
- `GET_AI_FEEDBACK` handler in background.js
- `callOpenRouter()` function
- `buildPrompt()` with hint/full modes
- `getSubmissionById()` IDB helper
- `SHOW_WRONG_SUBMISSION` sent from `saveSubmission()` with `submissionId`
- `host_permissions` entry for `openrouter.ai`

---

## Open Questions

1. **Backdrop click: dismiss or not?**
   - What we know: `showRatingDialog` dismisses on backdrop click; a feedback dialog with content the user is reading may be accidentally dismissed
   - What's unclear: User preference; whether this causes UX friction
   - Recommendation: Do NOT dismiss on backdrop click for the wrong-submission dialog. Only the explicit "Dismiss" button closes it. This is a trivial omission from the implementation — just don't add the `overlay.addEventListener('click')` handler.

2. **Dialog max-width: 360px (same as rating) or wider for code blocks?**
   - What we know: The existing `.dialog` is `max-width: 360px`. Code blocks in "Full Solution" responses often have 60-80 character lines that overflow this width.
   - What's unclear: Target screen resolution; whether horizontal scroll on `<pre>` is acceptable
   - Recommendation: Widen the wrong-submission dialog to `max-width: 480px` or `max-width: 560px`. The `pre` element should still have `overflow-x: auto` for very long lines. This is a CSS-only change, no functional impact.

3. **Re-enable buttons after error: yes or no?**
   - What we know: Re-enabling after error allows retry (good UX for transient failures). Keeping them disabled after any state means the user must dismiss and re-trigger a wrong submission.
   - What's unclear: Whether users will encounter errors frequently enough to need retry
   - Recommendation: Re-enable both buttons after any error response. Leave them disabled after a successful response (to prevent burning extra API credits on the same submission).

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treat as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — no test infrastructure exists in this project |
| Config file | None |
| Quick run command | Manual: reload extension in chrome://extensions, submit wrong answer on LeetCode |
| Full suite command | Manual verification per success criteria checklist below |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AIFB-01 | Wrong submission shows persistent dialog with "Hint" and "Full Solution" buttons | manual-smoke | Reload extension, submit wrong answer, verify dialog appears with both buttons | ❌ no automated test infrastructure |
| AIFB-02 | "Hint" button returns a nudge without revealing algorithm or code | manual | Click "Hint", verify loading state appears, then text response without code blocks | ❌ |
| AIFB-03 | "Full Solution" button returns explanation and code | manual | Click "Full Solution", verify loading state, then response includes code block rendered in `<pre>` | ❌ |
| AIFB-04 | AI response appears inline in dialog (no popup, no new tab) | manual | Verify response renders in the dialog's `.feedback-area`; no new window opened | ❌ |
| Regression | Accepted submission still shows FSRS rating dialog | manual | Submit accepted answer, verify `showRatingDialog` fires, not `showWrongSubmissionDialog` | ❌ |
| No-key error | No OpenRouter API key → inline error message | manual | Clear API key in Settings, submit wrong answer, click Hint, verify error message in dialog | ❌ |
| lastError guard | Worker disconnection handled gracefully | manual | Difficult to trigger reliably in manual testing; inspect code review instead | ❌ |

### Manual Verification Protocol

1. **AIFB-01 (dialog appears):** Load extension, navigate to a LeetCode problem, submit a deliberately wrong answer. Confirm: auto-dismiss toast is GONE; a persistent dialog appears with problem title, "Hint" and "Full Solution" buttons, and a "Dismiss" link.

2. **AIFB-02 (hint mode):** Click "Hint" in the dialog. Confirm: buttons become disabled; "Getting hint..." loading text appears; within ~5 seconds, the loading text disappears and a text response appears in the feedback area; the response is a Socratic question or nudge with no code blocks and no algorithm name revealed.

3. **AIFB-03 (full solution):** Dismiss and re-trigger with a new wrong submission (or click "Full Solution" after a fresh open). Click "Full Solution". Confirm: loading state; within ~5 seconds, response appears with code block(s) rendered in `<pre>` elements (monospace, dark background).

4. **AIFB-04 (inline rendering):** Confirm the response appears in the dialog on the LeetCode page itself. No extension popup opened. No new tab.

5. **Regression (accepted not broken):** Submit an accepted answer. Confirm the FSRS rating dialog appears (not the wrong submission dialog). Click a rating. Confirm it still works.

6. **No API key:** In Settings, delete the OpenRouter API key. Submit a wrong answer. Click either AI button. Confirm the error "No API key configured. Add your OpenRouter API key in Settings." appears inline in the dialog's feedback area. No crash.

7. **Dismiss behavior:** Confirm "Dismiss" button closes the dialog. Confirm clicking outside the dialog (on the backdrop) does NOT close it (if backdrop-dismiss is omitted per recommendation above).

### Wave 0 Gaps

None — existing `content-toast.js` infrastructure (Shadow DOM pattern, `removeHost`, `chrome.runtime.sendMessage`, `chrome.runtime.lastError`) covers all needs. No new test infrastructure is required beyond what doesn't exist. Manual verification protocol above is the complete acceptance gate.

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection: `extension/content-toast.js` (full file, 359 lines) — Shadow DOM pattern, existing message listener, `showRatingDialog` structure, `removeHost` implementation
- Direct codebase inspection: `extension/background.js` (full file, 755 lines) — `GET_AI_FEEDBACK` handler confirmed live at lines 108-145; `SHOW_WRONG_SUBMISSION` confirmed sent with `submissionId` at lines 427-434; `callOpenRouter`, `buildPrompt`, `getSubmissionById` all confirmed implemented
- `.planning/phases/04-api-integration/04-01-SUMMARY.md` — Phase 4 confirmed complete; all API-01, API-02, API-03 requirements satisfied; no deviations from plan
- `.planning/STATE.md` — confirms decisions: non-streaming response, loading spinner acceptable, wrong-submission dialog replaces auto-dismiss toast, accepted submission rating dialog unchanged

### Secondary (MEDIUM confidence)

- `.planning/research/ARCHITECTURE.md` (v1.1 section) — documents `showWrongSubmissionDialog` design intent and `SHOW_WRONG_SUBMISSION` payload; note this document still references `api.anthropic.com` but the actual implementation uses OpenRouter (Phase 4 corrected this)
- Chrome extension content script docs — `chrome.runtime.lastError` check pattern in sendMessage callbacks is a documented requirement

### Tertiary (LOW confidence)

- None — all critical findings are from direct source inspection (highest confidence)

---

## Metadata

**Confidence breakdown:**
- What Phase 4 implemented: HIGH — direct source file inspection confirms everything
- Shadow DOM UI pattern: HIGH — `showRatingDialog` is a verified working template in the same file
- Markdown rendering approach: HIGH — `textContent` + code fence splitter is a standard safe pattern; no library needed
- Pitfalls: HIGH — derived from codebase patterns and Chrome extension documented behavior

**Research date:** 2026-03-14
**Valid until:** 2026-04-14 (stable Chrome extension APIs; no external library dependencies; no OpenRouter changes affect this phase)

---

*Research for: Phase 5 Wrong Submission Dialog — content-toast.js UI only, backend fully complete in Phase 4*
*Researched: 2026-03-14*
