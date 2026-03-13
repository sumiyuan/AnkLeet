// LeetReminder — Message Relay (content-isolated.js)
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
  if (event.data?.source !== 'leetreminder') return;
  if (event.data?.type !== 'submission') return;

  const payload = event.data.data;

  // Forward to service worker. Wrap in retry logic — the service worker
  // may be starting up when the first message arrives.
  function sendToServiceWorker(attempt) {
    try {
      chrome.runtime.sendMessage({
        type: 'SUBMISSION_CAPTURED',
        payload: payload
      }, function () {
        if (chrome.runtime.lastError) {
          // Suppress "could not establish connection" errors that occur
          // when the service worker is momentarily unavailable.
          if (attempt === 1) {
            setTimeout(function () { sendToServiceWorker(2); }, 500);
          } else {
            console.warn(
              '[LeetReminder] content-isolated: sendMessage failed after retry',
              chrome.runtime.lastError.message
            );
          }
        }
      });
    } catch (err) {
      // sendMessage itself threw (e.g., extension context invalidated).
      if (attempt === 1) {
        setTimeout(function () { sendToServiceWorker(2); }, 500);
      } else {
        console.warn('[LeetReminder] content-isolated: sendMessage threw', err);
      }
    }
  }

  sendToServiceWorker(1);
});
