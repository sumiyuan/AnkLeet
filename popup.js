// AnkLeet — Popup Script
// No inline scripts — all event listeners via addEventListener (MV3 CSP compliant)

const DAY_MS = 86400000;

// Close the popup when it loses focus (a click outside it). Chrome normally
// does this itself; this covers the cases where it does not.
//
// A blur is not proof the user left: when the popup opens, or when a click
// inside activates its window, macOS can blur and refocus the page within a
// few milliseconds. So a blur only closes the popup if, after a short wait,
// the page still has no focus and the user has not just pressed inside it.
// Native dialogs opened from the popup (confirm, file picker, download) also
// blur it, so holdOpen() suspends this until focus returns.
const BLUR_SETTLE_MS = 200;
const RECENT_PRESS_MS = 600;
let popupHeldOpen = false;
let lastInsidePress = 0;
let blurTimer = null;

function holdOpen(ms) {
  popupHeldOpen = true;
  if (ms) setTimeout(() => { popupHeldOpen = false; }, ms);
}

function cancelPendingClose() {
  clearTimeout(blurTimer);
  blurTimer = null;
}

window.addEventListener('pointerdown', () => {
  lastInsidePress = Date.now();
  cancelPendingClose();
}, true);

window.addEventListener('focus', (e) => {
  if (e.target !== window) return;
  popupHeldOpen = false;
  cancelPendingClose();
});

window.addEventListener('blur', (e) => {
  if (e.target !== window || popupHeldOpen) return;
  cancelPendingClose();
  blurTimer = setTimeout(() => {
    blurTimer = null;
    if (popupHeldOpen || document.hasFocus()) return;
    if (Date.now() - lastInsidePress < RECENT_PRESS_MS) return;
    window.close();
  }, BLUR_SETTLE_MS);
});

// ── Tab Switching ──

function showTab(targetTab) {
  document.querySelectorAll('.tab-btn').forEach(b => {
    const isActive = b.dataset.tab === targetTab;
    b.classList.toggle('active', isActive);
    if (isActive) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'tab-' + targetTab);
  });

  // Refresh data on tab switch
  if (targetTab === 'dashboard') {
    loadDashboard();
  } else if (targetTab === 'reviews') {
    loadReviews();
  } else if (targetTab === 'settings') {
    loadSettings();
  }
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
}

// ── Formatting ──

function toLocalDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function startOfDay(d) {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  return s;
}

function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Describes a future date relative to today: "tomorrow", "Thu, Oct 31".
 */
function formatUpcoming(iso) {
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Whole days a card is past its due date (0 when due today).
 */
function daysOverdue(card) {
  return Math.max(0, Math.round((startOfDay(new Date()) - startOfDay(new Date(card.due))) / DAY_MS));
}

function displayTitle(item) {
  const t = item.title || item.titleSlug.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function problemUrl(titleSlug, review) {
  return 'https://leetcode.com/problems/' + titleSlug + '/' + (review ? '?ankleet=review' : '');
}

// ── Due Summary ──
// One request feeds the Today figure, the Reviews tab count and the queue,
// so the three can never disagree.

let lastStats = {};

function renderDueSummary(cards) {
  const countEl = document.getElementById('due-count');
  const labelEl = document.getElementById('due-label');
  const noteEl = document.getElementById('due-note');
  const startBtn = document.getElementById('start-reviews');
  const tabCount = document.getElementById('tab-due-count');

  const n = cards.length;
  countEl.textContent = String(n);
  countEl.classList.toggle('is-zero', n === 0);
  labelEl.textContent = (n === 1 ? 'review' : 'reviews') + ' due today';
  startBtn.hidden = n === 0;
  tabCount.hidden = n === 0;
  tabCount.textContent = String(n);

  if (n > 0) {
    const oldest = cards.reduce((a, b) => (daysOverdue(b) > daysOverdue(a) ? b : a), cards[0]);
    const late = daysOverdue(oldest);
    if (late > 0) {
      noteEl.textContent = displayTitle(oldest) + ' is ' + plural(late, 'day') + ' overdue.';
    } else {
      noteEl.textContent = displayTitle(cards[0]) + (n > 1 ? ' and ' + (n - 1) + ' more.' : '.');
    }
  } else {
    noteEl.textContent = nextReviewSentence();
  }
}

function nextReviewSentence() {
  if (lastStats.nextDue) return 'Next review ' + formatUpcoming(lastStats.nextDue) + '.';
  return 'Get a problem accepted on LeetCode and it joins your schedule.';
}

// ── Stats Rendering ──

function setFigure(id, value, unit) {
  const valueEl = document.getElementById(id);
  const unitEl = document.getElementById(id + '-unit');
  if (!valueEl) return;
  valueEl.textContent = value;
  valueEl.classList.toggle('is-empty', value === '—');
  if (unitEl) unitEl.textContent = unit || '';
}

function renderStats(stats) {
  lastStats = stats || {};
  const total = stats.totalReviews;
  setFigure('stat-reviews', total != null ? String(total) : '—');
  // Retention is undefined until something has been reviewed — a dash, not 0%
  setFigure('stat-retention', total > 0 ? String(stats.retentionRate) : '—', total > 0 ? '%' : '');
  setFigure('stat-streak', stats.streak != null ? String(stats.streak) : '—', stats.streak != null ? (stats.streak === 1 ? 'day' : 'days') : '');
}

// ── Day Activity ──

/**
 * Groups submissions by titleSlug, summing attempt counts.
 * Returns array of { titleSlug, title, accepted, attempts } sorted by most attempts first.
 */
function aggregateTodayActivity(submissions) {
  const bySlug = new Map();

  for (const sub of submissions) {
    const slug = sub.titleSlug;
    if (!bySlug.has(slug)) {
      bySlug.set(slug, {
        titleSlug: slug,
        title: sub.title || slug.replace(/-/g, ' '),
        accepted: false,
        attempts: 0
      });
    }
    const entry = bySlug.get(slug);
    entry.attempts += 1;
    if (sub.statusDisplay === 'Accepted') entry.accepted = true;
  }

  return Array.from(bySlug.values()).sort((a, b) => b.attempts - a.attempts);
}

function renderTodayActivity(submissions, emptyMessage) {
  const listEl = document.getElementById('activity-list');
  if (!listEl) return;

  const activities = aggregateTodayActivity(submissions);
  listEl.innerHTML = '';

  if (activities.length === 0) {
    const li = document.createElement('li');
    li.className = 'rows-empty';
    li.textContent = emptyMessage || 'Nothing submitted today.';
    listEl.appendChild(li);
    return;
  }

  for (const item of activities) {
    const li = document.createElement('li');
    li.className = 'row';

    const title = displayTitle(item);
    const link = document.createElement('a');
    link.className = 'row-title';
    link.href = problemUrl(item.titleSlug, false);
    link.textContent = title;
    link.title = title;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: problemUrl(item.titleSlug, false) });
    });

    const attempts = document.createElement('span');
    attempts.className = 'row-meta num';
    attempts.textContent = plural(item.attempts, 'attempt');

    const status = document.createElement('span');
    status.className = 'pill' + (item.accepted ? ' pill-positive' : '');
    status.textContent = item.accepted ? 'Accepted' : 'Not yet';

    li.append(link, attempts, status);
    listEl.appendChild(li);
  }
}

// ── Activity Chart ──

let selectedActivityDay = null; // YYYY-MM-DD or null for today

function selectActivityDay(dateStr, isToday) {
  selectedActivityDay = isToday ? null : dateStr;
  updateChartSelection();

  const titleEl = document.getElementById('activity-list-title');
  const backBtn = document.getElementById('activity-back-today');
  const listEl = document.getElementById('activity-list');

  if (titleEl) titleEl.textContent = isToday ? 'Problems today' : 'Problems on ' + formatDayLabel(dateStr);
  if (backBtn) backBtn.hidden = isToday;
  if (listEl) listEl.innerHTML = '<li class="rows-empty">Loading…</li>';

  const msgType = isToday ? 'GET_TODAY_SUBMISSIONS' : 'GET_DAY_SUBMISSIONS';
  const payload = isToday ? undefined : { date: dateStr };
  chrome.runtime.sendMessage({ type: msgType, payload }, response => {
    const submissions = (response && response.submissions) ? response.submissions : [];
    const emptyMsg = isToday ? 'Nothing submitted today.' : 'Nothing submitted on ' + formatDayLabel(dateStr) + '.';
    renderTodayActivity(submissions, emptyMsg);
  });
}

function updateChartSelection() {
  const shown = selectedActivityDay || toLocalDateStr(new Date());
  document.querySelectorAll('#activity-grid .chart-col').forEach(c => {
    const on = c.dataset.date === shown;
    c.classList.toggle('selected', on);
    c.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('#grid-labels span').forEach(s => {
    s.classList.toggle('is-selected', s.dataset.date === shown);
  });
}

/**
 * Picks the y-axis top: the smallest even round number above the busiest day,
 * so the scale reads 0 / half / top and no bar touches the frame.
 */
function chartTop(max) {
  const steps = [2, 4, 6, 8, 10, 12, 16, 20, 30, 40, 50, 60, 80, 100];
  for (const s of steps) if (s > max) return s;
  return Math.ceil((max + 1) / 20) * 20;
}

function renderActivityGrid(counts) {
  const barsEl = document.getElementById('activity-grid');
  const gridEl = document.getElementById('chart-grid');
  const labelsEl = document.getElementById('grid-labels');
  const totalEl = document.getElementById('grid-total');
  if (!barsEl || !gridEl || !labelsEl) return;

  barsEl.innerHTML = '';
  gridEl.innerHTML = '';
  labelsEl.innerHTML = '';

  const today = startOfDay(new Date());

  // Last 14 days using local dates (not UTC)
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(toLocalDateStr(d));
  }

  const values = days.map(d => counts[d] || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const top = chartTop(Math.max(...values));

  if (totalEl) totalEl.textContent = total + ' total';

  // Gridlines at 0, half and top, ticks in the right-hand lane
  for (const v of [0, top / 2, top]) {
    const line = document.createElement('div');
    line.className = 'chart-gridline' + (v === 0 ? ' is-base' : '');
    line.style.top = (100 - (v / top) * 100) + '%';
    const tick = document.createElement('span');
    tick.className = 'chart-tick';
    tick.textContent = String(v);
    line.appendChild(tick);
    gridEl.appendChild(line);
  }

  days.forEach((dateStr, idx) => {
    const count = values[idx];
    const isToday = idx === 13;
    const label = isToday ? 'Today' : new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const col = document.createElement('button');
    col.type = 'button';
    col.className = 'chart-col';
    col.dataset.date = dateStr;
    col.title = label + ': ' + plural(count, 'submission');
    col.setAttribute('aria-label', label + ', ' + plural(count, 'submission'));
    col.addEventListener('click', () => selectActivityDay(dateStr, isToday));

    // A day with no submissions has no bar, only the baseline
    if (count > 0) {
      const bar = document.createElement('span');
      bar.className = 'chart-bar';
      bar.style.height = (count / top) * 100 + '%';
      col.appendChild(bar);
    }
    barsEl.appendChild(col);

    // Four labels on a four-day step that lands on today
    if (idx % 4 === 1) {
      const span = document.createElement('span');
      span.dataset.date = dateStr;
      span.textContent = label;
      span.style.left = ((idx + 0.5) / 14) * 100 + '%';
      if (isToday) {
        span.className = 'is-last';
        span.style.left = '100%';
      }
      labelsEl.appendChild(span);
    }
  });

  updateChartSelection();
}

function loadActivityGrid() {
  chrome.runtime.sendMessage({ type: 'GET_RECENT_ACTIVITY', payload: { days: 14 } }, response => {
    if (response && response.counts) {
      renderActivityGrid(response.counts);
    }
  });
}

// ── Dashboard Data Loading ──

function loadDashboard() {
  const statsPromise = new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, response => {
      resolve(response || {});
    });
  });

  const duePromise = new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_DUE_TODAY' }, response => {
      resolve((response && response.cards) ? response.cards : []);
    });
  });

  const activeDay = selectedActivityDay;
  const submissionsPromise = new Promise(resolve => {
    const msg = activeDay
      ? { type: 'GET_DAY_SUBMISSIONS', payload: { date: activeDay } }
      : { type: 'GET_TODAY_SUBMISSIONS' };
    chrome.runtime.sendMessage(msg, response => {
      resolve((response && response.submissions) ? response.submissions : []);
    });
  });

  loadActivityGrid();

  Promise.all([statsPromise, duePromise, submissionsPromise]).then(([stats, cards, submissions]) => {
    renderStats(stats);
    renderDueSummary(cards);
    const emptyMsg = activeDay
      ? 'Nothing submitted on ' + formatDayLabel(activeDay) + '.'
      : 'Nothing submitted today.';
    renderTodayActivity(submissions, emptyMsg);
  }).catch(() => {
    const listEl = document.getElementById('activity-list');
    if (listEl) listEl.innerHTML = '<li class="rows-empty">Couldn’t load your activity. Reopen the popup to retry.</li>';
  });
}

// ── Reviews Tab ──

function updateReviewCountHeader(count) {
  const countEl = document.getElementById('review-count');
  if (countEl) countEl.textContent = count === 0 ? '' : plural(count, 'problem');
  const tabCount = document.getElementById('tab-due-count');
  if (tabCount) {
    tabCount.hidden = count === 0;
    tabCount.textContent = String(count);
  }
}

function showReviewEmpty() {
  const emptyEl = document.getElementById('review-empty');
  const noteEl = document.getElementById('review-empty-note');
  if (noteEl) noteEl.textContent = nextReviewSentence();
  if (emptyEl) emptyEl.hidden = false;
}

/**
 * Animates a card out of the review list, then removes it and updates state.
 */
function removeCard(cardEl, onComplete) {
  cardEl.classList.add('removing');
  cardEl.addEventListener('transitionend', () => {
    cardEl.remove();
    if (onComplete) onComplete();
  }, { once: true });
}

/**
 * The grey line under a review title: difficulty, how late it is, and the last gap.
 */
function reviewSubline(card) {
  const frag = document.createDocumentFragment();
  if (card.difficulty) frag.append(card.difficulty + ' · ');
  const late = daysOverdue(card);
  if (late > 0) {
    const span = document.createElement('span');
    span.className = 'is-overdue';
    span.textContent = plural(late, 'day') + ' overdue';
    frag.append(span);
  } else {
    frag.append('Due today');
  }
  frag.append(' · ' + (card.reps > 0 && card.interval ? 'last gap ' + plural(card.interval, 'day') : 'first review'));
  return frag;
}

function formatGap(days) {
  if (days == null) return '';
  return days === 1 ? '1 day' : days + ' days';
}

/**
 * Renders the review queue from an array of card objects.
 */
function renderReviewQueue(cards) {
  const listEl = document.getElementById('review-list');
  const emptyEl = document.getElementById('review-empty');
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';
  emptyEl.hidden = true;
  updateReviewCountHeader(cards.length);

  if (cards.length === 0) {
    showReviewEmpty();
    return;
  }

  const afterRemoval = () => {
    const remaining = listEl.querySelectorAll('.review-card').length;
    updateReviewCountHeader(remaining);
    if (remaining === 0) showReviewEmpty();
  };

  for (const card of cards) {
    const cardEl = document.createElement('li');
    cardEl.className = 'review-card';
    cardEl.dataset.titleSlug = card.titleSlug;

    const title = displayTitle(card);

    // Title row
    const titleRow = document.createElement('div');
    titleRow.className = 'review-card-title-row';

    const heading = document.createElement('div');
    heading.className = 'review-heading';

    const link = document.createElement('a');
    link.className = 'review-title';
    link.href = problemUrl(card.titleSlug, true);
    link.textContent = title;
    link.title = 'Open ' + title + ' with your old code hidden';
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: problemUrl(card.titleSlug, true) });
    });

    const sub = document.createElement('p');
    sub.className = 'review-sub';
    sub.appendChild(reviewSubline(card));

    heading.append(link, sub);

    const ratingRow = document.createElement('div');
    ratingRow.className = 'rating-buttons';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'card-remove-btn';
    removeBtn.title = 'Remove from review schedule';
    removeBtn.setAttribute('aria-label', 'Remove ' + title + ' from review schedule');
    removeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    removeBtn.addEventListener('click', () => {
      holdOpen(500);
      if (!confirm('Remove "' + title + '" from your review schedule?')) return;
      removeBtn.disabled = true;
      ratingRow.querySelectorAll('.rating-btn').forEach(b => { b.disabled = true; });
      chrome.runtime.sendMessage(
        { type: 'REMOVE_CARD', payload: { titleSlug: card.titleSlug } },
        () => removeCard(cardEl, () => { afterRemoval(); loadDashboard(); })
      );
    });

    titleRow.append(heading, removeBtn);
    cardEl.appendChild(titleRow);

    // Rating buttons — each shows the gap the scheduler will set
    const gaps = card.nextIntervals || {};
    for (const rating of ['Again', 'Hard', 'Good', 'Easy']) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rating-btn';
      btn.dataset.rating = rating;
      const gap = formatGap(gaps[rating]);
      btn.setAttribute('aria-label', rating + (gap ? ', next review in ' + gap : ''));

      const name = document.createElement('span');
      name.className = 'rating-name';
      name.textContent = rating;
      btn.appendChild(name);
      if (gap) {
        const gapEl = document.createElement('span');
        gapEl.className = 'rating-gap';
        gapEl.textContent = gap;
        btn.appendChild(gapEl);
      }

      btn.addEventListener('click', () => {
        // Disable buttons to prevent double-clicks
        ratingRow.querySelectorAll('.rating-btn').forEach(b => { b.disabled = true; });

        chrome.runtime.sendMessage(
          { type: 'RATE_REVIEW', payload: { titleSlug: card.titleSlug, rating } },
          // Refresh dashboard stats since totalReviews changed
          () => removeCard(cardEl, () => { afterRemoval(); loadDashboard(); })
        );
      });
      ratingRow.appendChild(btn);
    }

    cardEl.appendChild(ratingRow);
    listEl.appendChild(cardEl);
  }
}

/**
 * Loads due reviews from background and renders the queue.
 */
function loadReviews() {
  const countEl = document.getElementById('review-count');
  if (countEl) countEl.textContent = 'Loading…';

  chrome.runtime.sendMessage({ type: 'GET_DUE_TODAY' }, response => {
    const cards = (response && response.cards) ? response.cards : [];
    renderReviewQueue(cards);
  });
}

// ── Settings Tab ──

/**
 * Loads settings from chrome.storage.local and populates the form fields.
 */
function loadSettings() {
  chrome.storage.local.get('settings', result => {
    const s = result.settings || {};
    const apiKeyEl = document.getElementById('api-key');
    const aiModelEl = document.getElementById('ai-model');

    if (apiKeyEl) apiKeyEl.value = s.openRouterApiKey || '';
    if (aiModelEl) aiModelEl.value = s.aiModel || 'anthropic/claude-haiku-4.5';
  });
}

function flashStatus(id, text, isError) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('is-error', !!isError);
  el.classList.add('visible');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('visible'), isError ? 4000 : 2000);
}

/**
 * Saves settings, merging with existing values to preserve captureEnabled and others.
 */
function saveSettings() {
  chrome.storage.local.get('settings', result => {
    const existing = result.settings || {};
    const apiKeyEl = document.getElementById('api-key');
    const aiModelEl = document.getElementById('ai-model');

    const merged = {
      ...existing,
      openRouterApiKey: (apiKeyEl ? apiKeyEl.value.trim() : (existing.openRouterApiKey || '')),
      aiModel: (aiModelEl ? aiModelEl.value : (existing.aiModel || 'anthropic/claude-haiku-4.5'))
    };

    chrome.storage.local.set({ settings: merged }, () => flashStatus('save-status', 'Saved'));
  });
}

// ── Data Export/Import ──

function showDataStatus(text, isError) {
  flashStatus('data-status', text, isError);
}

function exportData() {
  const btn = document.getElementById('export-data');
  if (btn) btn.disabled = true;

  chrome.runtime.sendMessage({ type: 'EXPORT_DATA' }, response => {
    if (btn) btn.disabled = false;
    if (!response || response.error) {
      showDataStatus(response?.error || 'Export failed', true);
      return;
    }
    const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ankleet-export-' + new Date().toISOString().slice(0, 10) + '.json';
    holdOpen(1500);
    a.click();
    URL.revokeObjectURL(url);
    showDataStatus('Exported');
  });
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch {
      showDataStatus('That file isn’t valid JSON', true);
      return;
    }
    if (!parsed.version) {
      showDataStatus('Not an AnkLeet export', true);
      return;
    }

    chrome.runtime.sendMessage({ type: 'IMPORT_DATA', payload: parsed }, response => {
      if (!response || response.error) {
        showDataStatus(response?.error || 'Import failed', true);
        return;
      }
      showDataStatus('Imported');
      // Refresh current view
      loadDashboard();
      loadSettings();
    });
  };
  reader.onerror = () => showDataStatus('Couldn’t read that file', true);
  reader.readAsText(file);
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadDashboard();

  const startBtn = document.getElementById('start-reviews');
  if (startBtn) startBtn.addEventListener('click', () => showTab('reviews'));

  // Wire "Back to today" button in the activity section
  const backBtn = document.getElementById('activity-back-today');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      const today = toLocalDateStr(new Date());
      selectActivityDay(today, true);
    });
  }

  // Links in a popup must open a tab explicitly
  const keyLink = document.getElementById('openrouter-link');
  if (keyLink) {
    keyLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: keyLink.href });
    });
  }

  // Wire settings save button
  const saveBtn = document.getElementById('save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSettings);
  }

  // Wire export/import buttons
  const exportBtn = document.getElementById('export-data');
  if (exportBtn) exportBtn.addEventListener('click', exportData);

  const importBtn = document.getElementById('import-data');
  const importFile = document.getElementById('import-file');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => { holdOpen(); importFile.click(); });
    importFile.addEventListener('change', () => {
      if (importFile.files.length > 0) {
        importData(importFile.files[0]);
        importFile.value = ''; // reset so same file can be re-imported
      }
    });
  }

  // Refresh dashboard when a new submission is captured
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.lastSubmissionAt) {
      loadDashboard();
    }
  });
});
