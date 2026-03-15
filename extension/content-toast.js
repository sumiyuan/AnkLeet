// LeetReminder — Toast & Rating Dialog (content-toast.js)
// World: ISOLATED (default) — runs at document_end so document.body is ready.
// Shows a brief toast for wrong submissions, or a rating dialog for accepted ones.
// Shadow DOM prevents LeetCode's styles from bleeding in.

/**
 * Shows a temporary toast notification in the bottom-right corner.
 * Auto-dismisses after ~2 seconds with a fade transition.
 */
function showToast(message) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'leetreminder-toast-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .toast {
      all: initial;
      display: block;
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #1a1a1a;
      color: #ffffff;
      padding: 10px 16px;
      border-radius: 6px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      z-index: 2147483647;
      opacity: 1;
      transition: opacity 0.3s ease;
      pointer-events: none;
      box-sizing: border-box;
    }
    .toast.fade {
      opacity: 0;
    }
  `;

  const toast = document.createElement('div');
  toast.className = 'toast';
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
 */
function showRatingDialog(titleSlug, title) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'leetreminder-toast-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .overlay {
      all: initial;
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .dialog {
      background: #282828;
      color: #e0e0e0;
      border-radius: 12px;
      padding: 24px 28px;
      max-width: 360px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      text-align: center;
    }
    .dialog-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #ffffff;
    }
    .dialog-problem {
      font-size: 13px;
      color: #a0a0a0;
      margin-bottom: 18px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dialog-prompt {
      font-size: 13px;
      color: #b0b0b0;
      margin-bottom: 14px;
    }
    .rating-buttons {
      display: flex;
      gap: 8px;
      justify-content: center;
    }
    .rating-btn {
      all: initial;
      display: inline-block;
      padding: 8px 16px;
      border-radius: 6px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      color: #fff;
      box-sizing: border-box;
    }
    .rating-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .rating-btn:active { transform: translateY(0); }
    .rating-btn:disabled { opacity: 0.4; cursor: default; transform: none; }
    .rating-btn[data-rating="Again"] { background: #e05c5c; }
    .rating-btn[data-rating="Hard"]  { background: #d4893f; }
    .rating-btn[data-rating="Good"]  { background: #4caf50; }
    .rating-btn[data-rating="Easy"]  { background: #42a5f5; }
    .skip-btn {
      all: initial;
      display: inline-block;
      margin-top: 12px;
      padding: 4px 8px;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      color: #666;
      cursor: pointer;
      background: none;
    }
    .skip-btn:hover { color: #999; }
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
        function () {
          // Show brief confirmation then dismiss
          promptEl.textContent = 'Rated ' + rating + '!';
          setTimeout(function () { host.remove(); }, 600);
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

  shadow.appendChild(style);
  shadow.appendChild(overlay);

  // Close on overlay click (outside dialog)
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) host.remove();
  });
}

/**
 * Removes any existing toast/dialog host element.
 */
function removeHost() {
  document.getElementById('leetreminder-toast-host')?.remove();
}

/**
 * If the page was opened via a review link (#leetreminder-review),
 * blur the code editor until the user clicks "Reveal".
 * Uses a MutationObserver to wait for the Monaco editor to mount.
 */
function maybeBlurEditor() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('leetreminder') !== 'review') return;

  // Clean up the param so refreshing doesn't re-trigger
  params.delete('leetreminder');
  const cleanSearch = params.toString();
  const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '');
  history.replaceState(null, '', cleanUrl);

  const BLUR_HOST_ID = 'leetreminder-blur-host';

  function applyBlur(editorEl) {
    // Don't double-apply
    if (document.getElementById(BLUR_HOST_ID)) return;

    const host = document.createElement('div');
    host.id = BLUR_HOST_ID;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      .blur-overlay {
        all: initial;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: absolute;
        inset: 0;
        background: rgba(30, 30, 30, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 10;
        font-family: system-ui, -apple-system, sans-serif;
      }
      .blur-message {
        color: #e0e0e0;
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
        border-radius: 8px;
        background: #4caf50;
        color: #fff;
        font-family: system-ui, sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.1s;
      }
      .reveal-btn:hover { opacity: 0.85; transform: translateY(-1px); }
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
 * Shows a persistent dialog after a wrong LeetCode submission.
 * Provides Hint and Full Solution buttons that call GET_AI_FEEDBACK.
 */
function showWrongSubmissionDialog(submissionId, titleSlug, title) {
  removeHost();

  const host = document.createElement('div');
  host.id = 'leetreminder-toast-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'closed' });

  const style = document.createElement('style');
  style.textContent = `
    .overlay {
      all: initial;
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      z-index: 2147483647;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .dialog {
      background: #282828;
      color: #e0e0e0;
      border-radius: 12px;
      padding: 24px 28px;
      max-width: 480px;
      width: 90%;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      text-align: center;
    }
    .dialog-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 6px;
      color: #e05c5c;
    }
    .dialog-problem {
      font-size: 13px;
      color: #a0a0a0;
      margin-bottom: 18px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .ai-buttons {
      display: flex;
      flex-direction: row;
      gap: 8px;
      justify-content: center;
      margin-bottom: 12px;
    }
    .ai-btn {
      all: initial;
      display: inline-block;
      padding: 8px 16px;
      border-radius: 6px;
      font-family: system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.1s;
      color: #fff;
      box-sizing: border-box;
    }
    .ai-btn:hover { opacity: 0.85; transform: translateY(-1px); }
    .ai-btn:active { transform: translateY(0); }
    .ai-btn:disabled { opacity: 0.4; cursor: default; transform: none; }
    .ai-btn.hint { background: #7c6af7; }
    .ai-btn.full { background: #4caf50; }
    .loading {
      display: none;
      font-size: 13px;
      color: #888;
      margin-bottom: 10px;
    }
    .feedback-area {
      text-align: left;
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 10px;
    }
    .feedback-area p {
      white-space: pre-wrap;
      line-height: 1.5;
      margin: 0 0 8px 0;
      font-size: 13px;
    }
    .feedback-area pre {
      background: #1e1e1e;
      overflow-x: auto;
      font-family: 'Fira Mono', 'Consolas', monospace;
      font-size: 12px;
      color: #ce9178;
      padding: 10px 12px;
      border-radius: 6px;
      margin: 0 0 8px 0;
      white-space: pre;
    }
    .error-msg {
      color: #e05c5c;
      font-size: 13px;
      text-align: left;
      margin-bottom: 8px;
    }
    .skip-btn {
      all: initial;
      display: inline-block;
      margin-top: 12px;
      padding: 4px 8px;
      font-family: system-ui, sans-serif;
      font-size: 12px;
      color: #666;
      cursor: pointer;
      background: none;
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
  const displayTitle = title || titleSlug.replace(/-/g, ' ');
  problemEl.textContent = displayTitle;

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
  dismissBtn.addEventListener('click', function () {
    host.remove();
  });

  dialog.appendChild(titleEl);
  dialog.appendChild(problemEl);
  dialog.appendChild(buttonsEl);
  dialog.appendChild(loadingEl);
  dialog.appendChild(feedbackArea);
  dialog.appendChild(dismissBtn);
  overlay.appendChild(dialog);

  shadow.appendChild(style);
  shadow.appendChild(overlay);

  function requestFeedback(mode) {
    hintBtn.disabled = true;
    fullBtn.disabled = true;
    loadingEl.style.display = 'block';
    loadingEl.textContent = mode === 'hint' ? 'Getting hint...' : 'Getting full solution...';
    feedbackArea.innerHTML = '';

    chrome.runtime.sendMessage(
      { type: 'GET_AI_FEEDBACK', payload: { submissionId: submissionId, mode: mode } },
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
