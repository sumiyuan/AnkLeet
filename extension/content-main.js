// LeetReminder — Fetch Interceptor (content-main.js)
// World: MAIN — runs in the same JS context as LeetCode's page scripts.
// This script must load at document_start to override window.fetch before
// LeetCode's own scripts initialise.
//
// Intercepts submissionDetails GraphQL responses and forwards the payload
// to content-isolated.js via window.postMessage.

(function () {
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    let response;
    try {
      response = await originalFetch.apply(this, args);
    } catch (err) {
      // Network error — re-throw, do not interfere with page behaviour.
      throw err;
    }

    try {
      // Extract URL from the first argument (string or Request object).
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;

      if (url && url.includes('/graphql')) {
        // Only intercept the specific operation we care about.
        // LeetCode makes many GraphQL calls; we filter by operationName.
        let isSubmissionDetails = false;
        const bodyArg = args[1]?.body;
        if (typeof bodyArg === 'string') {
          try {
            const parsed = JSON.parse(bodyArg);
            isSubmissionDetails = parsed?.operationName === 'submissionDetails';
          } catch {
            // Body is not JSON — not the request we want.
          }
        }

        if (isSubmissionDetails) {
          // Clone the response so the page can still consume the original.
          const cloned = response.clone();

          cloned.json().then(body => {
            if (body?.data?.submissionDetails) {
              window.postMessage({
                source: 'leetreminder',
                type: 'submission',
                data: body.data.submissionDetails
              }, '*');
            }
          }).catch(() => {
            // Response body was not valid JSON — nothing to capture.
          });
        }
      }
    } catch (err) {
      // Interception logic must never break the original fetch call.
      console.warn('[LeetReminder] content-main: unexpected error during intercept', err);
    }

    // Always return the original (unconsumed) response to the page.
    return response;
  };
})();
