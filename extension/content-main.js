// LeetReminder — Network Interceptor (content-main.js)
// World: MAIN — same JS context as LeetCode's page scripts.
// document_start — overrides fetch/XHR before page scripts load.
//
// LeetCode submission flow (REST, not GraphQL):
// 1. POST /problems/{slug}/submit/ → {submission_id}
// 2. GET /submissions/detail/{id}/check/ (polls) → {state:"PENDING"} ...
// 3. Final poll → {finished:true, status_code, submission_id, lang, ...}
//
// We capture the final check response and forward it to content-isolated.js
// via window.postMessage for relay to the service worker.

(function () {
  'use strict';

  function postSubmission(data) {
    window.postMessage({
      source: 'leetreminder',
      type: 'submission',
      data: data
    }, '*');
  }

  function isSubmissionResult(url, body) {
    return body && body.finished === true && body.submission_id &&
           (url.indexOf('/check') !== -1 || url.indexOf('submission') !== -1);
  }

  function enrichWithPageContext(body) {
    var match = window.location.pathname.match(/\/problems\/([^/]+)/);
    body._titleSlug = match ? match[1] : '';
  }

  // --- XHR interceptor ---
  var origOpen = XMLHttpRequest.prototype.open;
  var origSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function () {
    this._lr_url = arguments[1] || '';
    return origOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    var url = String(xhr._lr_url);

    if (url.indexOf('/graphql') !== -1 || url.indexOf('/submit') !== -1 ||
        url.indexOf('/check') !== -1 || url.indexOf('submission') !== -1) {
      xhr.addEventListener('load', function () {
        try {
          var body = JSON.parse(xhr.responseText);
          if (body && body.data && body.data.submissionDetails) {
            postSubmission(body.data.submissionDetails);
          }
          if (isSubmissionResult(url, body)) {
            enrichWithPageContext(body);
            postSubmission(body);
          }
        } catch (e) {}
      });
    }

    return origSend.apply(this, arguments);
  };

  // --- Fetch interceptor ---
  var origFetch = window.fetch;
  window.fetch = function () {
    var args = arguments;
    var url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';

    return origFetch.apply(this, args).then(function (response) {
      if (url.indexOf('/graphql') !== -1 || url.indexOf('/submit') !== -1 ||
          url.indexOf('/check') !== -1 || url.indexOf('submission') !== -1) {
        var cloned = response.clone();
        cloned.json().then(function (body) {
          if (body && body.data && body.data.submissionDetails) {
            postSubmission(body.data.submissionDetails);
          }
          if (isSubmissionResult(url, body)) {
            enrichWithPageContext(body);
            postSubmission(body);
          }
        }).catch(function () {});
      }
      return response;
    });
  };
  // --- Editor code extraction (for chat panel) ---
  // content-chat.js (ISOLATED world) requests the current Monaco editor code
  // via postMessage; we respond from MAIN world where monaco API is accessible.

  window.addEventListener('message', function (event) {
    if (event.data && event.data.source === 'leetreminder' && event.data.type === 'request-code') {
      var code = '';
      try {
        var models = window.monaco && window.monaco.editor && window.monaco.editor.getModels();
        if (models && models.length) code = models[0].getValue();
      } catch (e) {}
      window.postMessage({
        source: 'leetreminder',
        type: 'editor-code',
        reqId: event.data.reqId,
        code: code
      }, '*');
    }
  });

})();
