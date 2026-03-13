// LeetReminder — Service Worker (background.js)
// ALL event listeners MUST be registered at the top level (global scope).
// Never register listeners inside callbacks or async functions.

// Module-scope DB reference — persists for the lifetime of this worker instance.
let db = null;
openDatabase().then(database => { db = database; }).catch(() => {});

// --- Top-level event listeners ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUBMISSION_CAPTURED') {
    const tabId = sender.tab ? sender.tab.id : null;
    saveSubmission(message.payload, tabId);
  }
  return false; // no async response needed
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ settings: { captureEnabled: true } });
});

// --- Functions ---

/**
 * Opens (or creates) the 'leetreminder' IndexedDB at version 1.
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('leetreminder', 1);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      const store = database.createObjectStore('submissions', {
        keyPath: 'id',
        autoIncrement: true
      });

      store.createIndex('submissionId', 'submissionId', { unique: true });
      store.createIndex('titleSlug', 'titleSlug', { unique: false });
      store.createIndex('capturedAt', 'capturedAt', { unique: false });
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Transforms the intercepted submission payload into a storage record
 * and writes it to IndexedDB. Silently skips duplicates (ConstraintError).
 * Sends SHOW_TOAST to the source tab on successful save.
 */
async function saveSubmission(data, tabId) {
  if (!data || (!data.id && !data.submissionId && !data.submission_id)) {
    console.warn('[LeetReminder] Unexpected submission shape', data);
    return;
  }

  let record;

  if (data.question) {
    // GraphQL submissionDetails format
    record = {
      submissionId: String(data.id || data.submissionId),
      titleSlug: data.question.titleSlug,
      title: data.question.title,
      difficulty: data.question.difficulty,
      topicTags: (data.question.topicTags || []).map(t => t.name),
      url: `https://leetcode.com/problems/${data.question.titleSlug}/`,
      code: data.code,
      lang: data.lang?.name,
      langDisplay: data.lang?.verboseName,
      statusDisplay: data.statusDisplay,
      capturedAt: Date.now()
    };
  } else {
    // REST /check/ endpoint format
    const titleSlug = data._titleSlug || '';
    record = {
      submissionId: String(data.submission_id),
      titleSlug: titleSlug,
      title: titleSlug.replace(/-/g, ' '),
      difficulty: null,
      topicTags: [],
      url: `https://leetcode.com/problems/${titleSlug}/`,
      code: data.code_output || data.code || '',
      lang: data.lang,
      langDisplay: data.pretty_lang || data.lang,
      statusDisplay: data.status_msg || (data.run_success ? 'Accepted' : 'Wrong Answer'),
      runtime: data.status_runtime,
      memory: data.status_memory,
      capturedAt: Date.now()
    };
  }

  if (!db) {
    try {
      db = await openDatabase();
    } catch (err) {
      console.warn('[LeetReminder] Failed to re-open IndexedDB', err);
      return;
    }
  }

  const saved = await addRecord(db, record);
  if (saved && tabId !== null) {
    await notifyTab(tabId);
  }
}

/**
 * Writes a record to the submissions store using add() (not put()).
 * Returns the new record key on success, null on duplicate (ConstraintError).
 */
function addRecord(database, record) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['submissions'], 'readwrite');
    const store = tx.objectStore('submissions');
    const req = store.add(record);

    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => {
      if (e.target.error.name === 'ConstraintError') {
        e.preventDefault();
        resolve(null);
      } else {
        reject(e.target.error);
      }
    };
  });
}

/**
 * Sends a SHOW_TOAST message to the specified tab.
 */
async function notifyTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_TOAST' });
  } catch {
    // Tab navigated away or was closed — ignore
  }
}
