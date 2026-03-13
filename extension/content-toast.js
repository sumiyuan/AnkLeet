// LeetReminder — Toast Notification (content-toast.js)
// World: ISOLATED (default) — runs at document_end so document.body is ready.
// Displays a brief Shadow DOM toast in the bottom-right corner when the
// service worker confirms a submission has been saved.
//
// Shadow DOM prevents LeetCode's styles from bleeding into the toast.

/**
 * Shows a temporary toast notification in the bottom-right corner.
 * Auto-dismisses after ~2 seconds with a fade transition.
 *
 * @param {string} message - Text to display in the toast.
 */
function showToast(message) {
  // Remove any pre-existing toast to avoid stacking.
  document.getElementById('leetreminder-toast-host')?.remove();

  const host = document.createElement('div');
  host.id = 'leetreminder-toast-host';
  document.body.appendChild(host);

  // Closed shadow root — page scripts cannot access toast internals.
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

  // Begin fade-out at 2 000 ms, remove element 300 ms later (after transition).
  setTimeout(function () {
    toast.classList.add('fade');
    setTimeout(function () {
      host.remove();
    }, 300);
  }, 2000);
}

// Listen for SHOW_TOAST messages from the service worker.
chrome.runtime.onMessage.addListener(function (msg) {
  if (msg.type === 'SHOW_TOAST') {
    showToast('✓ Submission captured');
  }
});
