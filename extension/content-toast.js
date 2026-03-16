// AnkLeet — Toast & Rating Dialog (content-toast.js)
// World: ISOLATED (default) — runs at document_end so document.body is ready.
// Shows a brief toast for wrong submissions, or a rating dialog for accepted ones.
// Shadow DOM prevents LeetCode's styles from bleeding in.

// ── Shared design tokens injected into every Shadow DOM ──
const LR_TOKENS = `
  :host {
    --lr-bg-deep: #0f0f13;
    --lr-bg-surface: #1a1a21;
    --lr-bg-elevated: #242430;
    --lr-border: #2e2e3a;
    --lr-border-focus: #4a4a5c;
    --lr-text-primary: #e8e8ed;
    --lr-text-secondary: #8888a0;
    --lr-text-muted: #5c5c72;
    --lr-accent: #F0A830;
    --lr-accent-hover: #D89620;
    --lr-accent-glow: rgba(240, 168, 48, 0.15);
    --lr-success: #3DBAA2;
    --lr-error: #E85D75;
    --lr-hint: #8B7CF6;
    --lr-code-bg: #12121a;
    --lr-radius-panel: 14px;
    --lr-radius-btn: 8px;
    --lr-radius-sm: 5px;
    --lr-font: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    --lr-font-mono: 'JetBrains Mono', 'Fira Mono', 'Consolas', monospace;
  }
  * { box-sizing: border-box; }
`;

const LR_FONT_LINK = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap';

function createFontLink() {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LR_FONT_LINK;
  return link;
}

/**
 * Shows a temporary toast notification in the bottom-right corner.
 * Auto-dismisses after ~2 seconds with a fade transition.
 */
function showToast(message) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'ankleet-toast-host';
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
      padding: 12px 18px;
      border-radius: var(--lr-radius-btn);
      font-family: var(--lr-font);
      font-size: 13px;
      font-weight: 500;
      z-index: 2147483647;
      opacity: 1;
      transform: translateY(0);
      transition: opacity 0.3s ease, transform 0.3s ease;
      pointer-events: none;
      box-shadow:
        0 4px 16px rgba(0,0,0,0.4),
        0 0 0 1px var(--lr-border);
    }
    .toast.fade {
      opacity: 0;
      transform: translateY(6px);
    }
  `;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  shadow.appendChild(createFontLink());
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
 */
function showRatingDialog(titleSlug, title) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'ankleet-toast-host';
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
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      z-index: 2147483647;
      font-family: var(--lr-font);
      animation: overlay-in 0.2s ease;
    }
    @keyframes overlay-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .dialog {
      background: var(--lr-bg-surface);
      color: var(--lr-text-primary);
      border-radius: var(--lr-radius-panel);
      padding: 28px 32px;
      max-width: 380px;
      width: 90%;
      box-shadow:
        0 12px 48px rgba(0,0,0,0.5),
        0 0 0 1px var(--lr-border);
      text-align: center;
      animation: dialog-in 0.25s cubic-bezier(0.34, 1.3, 0.64, 1);
    }
    @keyframes dialog-in {
      from { opacity: 0; transform: scale(0.95) translateY(8px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .dialog-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 6px;
      color: var(--lr-accent);
      letter-spacing: -0.01em;
    }
    .dialog-problem {
      font-size: 13px;
      color: var(--lr-text-secondary);
      margin-bottom: 20px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dialog-prompt {
      font-size: 13px;
      color: var(--lr-text-muted);
      margin-bottom: 16px;
    }
    .rating-buttons {
      display: flex;
      gap: 8px;
      justify-content: center;
    }
    .rating-btn {
      all: initial;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 9px 18px;
      border-radius: var(--lr-radius-btn);
      font-family: var(--lr-font);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.15s;
      color: #fff;
    }
    .rating-btn:hover { opacity: 0.88; transform: translateY(-2px); }
    .rating-btn:active { transform: translateY(0); }
    .rating-btn:disabled { opacity: 0.35; cursor: default; transform: none; }
    .rating-btn[data-rating="Again"] { background: var(--lr-error); }
    .rating-btn[data-rating="Hard"]  { background: #D4893F; }
    .rating-btn[data-rating="Good"]  { background: var(--lr-success); }
    .rating-btn[data-rating="Easy"]  { background: #5B8DEF; }
    .skip-btn {
      all: initial;
      display: inline-block;
      margin-top: 14px;
      padding: 6px 12px;
      font-family: var(--lr-font);
      font-size: 12px;
      color: var(--lr-text-muted);
      cursor: pointer;
      background: none;
      border-radius: var(--lr-radius-sm);
      transition: color 0.15s, background 0.15s;
    }
    .skip-btn:hover {
      color: var(--lr-text-secondary);
      background: var(--lr-bg-elevated);
    }
  `;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';

  const dialog = document.createElement('div');
  dialog.className = 'dialog';

  const titleEl = document.createElement('div');
  titleEl.className = 'dialog-title';
  titleEl.textContent = 'Submission Captured';

  const problemEl = document.createElement('div');
  problemEl.className = 'dialog-problem';
  const displayTitle = title || titleSlug.replace(/-/g, ' ');
  problemEl.textContent = displayTitle;

  const promptEl = document.createElement('div');
  promptEl.className = 'dialog-prompt';
  promptEl.textContent = 'How did it go?';

  const buttonsEl = document.createElement('div');
  buttonsEl.className = 'rating-buttons';

  const ratings = ['Again', 'Hard', 'Good', 'Easy'];
  for (const rating of ratings) {
    const btn = document.createElement('button');
    btn.className = 'rating-btn';
    btn.dataset.rating = rating;
    btn.textContent = rating;
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
              nextDateLabel = dueDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            }
          }
          showConfirmationToast(nextDateLabel);
        }
      );
    });
    buttonsEl.appendChild(btn);
  }

  const skipBtn = document.createElement('button');
  skipBtn.className = 'skip-btn';
  skipBtn.textContent = 'Skip';
  skipBtn.addEventListener('click', function () {
    host.remove();
  });

  dialog.appendChild(titleEl);
  dialog.appendChild(problemEl);
  dialog.appendChild(promptEl);
  dialog.appendChild(buttonsEl);
  dialog.appendChild(skipBtn);
  overlay.appendChild(dialog);

  shadow.appendChild(createFontLink());
  shadow.appendChild(style);
  shadow.appendChild(overlay);

  // Close on overlay click (outside dialog)
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) host.remove();
  });
}

/**
 * Shows a small confirmation toast in the bottom-right corner
 * after a successful rating. Auto-dismisses after ~2.5 seconds.
 */
function showConfirmationToast(nextDateLabel) {
  var toastHost = document.createElement('div');
  toastHost.id = 'ankleet-confirm-host';
  document.body.appendChild(toastHost);

  var shadow = toastHost.attachShadow({ mode: 'closed' });

  var style = document.createElement('style');
  style.textContent = LR_TOKENS + `
    .confirm-toast {
      all: initial;
      display: flex;
      align-items: center;
      gap: 10px;
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--lr-bg-surface);
      color: var(--lr-text-primary);
      padding: 14px 20px;
      border-radius: var(--lr-radius-btn);
      font-family: var(--lr-font);
      font-size: 14px;
      z-index: 2147483647;
      box-shadow:
        0 4px 16px rgba(0,0,0,0.4),
        0 0 0 1px var(--lr-border);
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
      color: var(--lr-success);
      font-size: 18px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .label {
      color: var(--lr-text-primary);
      font-weight: 600;
      font-size: 13px;
    }
    .next-date {
      color: var(--lr-text-muted);
      font-size: 12px;
      margin-left: 2px;
    }
  `;

  var toast = document.createElement('div');
  toast.className = 'confirm-toast';

  var check = document.createElement('span');
  check.className = 'check';
  check.textContent = '\u2713';

  var label = document.createElement('span');
  label.className = 'label';
  label.textContent = 'Review captured';

  toast.appendChild(check);
  toast.appendChild(label);

  if (nextDateLabel) {
    var dateSpan = document.createElement('span');
    dateSpan.className = 'next-date';
    dateSpan.textContent = '\u00b7 Next: ' + nextDateLabel;
    toast.appendChild(dateSpan);
  }

  shadow.appendChild(createFontLink());
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
 * If the page was opened via a review link (#ankleet-review),
 * blur the code editor until the user clicks "Reveal".
 * Uses a MutationObserver to wait for the Monaco editor to mount.
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
        background: rgba(15, 15, 19, 0.65);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 10;
        font-family: var(--lr-font);
      }
      .blur-message {
        color: var(--lr-text-primary);
        font-size: 15px;
        font-weight: 500;
        margin-bottom: 16px;
        text-align: center;
        padding: 0 20px;
      }
      .reveal-btn {
        all: initial;
        display: inline-block;
        padding: 10px 24px;
        border-radius: var(--lr-radius-btn);
        background: var(--lr-accent);
        color: #0f0f13;
        font-family: var(--lr-font);
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.1s;
        letter-spacing: 0.01em;
      }
      .reveal-btn:hover { opacity: 0.88; transform: translateY(-1px); }
      .reveal-btn:active { transform: translateY(0); }
    `;

    const overlay = document.createElement('div');
    overlay.className = 'blur-overlay';

    const msg = document.createElement('div');
    msg.className = 'blur-message';
    msg.textContent = 'Reset your code before revealing';

    const btn = document.createElement('button');
    btn.className = 'reveal-btn';
    btn.textContent = 'Reveal Code';
    btn.addEventListener('click', function () {
      host.remove();
    });

    overlay.appendChild(msg);
    overlay.appendChild(btn);
    shadow.appendChild(createFontLink());
    shadow.appendChild(style);
    shadow.appendChild(overlay);

    // Position the overlay on top of the editor container
    const rect = editorEl.getBoundingClientRect();
    editorEl.style.position = editorEl.style.position || 'relative';

    // Insert overlay as a sibling positioned over the editor
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
      width: 360px;
      max-height: 500px;
      background: var(--lr-bg-surface);
      color: var(--lr-text-primary);
      border-radius: var(--lr-radius-panel);
      box-shadow:
        0 12px 48px rgba(0,0,0,0.5),
        0 0 0 1px var(--lr-border);
      z-index: 2147483647;
      font-family: var(--lr-font);
      overflow: hidden;
      animation: panel-in 0.25s cubic-bezier(0.34, 1.3, 0.64, 1);
    }
    @keyframes panel-in {
      from { opacity: 0; transform: translateY(10px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 16px;
      border-bottom: 1px solid var(--lr-border);
      background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
    }
    .panel-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--lr-error);
      letter-spacing: -0.01em;
    }
    .panel-problem {
      font-size: 11px;
      color: var(--lr-text-muted);
      max-width: 200px;
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
      border-radius: var(--lr-radius-sm);
      font-family: var(--lr-font);
      font-size: 16px;
      color: var(--lr-text-muted);
      cursor: pointer;
      flex-shrink: 0;
      transition: color 0.15s, background 0.15s;
    }
    .close-btn:hover {
      color: var(--lr-text-primary);
      background: var(--lr-bg-elevated);
    }
    .panel-body {
      padding: 14px 16px;
      overflow-y: auto;
      flex: 1;
      scrollbar-width: thin;
      scrollbar-color: var(--lr-border) transparent;
    }
    .panel-body::-webkit-scrollbar { width: 5px; }
    .panel-body::-webkit-scrollbar-track { background: transparent; }
    .panel-body::-webkit-scrollbar-thumb {
      background: var(--lr-border);
      border-radius: 3px;
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
      padding: 9px 18px;
      border-radius: var(--lr-radius-btn);
      font-family: var(--lr-font);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.15s;
      color: #fff;
      letter-spacing: 0.01em;
    }
    .ai-btn:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
    .ai-btn:active:not(:disabled) { transform: translateY(0); }
    .ai-btn:disabled { opacity: 0.35; cursor: default; transform: none; }
    .ai-btn.hint { background: var(--lr-hint); }
    .ai-btn.full { background: var(--lr-success); }

    /* ── Loading: animated dots (matches chat panel) ── */
    .loading {
      display: none;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      font-size: 12px;
      color: var(--lr-text-secondary);
      font-family: var(--lr-font);
    }
    .loading-dots {
      display: flex;
      gap: 3px;
    }
    .loading-dots span {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      background: var(--lr-accent);
      animation: dot-bounce 1.2s ease-in-out infinite;
    }
    .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
    .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
    @keyframes dot-bounce {
      0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-3px); }
    }

    .feedback-area {
      text-align: left;
      margin-top: 12px;
    }
    .feedback-area p {
      white-space: pre-wrap;
      line-height: 1.55;
      margin: 0 0 8px 0;
      font-size: 13px;
      color: var(--lr-text-primary);
    }
    .feedback-area pre {
      background: var(--lr-code-bg);
      overflow-x: auto;
      font-family: var(--lr-font-mono);
      font-size: 12.5px;
      color: #cdd6f4;
      padding: 12px 14px;
      border-radius: var(--lr-radius-btn);
      margin: 0 0 8px 0;
      white-space: pre;
      border: 1px solid var(--lr-border);
    }
    .error-msg {
      color: var(--lr-error);
      font-size: 12px;
      text-align: left;
      margin-top: 12px;
      font-family: var(--lr-font);
    }
  `;

  const panel = document.createElement('div');
  panel.className = 'panel';

  // Header
  const header = document.createElement('div');
  header.className = 'panel-header';

  const headerLeft = document.createElement('div');
  const titleEl = document.createElement('div');
  titleEl.className = 'panel-title';
  titleEl.textContent = 'Wrong Submission';
  const problemEl = document.createElement('div');
  problemEl.className = 'panel-problem';
  problemEl.textContent = title || titleSlug.replace(/-/g, ' ');
  headerLeft.appendChild(titleEl);
  headerLeft.appendChild(problemEl);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-btn';
  closeBtn.textContent = '\u00d7';
  closeBtn.addEventListener('click', function () { host.remove(); });

  header.appendChild(headerLeft);
  header.appendChild(closeBtn);

  // Body
  const body = document.createElement('div');
  body.className = 'panel-body';

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
  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'loading-dots';
  for (let i = 0; i < 3; i++) dotsContainer.appendChild(document.createElement('span'));
  loadingEl.appendChild(dotsContainer);
  const loadingText = document.createElement('span');
  loadingEl.appendChild(loadingText);

  const feedbackArea = document.createElement('div');
  feedbackArea.className = 'feedback-area';

  body.appendChild(buttonsEl);
  body.appendChild(loadingEl);
  body.appendChild(feedbackArea);

  panel.appendChild(header);
  panel.appendChild(body);

  shadow.appendChild(createFontLink());
  shadow.appendChild(style);
  shadow.appendChild(panel);

  function requestFeedback(mode) {
    hintBtn.disabled = true;
    fullBtn.disabled = true;
    loadingEl.style.display = 'flex';
    loadingText.textContent = mode === 'hint' ? 'Getting hint' : 'Getting solution';
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
            renderError(feedbackArea, 'Connection lost');
            return;
          }
          if (!response) {
            hintBtn.disabled = false;
            fullBtn.disabled = false;
            renderError(feedbackArea, 'No response received');
            return;
          }
          if (response.error) {
            hintBtn.disabled = false;
            fullBtn.disabled = false;
            renderError(feedbackArea, response.error);
            return;
          }
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
    showToast('\u2713 Submission captured');
  } else if (msg.type === 'SHOW_RATING') {
    showRatingDialog(msg.titleSlug, msg.title);
  } else if (msg.type === 'SHOW_WRONG_SUBMISSION') {
    showWrongSubmissionDialog(msg.submissionId, msg.titleSlug, msg.title);
  }
});
