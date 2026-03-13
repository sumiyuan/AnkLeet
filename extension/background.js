// LeetReminder — Service Worker (background.js)
// ALL event listeners MUST be registered at the top level (global scope).
// Never register listeners inside callbacks or async functions.

// Module-scope DB reference — persists for the lifetime of this worker instance.
let db = null;
openDatabase().then(database => { db = database; });

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
 * Schema is locked at v1 for Phase 1 — increment version for any structural change.
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('leetreminder', 1);

    request.onupgradeneeded = (event) => {
      const database = event.target.result;

      // submissions object store — autoIncrement primary key 'id'
      const store = database.createObjectStore('submissions', {
        keyPath: 'id',
        autoIncrement: true
      });

      // Unique index on LeetCode's submission ID — prevents duplicate captures
      store.createIndex('submissionId', 'submissionId', { unique: true });
      // Non-unique indexes for Phase 3 queries
      store.createIndex('titleSlug', 'titleSlug', { unique: false });
      store.createIndex('capturedAt', 'capturedAt', { unique: false });
    };

    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Transforms the raw submissionDetails GraphQL payload into the storage record
 * shape and writes it to IndexedDB. Silently skips duplicates (ConstraintError).
 * Sends SHOW_TOAST to the source tab on successful save.
 *
 * @param {object} data - submissionDetails payload from LeetCode GraphQL
 * @param {number|null} tabId - ID of the tab that sent the message
 */
async function saveSubmission(data, tabId) {
  // Validate required fields before writing — LeetCode's schema is undocumented
  // and may change. Log a warning and bail if critical fields are absent.
  if (!data || (!data.id && !data.submissionId) || !data.question) {
    console.warn('[LeetReminder] Unexpected submissionDetails shape', data);
    return;
  }

  const record = {
    submissionId: String(data.id || data.submissionId),
    titleSlug: data.question?.titleSlug,
    title: data.question?.title,
    difficulty: data.question?.difficulty,
    topicTags: (data.question?.topicTags || []).map(t => t.name),
    url: `https://leetcode.com/problems/${data.question?.titleSlug}/`,
    code: data.code,
    lang: data.lang?.name,
    langDisplay: data.lang?.verboseName,
    statusDisplay: data.statusDisplay,
    capturedAt: Date.now()
  };

  // If the DB connection was lost (worker restart), re-open before proceeding.
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
 *
 * @param {IDBDatabase} database
 * @param {object} record
 * @returns {Promise<number|null>}
 */
function addRecord(database, record) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['submissions'], 'readwrite');
    const store = tx.objectStore('submissions');
    const req = store.add(record);

    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => {
      if (e.target.error.name === 'ConstraintError') {
        resolve(null); // duplicate submission — silently skip
      } else {
        reject(e.target.error);
      }
    };
  });
}

/**
 * Sends a SHOW_TOAST message to the specified tab.
 * Wrapped in try/catch — tab may have navigated away.
 *
 * @param {number} tabId
 */
async function notifyTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'SHOW_TOAST' });
  } catch {
    // Tab navigated away or was closed — ignore
  }
}
