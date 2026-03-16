// AnkLeet — Message Relay (content-isolated.js)
// World: ISOLATED (default) — runs in the extension content script context.
// Bridges window.postMessage (from content-main.js in MAIN world) to
// chrome.runtime.sendMessage (to background.js service worker).
//
// Runs at document_start so the listener is in place before any submission
// can fire from the page.

window.addEventListener('message', function (event) {
  // Only process messages from the same page context (not iframes, etc.)
  if (event.source !== window) return;

  // Only handle messages posted by content-main.js
  if (event.data?.source !== 'ankleet') return;
  if (event.data?.type !== 'submission') return;

  const payload = event.data.data;

  // Forward to service worker. Wrap in retry logic — the service worker
  // may be starting up when the first message arrives.
  function sendToServiceWorker(attempt) {
    try {
      // No callback — background returns false (no response expected).
      // Passing a callback would cause "message port closed" warnings.
      chrome.runtime.sendMessage({
        type: 'SUBMISSION_CAPTURED',
        payload: payload
      });
      // Check lastError synchronously to suppress "could not establish connection"
      void chrome.runtime.lastError;
    } catch (err) {
      // sendMessage itself threw (e.g., extension context invalidated after reload).
      if (attempt === 1) {
        setTimeout(function () { sendToServiceWorker(2); }, 500);
      }
      // Silently drop after retry — context invalidation is expected after extension reload.
    }
  }

  sendToServiceWorker(1);
});
