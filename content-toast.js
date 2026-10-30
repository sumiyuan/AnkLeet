// AnkLeet — Toast & Rating Dialog (content-toast.js)
// World: ISOLATED (default) — runs at document_end so document.body is ready.
// Shows a brief toast for wrong submissions, or a rating dialog for accepted ones.
// Shadow DOM prevents LeetCode's styles from bleeding in.
// LR_TOKENS and lrPrepareHost come from content-theme.js, loaded just before this file.

const LR_SVG_CLOSE = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
const LR_SVG_CHECK = '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.5l3 3 6-7" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function lrPlural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

/**
 * Shows a temporary toast notification in the bottom-right corner.
 * Auto-dismisses after ~2 seconds with a fade transition.
 */
function showToast(message) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'ankleet-toast-host';
  lrPrepareHost(host);
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = LR_TOKENS + `
    .toast {
      all: initial;
      display: block;
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--lr-bg-surface);
      color: var(--lr-text-primary);
      border: 1px solid var(--lr-border);
      padding: 10px 14px;
      border-radius: var(--lr-radius-panel);
      font-family: var(--lr-font);
      font-size: 14px;
      line-height: 20px;
      z-index: 2147483647;
      opacity: 1;
      transform: translateY(0);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
      box-shadow: var(--lr-shadow);
    }
    .toast.fade {
      opacity: 0;
      transform: translateY(6px);
    }
  `;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.textContent = message;

  shadow.appendChild(style);
  shadow.appendChild(toast);

  setTimeout(function () {
    toast.classList.add('fade');
    setTimeout(function () { host.remove(); }, 300);
  }, 2000);
}

/**
 * Shows a rating dialog for the user to rate how the review went.
 * Sends RATE_REVIEW to the background when a button is clicked.
 * nextIntervals: { Again, Hard, Good, Easy } in days, shown on each button.
 */
function showRatingDialog(titleSlug, title, nextIntervals) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'ankleet-toast-host';
  lrPrepareHost(host);
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = LR_TOKENS + `
    .overlay {
      all: initial;
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      inset: 0;
      background: var(--lr-scrim);
      z-index: 2147483647;
      font-family: var(--lr-font);
      animation: overlay-in 0.15s ease;
    }
    @keyframes overlay-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .dialog {
      background: var(--lr-bg-surface);
      color: var(--lr-text-primary);
      border: 1px solid var(--lr-border);
      border-radius: var(--lr-radius-panel);
      padding: 20px;
      width: min(400px, calc(100vw - 32px));
      box-shadow: var(--lr-shadow);
      animation: dialog-in 0.2s ease-out;
    }
    @keyframes dialog-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .status {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      line-height: 18px;
      font-weight: 500;
      color: var(--lr-success);
    }
    .dialog-problem {
      margin: 4px 0 0;
      font-size: 18px;
      line-height: 24px;
      font-weight: 600;
      letter-spacing: -0.01em;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dialog-prompt {
      margin: 16px 0 10px;
      font-size: 14px;
      line-height: 20px;
      color: var(--lr-text-secondary);
    }
    /* One continuous rating bar, the same as the popup's review list:
       each section lights up red, orange, green or blue on hover */
    .rating-buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      background: var(--lr-bg-elevated);
      border-radius: 12px;
      overflow: hidden;
    }
    .rating-btn {
      all: initial;
      --rating: var(--lr-text-primary);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1px;
      padding: 8px 0 7px;
      background: transparent;
      border-radius: 0;
      font-family: var(--lr-font);
      color: var(--lr-text-primary);
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }
    .rating-btn[data-rating="Again"] { --rating: var(--lr-rate-again); }
    .rating-btn[data-rating="Hard"]  { --rating: var(--lr-rate-hard); }
    .rating-btn[data-rating="Good"]  { --rating: var(--lr-rate-good); }
    .rating-btn[data-rating="Easy"]  { --rating: var(--lr-rate-easy); }
    .rating-btn + .rating-btn { border-left: 1px solid var(--lr-border); }
    .rating-btn:hover,
    .rating-btn:focus-visible { background: color-mix(in srgb, var(--rating) 26%, transparent); }
    .rating-btn .rating-name { color: var(--rating); }
    .rating-btn:active { background: color-mix(in srgb, var(--rating) 38%, transparent); }
    .rating-btn:focus-visible { outline: none; }
    .rating-btn:disabled { opacity: 0.45; cursor: default; background: transparent; }
    .rating-name { font-size: 14px; line-height: 20px; font-weight: 600; transition: color 0.15s; }
    .rating-gap {
      font-size: 12px;
      line-height: 16px;
      color: var(--lr-text-secondary);
      font-variant-numeric: tabular-nums;
    }
    .footer-actions {
      display: flex;
      justify-content: space-between;
      margin-top: 14px;
    }
    .skip-btn,
    .remove-btn {
      all: initial;
      display: inline-block;
      padding: 4px 0;
      font-family: var(--lr-font);
      font-size: 13px;
      line-height: 18px;
      color: var(--lr-text-secondary);
      cursor: pointer;
      text-decoration: underline;
      text-decoration-color: transparent;
      text-underline-offset: 3px;
      transition: color 0.15s, text-decoration-color 0.15s;
    }
    .skip-btn:hover { color: var(--lr-text-primary); text-decoration-color: currentColor; }
    .remove-btn:hover { color: var(--lr-error); text-decoration-color: currentColor; }
    .skip-btn:focus-visible,
    .remove-btn:focus-visible { outline: 2px solid var(--lr-hue); outline-offset: 2px; }
    .skip-btn:disabled,
    .remove-btn:disabled {
      opacity: 0.45;
      cursor: default;
    }
    @media (prefers-reduced-motion: reduce) {
      .overlay, .dialog { animation: none; }
    }
  `;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const dialog = document.createElement('div');
  dialog.className = 'dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'lr-dialog-problem');

  const statusEl = document.createElement('div');
  statusEl.className = 'status';
  statusEl.innerHTML = LR_SVG_CHECK;
  statusEl.appendChild(document.createTextNode('Accepted'));

  const problemEl = document.createElement('h2');
  problemEl.className = 'dialog-problem';
  problemEl.id = 'lr-dialog-problem';
  const displayTitle = title || titleSlug.replace(/-/g, ' ');
  problemEl.textContent = displayTitle;

  const promptEl = document.createElement('p');
  promptEl.className = 'dialog-prompt';
  promptEl.textContent = 'How hard was it to solve? Your rating sets the next review.';

  const buttonsEl = document.createElement('div');
  buttonsEl.className = 'rating-buttons';

  const gaps = nextIntervals || {};
  const ratings = ['Again', 'Hard', 'Good', 'Easy'];
  for (const rating of ratings) {
    const btn = document.createElement('button');
    btn.className = 'rating-btn';
    btn.dataset.rating = rating;

    const nameEl = document.createElement('span');
    nameEl.className = 'rating-name';
    nameEl.textContent = rating;
    btn.appendChild(nameEl);
    if (gaps[rating] != null) {
      const gapEl = document.createElement('span');
      gapEl.className = 'rating-gap';
      gapEl.textContent = lrPlural(gaps[rating], 'day');
      btn.appendChild(gapEl);
      btn.setAttribute('aria-label', rating + ', next review in ' + lrPlural(gaps[rating], 'day'));
    }

    btn.addEventListener('click', function () {
      // Disable all buttons
      buttonsEl.querySelectorAll('.rating-btn').forEach(function (b) { b.disabled = true; });
      skipBtn.disabled = true;

      chrome.runtime.sendMessage(
        { type: 'RATE_REVIEW', payload: { titleSlug: titleSlug, rating: rating } },
        function (response) {
          // Dismiss the rating dialog immediately
          host.remove();

          // Show a small confirmation toast in the bottom-right
          var nextDateLabel = '';
          if (response && response.nextDue) {
            var dueDate = new Date(response.nextDue);
            var now = new Date();
            var todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            var dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            var diffDays = Math.round((dueStart - todayStart) / (1000 * 60 * 60 * 24));
            if (diffDays <= 1) {
              nextDateLabel = 'tomorrow';
            } else {
              nextDateLabel = dueDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            }
          }
          showConfirmationToast(nextDateLabel, 'Rated ' + rating);
        }
      );
    });
    buttonsEl.appendChild(btn);
  }

  const footerEl = document.createElement('div');
  footerEl.className = 'footer-actions';

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = "Don't review this problem";
  removeBtn.addEventListener('click', function () {
    if (!confirm("Remove this problem from your review schedule? You won't be prompted to review it again.")) return;
    buttonsEl.querySelectorAll('.rating-btn').forEach(function (b) { b.disabled = true; });
    skipBtn.disabled = true;
    removeBtn.disabled = true;
    chrome.runtime.sendMessage(
      { type: 'REMOVE_CARD', payload: { titleSlug: titleSlug } },
      function () {
        host.remove();
        showConfirmationToast('', 'Removed from reviews');
      }
    );
  });

  const skipBtn = document.createElement('button');
  skipBtn.className = 'skip-btn';
  skipBtn.textContent = 'Rate later';
  skipBtn.addEventListener('click', function () {
    host.remove();
  });

  footerEl.appendChild(removeBtn);
  footerEl.appendChild(skipBtn);

  dialog.appendChild(statusEl);
  dialog.appendChild(problemEl);
  dialog.appendChild(promptEl);
  dialog.appendChild(buttonsEl);
  dialog.appendChild(footerEl);
  overlay.appendChild(dialog);

  shadow.appendChild(style);
  shadow.appendChild(overlay);

  // Close on overlay click (outside dialog) or Escape
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) host.remove();
  });
  overlay.addEventListener('keydown', function (e) {
    e.stopPropagation(); // keep LeetCode's shortcuts out of the dialog
    if (e.key === 'Escape') host.remove();
  });
  buttonsEl.querySelector('[data-rating="Good"]').focus();
}

/**
 * Shows a small confirmation toast in the bottom-right corner
 * after a successful rating. Auto-dismisses after ~5 seconds.
 */
function showConfirmationToast(nextDateLabel, mainLabel) {
  var toastHost = document.createElement('div');
  toastHost.id = 'ankleet-confirm-host';
  lrPrepareHost(toastHost);
  document.body.appendChild(toastHost);

  var shadow = toastHost.attachShadow({ mode: 'closed' });

  var style = document.createElement('style');
  style.textContent = LR_TOKENS + `
    .confirm-toast {
      all: initial;
      display: flex;
      align-items: center;
      gap: 8px;
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--lr-bg-surface);
      color: var(--lr-text-primary);
      border: 1px solid var(--lr-border);
      padding: 10px 14px;
      border-radius: var(--lr-radius-panel);
      font-family: var(--lr-font);
      font-size: 14px;
      line-height: 20px;
      z-index: 2147483647;
      box-shadow: var(--lr-shadow);
      opacity: 0;
      transform: translateY(8px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    }
    .confirm-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    .confirm-toast.fade {
      opacity: 0;
      transform: translateY(4px);
    }
    .check {
      display: inline-flex;
      color: var(--lr-success);
      flex-shrink: 0;
    }
    .label {
      font-weight: 500;
    }
    .next-date {
      color: var(--lr-text-secondary);
    }
  `;

  var toast = document.createElement('div');
  toast.className = 'confirm-toast';
  toast.setAttribute('role', 'status');

  var check = document.createElement('span');
  check.className = 'check';
  check.innerHTML = LR_SVG_CHECK;

  var label = document.createElement('span');
  label.className = 'label';
  label.textContent = mainLabel || 'Review saved';

  toast.appendChild(check);
  toast.appendChild(label);

  if (nextDateLabel) {
    var dateSpan = document.createElement('span');
    dateSpan.className = 'next-date';
    dateSpan.textContent = 'Next review ' + nextDateLabel;
    toast.appendChild(dateSpan);
  }

  shadow.appendChild(style);
  shadow.appendChild(toast);

  // Trigger enter animation
  requestAnimationFrame(function () {
    toast.classList.add('show');
  });

  setTimeout(function () {
    toast.classList.add('fade');
    toast.classList.remove('show');
    setTimeout(function () { toastHost.remove(); }, 300);
  }, 5000);
}

/**
 * Removes any existing toast/dialog host element.
 */
function removeHost() {
  document.getElementById('ankleet-toast-host')?.remove();
}

/**
 * If the page was opened via a review link (?ankleet=review),
 * blur the code editor until the user clicks "Show my code".
 * Polls for the Monaco editor to mount.
 */
function maybeBlurEditor() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('ankleet') !== 'review') return;

  // Clean up the param so refreshing doesn't re-trigger
  params.delete('ankleet');
  const cleanSearch = params.toString();
  const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
  history.replaceState(null, '', cleanUrl);

  const BLUR_HOST_ID = 'ankleet-blur-host';

  function applyBlur(editorEl) {
    // Don't double-apply
    if (document.getElementById(BLUR_HOST_ID)) return;

    const host = document.createElement('div');
    host.id = BLUR_HOST_ID;
    lrPrepareHost(host);
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = LR_TOKENS + `
      .blur-overlay {
        all: initial;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: absolute;
        inset: 0;
        background: color-mix(in srgb, var(--lr-bg-surface) 70%, transparent);
        /* The blur is the feature: it hides the old solution. taste-skill-ignore */
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px); /* taste-skill-ignore */
        z-index: 10;
        font-family: var(--lr-font);
        text-align: center;
        padding: 0 24px;
      }
      .blur-message {
        color: var(--lr-text-primary);
        font-size: 16px;
        line-height: 22px;
        font-weight: 600;
      }
      .blur-note {
        margin: 4px 0 16px;
        color: var(--lr-text-secondary);
        font-size: 14px;
        line-height: 20px;
        max-width: 320px;
      }
      .reveal-btn {
        all: initial;
        display: inline-flex;
        align-items: center;
        height: 36px;
        padding: 0 14px;
        border-radius: var(--lr-radius-btn);
        border: 1px solid var(--lr-border-focus);
        background: var(--lr-bg-surface);
        color: var(--lr-text-primary);
        font-family: var(--lr-font);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: border-color 0.15s, transform 0.1s;
      }
      .reveal-btn:hover { border-color: var(--lr-text-primary); }
      .reveal-btn:active { transform: translateY(1px); }
      .reveal-btn:focus-visible { outline: 2px solid var(--lr-hue); outline-offset: 2px; }
    `;

    const overlay = document.createElement('div');
    overlay.className = 'blur-overlay';

    const msg = document.createElement('div');
    msg.className = 'blur-message';
    msg.textContent = 'Your last solution is hidden';

    const note = document.createElement('div');
    note.className = 'blur-note';
    note.textContent = 'Reset the editor and solve it from scratch. Reveal it only if you get stuck.';

    const btn = document.createElement('button');
    btn.className = 'reveal-btn';
    btn.textContent = 'Show my code';
    btn.addEventListener('click', function () {
      host.remove();
    });

    overlay.appendChild(msg);
    overlay.appendChild(note);
    overlay.appendChild(btn);
    shadow.appendChild(style);
    shadow.appendChild(overlay);

    // Insert overlay as a child positioned over the editor
    editorEl.style.position = 'relative';
    editorEl.appendChild(host);
    host.style.position = 'absolute';
    host.style.inset = '0';
    host.style.zIndex = '10';
  }

  // Wait for the Monaco editor container to appear
  let attempts = 0;
  const maxAttempts = 50; // ~10 seconds

  function tryFind() {
    const editor = document.querySelector('.monaco-editor')?.closest('[class*="editor"]')?.parentElement
      || document.querySelector('.monaco-editor')?.parentElement;
    if (editor) {
      applyBlur(editor);
      return;
    }
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(tryFind, 200);
    }
  }

  // Start looking once DOM is interactive
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryFind);
  } else {
    tryFind();
  }
}

maybeBlurEditor();

/**
 * Minimal safe markdown renderer — splits on triple-backtick code fences.
 * All text is set via textContent to prevent XSS with API-sourced content.
 */
function renderFeedback(container, text) {
  container.innerHTML = '';
  const parts = text.split(/(```[\s\S]*?```)/g);
  for (const part of parts) {
    if (part.startsWith('```')) {
      // Code fence: strip opening line (language tag) and closing fence
      const body = part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
      const pre = document.createElement('pre');
      pre.textContent = body;
      container.appendChild(pre);
    } else if (part.trim()) {
      const p = document.createElement('p');
      p.textContent = part;
      container.appendChild(p);
    }
  }
}

/**
 * Renders an inline error message into the given container.
 */
function renderError(container, message) {
  container.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'error-msg';
  div.textContent = message;
  container.appendChild(div);
}

/**
 * Extracts the user's current code from LeetCode's Monaco editor.
 * Sends a postMessage to content-main.js (MAIN world) which has access
 * to the monaco.editor API, and receives the code back via postMessage.
 */
function extractEditorCode() {
  return new Promise(function (resolve) {
    var reqId = 'lr-code-' + Date.now();
    var resolved = false;

    function handler(event) {
      if (event.data && event.data.source === 'ankleet' &&
          event.data.type === 'editor-code' && event.data.reqId === reqId) {
        resolved = true;
        window.removeEventListener('message', handler);
        resolve(event.data.code || '');
      }
    }
    window.addEventListener('message', handler);

    window.postMessage({
      source: 'ankleet',
      type: 'request-code',
      reqId: reqId
    }, '*');

    setTimeout(function () {
      if (!resolved) {
        window.removeEventListener('message', handler);
        resolve('');
      }
    }, 300);
  });
}

/**
 * Shows a persistent dialog after a wrong LeetCode submission.
 * Provides Hint and Full Solution buttons that call GET_AI_FEEDBACK.
 */
function showWrongSubmissionDialog(submissionId, titleSlug, title) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'ankleet-toast-host';
  lrPrepareHost(host);
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = LR_TOKENS + `
    .panel {
      all: initial;
      display: flex;
      flex-direction: column;
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: min(380px, calc(100vw - 48px));
      max-height: min(520px, calc(100vh - 48px));
      background: var(--lr-bg-surface);
      color: var(--lr-text-primary);
      border: 1px solid var(--lr-border);
      border-radius: var(--lr-radius-panel);
      box-shadow: var(--lr-shadow);
      z-index: 2147483647;
      font-family: var(--lr-font);
      overflow: hidden;
      animation: panel-in 0.2s ease-out;
    }
    @keyframes panel-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px 0;
    }
    .panel-head-text { min-width: 0; }
    .panel-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      line-height: 18px;
      font-weight: 500;
      color: var(--lr-error);
    }
    .panel-title::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
    }
    .panel-problem {
      margin-top: 2px;
      font-size: 16px;
      line-height: 22px;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .close-btn {
      all: initial;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      margin: -2px -4px 0 0;
      border-radius: var(--lr-radius-sm);
      color: var(--lr-text-secondary);
      cursor: pointer;
      flex-shrink: 0;
      transition: color 0.15s, background 0.15s;
    }
    .close-btn:hover {
      color: var(--lr-text-primary);
      background: var(--lr-bg-elevated);
    }
    .close-btn:focus-visible { outline: 2px solid var(--lr-hue); outline-offset: 2px; }
    .panel-body {
      padding: 12px 16px 16px;
      overflow-y: auto;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: var(--lr-border) transparent;
    }
    .panel-lead {
      font-size: 14px;
      line-height: 20px;
      color: var(--lr-text-secondary);
      margin: 0 0 12px;
    }
    .ai-buttons {
      display: flex;
      gap: 8px;
    }
    .ai-btn {
      all: initial;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      padding: 0 14px;
      border-radius: var(--lr-radius-btn);
      border: 1px solid var(--lr-border-focus);
      background: var(--lr-bg-surface);
      color: var(--lr-text-primary);
      font-family: var(--lr-font);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s, transform 0.1s;
    }
    .ai-btn:hover:not(:disabled) { border-color: var(--lr-text-primary); }
    .ai-btn:active:not(:disabled) { transform: translateY(1px); }
    .ai-btn:focus-visible { outline: 2px solid var(--lr-hue); outline-offset: 2px; }
    .ai-btn:disabled { opacity: 0.45; cursor: default; transform: none; }
    .ai-btn.hint {
      background: var(--lr-primary);
      border-color: var(--lr-primary);
      color: var(--lr-on-primary);
    }
    .ai-btn.hint:hover:not(:disabled) { background: var(--lr-primary-hover); border-color: var(--lr-primary-hover); }

    /* ── Loading (matches chat panel) ── */
    .loading {
      display: none;
      align-items: center;
      gap: 8px;
      margin-top: 14px;
      font-size: 13px;
      color: var(--lr-text-secondary);
      font-family: var(--lr-font);
    }
    .loading-dots {
      display: flex;
      gap: 3px;
    }
    .loading-dots span {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: currentColor;
      animation: dot-pulse 1.2s ease-in-out infinite;
    }
    .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
    .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes dot-pulse {
      0%, 60%, 100% { opacity: 0.25; }
      30% { opacity: 1; }
    }

    .feedback-area {
      text-align: left;
      margin-top: 14px;
    }
    .feedback-area:empty { display: none; }
    .feedback-area p {
      white-space: pre-wrap;
      line-height: 21px;
      margin: 0 0 10px 0;
      font-size: 14px;
      color: var(--lr-text-primary);
    }
    .feedback-area pre {
      background: var(--lr-code-bg);
      overflow-x: auto;
      font-family: var(--lr-font-mono);
      font-size: 12.5px;
      line-height: 19px;
      color: var(--lr-text-primary);
      padding: 12px 14px;
      border-radius: var(--lr-radius-btn);
      margin: 0 0 10px 0;
      white-space: pre;
      border: 1px solid var(--lr-border);
    }
    .error-msg {
      color: var(--lr-error);
      font-size: 13px;
      line-height: 18px;
      text-align: left;
      font-family: var(--lr-font);
    }
    @media (prefers-reduced-motion: reduce) {
      .panel, .loading-dots span { animation: none; }
    }
  `;

  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'lr-panel-problem');

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header';

  const headerLeft = document.createElement('div');
  headerLeft.className = 'panel-head-text';
  const titleEl = document.createElement('div');
  titleEl.className = 'panel-title';
  titleEl.textContent = 'Not accepted';
  const problemEl = document.createElement('div');
  problemEl.className = 'panel-problem';
  problemEl.id = 'lr-panel-problem';
  problemEl.textContent = title || titleSlug.replace(/-/g, ' ');
  headerLeft.appendChild(titleEl);
  headerLeft.appendChild(problemEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = LR_SVG_CLOSE;
  closeBtn.addEventListener('click', function () { host.remove(); });

  header.appendChild(headerLeft);
  header.appendChild(closeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'panel-body';

  const leadEl = document.createElement('p');
  leadEl.className = 'panel-lead';
  leadEl.textContent = 'A hint asks a question about your code; the solution explains the whole approach.';

  const buttonsEl = document.createElement('div');
  buttonsEl.className = 'ai-buttons';

  const hintBtn = document.createElement('button');
  hintBtn.className = 'ai-btn hint';
  hintBtn.textContent = 'Get a hint';

  const fullBtn = document.createElement('button');
  fullBtn.className = 'ai-btn full';
  fullBtn.textContent = 'Show the solution';

  buttonsEl.appendChild(hintBtn);
  buttonsEl.appendChild(fullBtn);

  const loadingEl = document.createElement('div');
  loadingEl.className = 'loading';
  loadingEl.setAttribute('role', 'status');
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'loading-dots';
  for (let i = 0; i < 3; i++) dotsContainer.appendChild(document.createElement('span'));
  loadingEl.appendChild(dotsContainer);
  const loadingText = document.createElement('span');
  loadingEl.appendChild(loadingText);

  const feedbackArea = document.createElement('div');
  feedbackArea.className = 'feedback-area';

  body.appendChild(leadEl);
  body.appendChild(buttonsEl);
  body.appendChild(loadingEl);
  body.appendChild(feedbackArea);

  panel.appendChild(header);
  panel.appendChild(body);

  shadow.appendChild(style);
  shadow.appendChild(panel);

  function requestFeedback(mode) {
    hintBtn.disabled = true;
    fullBtn.disabled = true;
    loadingEl.style.display = 'flex';
    loadingText.textContent = mode === 'hint' ? 'Writing a hint' : 'Writing the solution';
    feedbackArea.innerHTML = '';

    // Extract current editor code via content-main.js (MAIN world), then send feedback request
    extractEditorCode().then(function (userCode) {
      chrome.runtime.sendMessage(
        { type: 'GET_AI_FEEDBACK', payload: { submissionId: submissionId, mode: mode, userCode: userCode } },
        function (response) {
          loadingEl.style.display = 'none';
          if (chrome.runtime.lastError) {
            hintBtn.disabled = false;
            fullBtn.disabled = false;
            renderError(feedbackArea, 'Lost the connection to AnkLeet. Reload the page and try again.');
            return;
          }
          if (!response) {
            hintBtn.disabled = false;
            fullBtn.disabled = false;
            renderError(feedbackArea, 'No response received. Try again.');
            return;
          }
          if (response.error) {
            hintBtn.disabled = false;
            fullBtn.disabled = false;
            renderError(feedbackArea, response.error);
            return;
          }
          leadEl.remove();
          renderFeedback(feedbackArea, response.feedback);
        }
      );
    });
  }

  hintBtn.addEventListener('click', function () { requestFeedback('hint'); });
  fullBtn.addEventListener('click', function () { requestFeedback('full'); });
}

// Listen for messages from the service worker.
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.type === 'SHOW_TOAST') {
    showToast('Submission captured');
  } else if (msg.type === 'SHOW_RATING') {
    showRatingDialog(msg.titleSlug, msg.title, msg.nextIntervals);
  } else if (msg.type === 'SHOW_WRONG_SUBMISSION') {
    showWrongSubmissionDialog(msg.submissionId, msg.titleSlug, msg.title);
  }
});
