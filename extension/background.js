// LeetReminder — Service Worker (background.js)
// ALL event listeners MUST be registered at the top level (global scope).
// Never register listeners inside callbacks or async functions.

importScripts('lib/ts-fsrs.umd.js');
// UMD exposes: FSRS.createEmptyCard, FSRS.fsrs, FSRS.Rating, FSRS.State
const { createEmptyCard, fsrs, Rating, State } = FSRS;

// Module-scope DB reference — persists for the lifetime of this worker instance.
let db = null;
openDatabase().then(database => {
  db = database;
  db.onversionchange = () => db.close();
}).catch(() => {});

// --- Top-level event listeners ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SUBMISSION_CAPTURED') {
    const tabId = sender.tab ? sender.tab.id : null;
    saveSubmission(message.payload, tabId);
    return false; // no async response needed
  }

  if (message.type === 'RATE_REVIEW') {
    (async () => {
      if (!db) {
        try { db = await openDatabase(); } catch (err) {
          sendResponse({ error: 'Failed to open database' });
          return;
        }
      }
      try {
        await rateReview(db, message.payload.titleSlug, message.payload.rating);
        sendResponse({ ok: true });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // async response
  }

  if (message.type === 'GET_DUE_TODAY') {
    (async () => {
      if (!db) {
        try { db = await openDatabase(); } catch (err) {
          sendResponse({ error: 'Failed to open database' });
          return;
        }
      }
      try {
        const cards = await getDueToday(db);
        sendResponse({ cards });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // async response
  }

  if (message.type === 'GET_STATS') {
    (async () => {
      if (!db) {
        try { db = await openDatabase(); } catch (err) {
          sendResponse({ error: 'Failed to open database' });
          return;
        }
      }
      try {
        const stats = await getStats(db);
        sendResponse(stats);
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // async response
  }

  if (message.type === 'GET_TODAY_SUBMISSIONS') {
    (async () => {
      if (!db) {
        try { db = await openDatabase(); } catch (err) {
          sendResponse({ error: 'Failed to open database' });
          return;
        }
      }
      try {
        const submissions = await getTodaySubmissions(db);
        sendResponse({ submissions });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true; // async response
  }

  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ settings: { captureEnabled: true } });
});

// --- Functions ---

/**
 * Opens (or creates) the 'leetreminder' IndexedDB at version 2.
 * Migrates from version 1 (submissions only) to version 2 (adds cards + reviewLogs).
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('leetreminder', 2);

    request.onblocked = () => {}; // silently wait for other tabs to yield

    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        // Original submissions store (needed for fresh installs with no prior DB)
        const store = database.createObjectStore('submissions', {
          keyPath: 'id',
          autoIncrement: true
        });
        store.createIndex('submissionId', 'submissionId', { unique: true });
        store.createIndex('titleSlug', 'titleSlug', { unique: false });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
      }

      if (oldVersion < 2) {
        // cards store — one card per problem, keyed by titleSlug
        const cardStore = database.createObjectStore('cards', {
          keyPath: 'titleSlug'
        });
        cardStore.createIndex('due', 'due', { unique: false });
        cardStore.createIndex('state', 'state', { unique: false });

        // reviewLogs store — full audit trail of every review rating
        const logStore = database.createObjectStore('reviewLogs', {
          keyPath: 'id',
          autoIncrement: true
        });
        logStore.createIndex('titleSlug', 'titleSlug', { unique: false });
        logStore.createIndex('reviewedAt', 'reviewedAt', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      const database = e.target.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Reads a single card from the cards store by titleSlug.
 * Returns the card object or null if not found.
 */
function getCard(database, titleSlug) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['cards'], 'readonly');
    const store = tx.objectStore('cards');
    const req = store.get(titleSlug);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Writes (upserts) a card to the cards store.
 */
function putCard(database, card) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['cards'], 'readwrite');
    const store = tx.objectStore('cards');
    const req = store.put(card);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Writes a review log entry to the reviewLogs store.
 */
function addReviewLog(database, logEntry) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['reviewLogs'], 'readwrite');
    const store = tx.objectStore('reviewLogs');
    const req = store.add(logEntry);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Transforms the intercepted submission payload into a storage record
 * and writes it to IndexedDB. Silently skips duplicates (ConstraintError).
 * Sends SHOW_TOAST to the source tab on successful save.
 * On first Accepted submission for a problem, creates an FSRS card.
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
  if (saved !== null) {
    if (record.statusDisplay === 'Accepted') {
      maybeCreateCard(db, record.titleSlug).catch(err => {
        console.warn('[LeetReminder] maybeCreateCard failed', err);
      });
    }
    if (tabId !== null) {
      await notifyTab(tabId);
    }
  }
}

/**
 * Creates an FSRS card for a problem if one does not already exist.
 * Called after the first Accepted submission for a titleSlug.
 * Idempotent — safe to call multiple times for the same titleSlug.
 */
async function maybeCreateCard(database, titleSlug) {
  const existing = await getCard(database, titleSlug);
  if (existing) return; // already has a card — skip

  const emptyCard = createEmptyCard(new Date());
  const card = {
    titleSlug,
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state,
    last_review: null,
    createdAt: Date.now()
  };

  return new Promise((resolve, reject) => {
    const tx = database.transaction(['cards'], 'readwrite');
    const store = tx.objectStore('cards');
    const req = store.add(card);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => {
      if (e.target.error.name === 'ConstraintError') {
        e.preventDefault();
        resolve(null); // race condition — another context already created the card
      } else {
        reject(e.target.error);
      }
    };
  });
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

/**
 * Rates a review for a card identified by titleSlug.
 * Reconstructs Date fields before passing to the FSRS scheduler,
 * updates the card in IndexedDB, and adds a review log entry.
 * ratingName must be one of: 'Again', 'Hard', 'Good', 'Easy'.
 */
async function rateReview(database, titleSlug, ratingName) {
  const validRatings = ['Again', 'Hard', 'Good', 'Easy'];
  if (!validRatings.includes(ratingName)) {
    throw new Error(`Invalid rating: ${ratingName}. Must be one of ${validRatings.join(', ')}`);
  }

  const stored = await getCard(database, titleSlug);
  if (!stored) {
    throw new Error(`Card not found for titleSlug: ${titleSlug}`);
  }

  // Reconstruct Date fields — FSRS scheduler requires real Date objects
  const card = {
    ...stored,
    due: new Date(stored.due),
    last_review: stored.last_review ? new Date(stored.last_review) : null
  };

  const scheduler = fsrs();
  const now = new Date();
  const recordLog = scheduler.repeat(card, now);

  const rating = Rating[ratingName];
  const { card: newCard, log } = recordLog[rating];

  const reviewLogEntry = {
    titleSlug,
    rating: log.rating,
    oldState: stored.state,
    newState: newCard.state,
    scheduledDays: log.scheduled_days,
    elapsedDays: log.elapsed_days,
    reviewedAt: now.toISOString()
  };

  const updatedCard = {
    titleSlug,
    due: newCard.due.toISOString(),
    stability: newCard.stability,
    difficulty: newCard.difficulty,
    elapsed_days: newCard.elapsed_days,
    scheduled_days: newCard.scheduled_days,
    reps: newCard.reps,
    lapses: newCard.lapses,
    state: newCard.state,
    last_review: newCard.last_review ? newCard.last_review.toISOString() : null,
    createdAt: stored.createdAt
  };

  await putCard(database, updatedCard);
  await addReviewLog(database, reviewLogEntry);
}

/**
 * Returns all cards whose due date is today or earlier.
 * Uses IDBKeyRange.upperBound on the due index (ISO string comparison).
 */
function getDueToday(database) {
  return new Promise((resolve, reject) => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const range = IDBKeyRange.upperBound(end.toISOString(), false);
    const tx = database.transaction(['cards'], 'readonly');
    const store = tx.objectStore('cards');
    const index = store.index('due');
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Reads all entries from the reviewLogs store.
 */
function getAllReviewLogs(database) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(['reviewLogs'], 'readonly');
    const store = tx.objectStore('reviewLogs');
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Computes the consecutive calendar-day streak counting backward from today.
 * reviewDays: Set of 'YYYY-MM-DD' date strings representing days with at least one review.
 */
function computeStreak(reviewDays) {
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (true) {
    const dayStr = cursor.toISOString().slice(0, 10);
    if (!reviewDays.has(dayStr)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/**
 * Returns all submissions captured today (local calendar day).
 * capturedAt is stored as Date.now() (integer ms) — use numeric IDBKeyRange.
 */
function getTodaySubmissions(database) {
  return new Promise((resolve, reject) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const range = IDBKeyRange.bound(start.getTime(), end.getTime());
    const tx = database.transaction(['submissions'], 'readonly');
    const store = tx.objectStore('submissions');
    const index = store.index('capturedAt');
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Returns aggregate statistics computed from all review log entries.
 * { totalReviews, retentionRate, streak }
 * retentionRate: percentage of Good (3) or Easy (4) ratings, rounded to integer.
 * streak: consecutive calendar days with at least one review, counting backward from today.
 */
async function getStats(database) {
  const logs = await getAllReviewLogs(database);
  const totalReviews = logs.length;

  let retentionRate = 0;
  if (totalReviews > 0) {
    const retained = logs.filter(log => log.rating >= 3).length;
    retentionRate = Math.round((retained / totalReviews) * 100);
  }

  const reviewDays = new Set(logs.map(log => log.reviewedAt.slice(0, 10)));
  const streak = computeStreak(reviewDays);

  return { totalReviews, retentionRate, streak };
}
