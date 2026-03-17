// AnkLeet — Popup Script
// No inline scripts — all event listeners via addEventListener (MV3 CSP compliant)

// ── Tab Switching ──

function initTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.dataset.tab;

      // Deactivate all tabs and panels
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      // Activate selected tab and panel
      btn.classList.add('active');
      const panel = document.getElementById('tab-' + targetTab);
      if (panel) panel.classList.add('active');

      // Refresh data on tab switch
      if (targetTab === 'dashboard') {
        loadDashboard();
      } else if (targetTab === 'reviews') {
        loadReviews();
      } else if (targetTab === 'settings') {
        loadSettings();
      }
    });
  });
}

// ── Stats Rendering ──

function renderStats(stats) {
  const retentionEl = document.getElementById('stat-retention');
  const reviewsEl = document.getElementById('stat-reviews');
  const streakEl = document.getElementById('stat-streak');

  if (retentionEl) retentionEl.textContent = (stats.retentionRate != null) ? stats.retentionRate + '%' : '—';
  if (reviewsEl) reviewsEl.textContent = (stats.totalReviews != null) ? String(stats.totalReviews) : '—';
  if (streakEl) streakEl.textContent = (stats.streak != null) ? stats.streak + 'd' : '—';
}

// ── Today Activity Aggregation ──

/**
 * Groups submissions by titleSlug, summing attempt counts.
 * Returns array of { titleSlug, title, difficulty, attempts } sorted by most attempts first.
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

// ── Activity Rendering ──

function renderTodayActivity(submissions) {
  const listEl = document.getElementById('activity-list');
  if (!listEl) return;

  const activities = aggregateTodayActivity(submissions);

  if (activities.length === 0) {
    listEl.innerHTML = '<div class="empty-state">No activity today</div>';
    return;
  }

  listEl.innerHTML = '';

  for (const item of activities) {
    const div = document.createElement('div');
    div.className = 'activity-item';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'activity-title';
    // Capitalize first letter of each word for display
    const displayTitle = item.title
      ? item.title.charAt(0).toUpperCase() + item.title.slice(1)
      : item.titleSlug.replace(/-/g, ' ');
    titleSpan.textContent = displayTitle;
    titleSpan.title = displayTitle; // tooltip for truncated text

    const badgeSpan = document.createElement('span');
    badgeSpan.className = 'status-dot ' + (item.accepted ? 'accepted' : 'in-progress');
    badgeSpan.title = item.accepted ? 'Accepted' : 'In Progress';

    const attemptsSpan = document.createElement('span');
    attemptsSpan.className = 'attempt-count';
    attemptsSpan.textContent = item.attempts === 1 ? '1 attempt' : item.attempts + ' attempts';

    div.appendChild(titleSpan);
    div.appendChild(badgeSpan);
    div.appendChild(attemptsSpan);
    listEl.appendChild(div);
  }
}

// ── Activity Grid ──

function renderActivityGrid(counts) {
  const gridEl = document.getElementById('activity-grid');
  const labelsEl = document.getElementById('grid-labels');
  const totalEl = document.getElementById('grid-total');
  if (!gridEl || !labelsEl) return;

  gridEl.innerHTML = '';
  labelsEl.innerHTML = '';

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build array of last 14 days
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  // Find max for level scaling
  const values = days.map(d => counts[d] || 0);
  const total = values.reduce((a, b) => a + b, 0);
  const max = Math.max(...values, 1);

  if (totalEl) {
    totalEl.textContent = total + ' submission' + (total === 1 ? '' : 's');
  }

  days.forEach((dateStr, idx) => {
    const count = values[idx];
    let level = 0;
    if (count > 0) {
      const ratio = count / max;
      if (ratio <= 0.25) level = 1;
      else if (ratio <= 0.5) level = 2;
      else if (ratio <= 0.75) level = 3;
      else level = 4;
    }

    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    cell.dataset.level = level;
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    cell.dataset.tooltip = label + ': ' + count + ' submission' + (count === 1 ? '' : 's');
    gridEl.appendChild(cell);

    const labelEl = document.createElement('div');
    labelEl.className = 'grid-label';
    const isToday = idx === 13;
    if (isToday) {
      labelEl.classList.add('today');
      labelEl.textContent = 'Today';
    } else {
      labelEl.textContent = dayNames[d.getDay()];
    }
    labelsEl.appendChild(labelEl);
  });
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

  const submissionsPromise = new Promise(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_TODAY_SUBMISSIONS' }, response => {
      resolve((response && response.submissions) ? response.submissions : []);
    });
  });

  loadActivityGrid();

  Promise.all([statsPromise, submissionsPromise]).then(([stats, submissions]) => {
    renderStats(stats);
    renderTodayActivity(submissions);
  }).catch(() => {
    const listEl = document.getElementById('activity-list');
    if (listEl) listEl.innerHTML = '<div class="empty-state">Failed to load data</div>';
  });
}

// ── Reviews Tab ──

/**
 * Updates the review count header text.
 */
function updateReviewCountHeader(count) {
  const countEl = document.getElementById('review-count');
  if (!countEl) return;
  if (count === 0) {
    countEl.textContent = 'No reviews due';
  } else if (count === 1) {
    countEl.textContent = '1 review due';
  } else {
    countEl.textContent = count + ' reviews due';
  }
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
 * Renders the review queue from an array of card objects.
 */
function renderReviewQueue(cards) {
  const listEl = document.getElementById('review-list');
  const emptyEl = document.getElementById('review-empty');
  if (!listEl || !emptyEl) return;

  listEl.innerHTML = '';

  if (cards.length === 0) {
    updateReviewCountHeader(0);
    emptyEl.style.display = '';
    return;
  }

  updateReviewCountHeader(cards.length);
  emptyEl.style.display = 'none';

  for (const card of cards) {
    const cardEl = document.createElement('div');
    cardEl.className = 'review-card';
    cardEl.dataset.titleSlug = card.titleSlug;

    // Title row
    const titleRow = document.createElement('div');
    titleRow.className = 'review-card-title-row';

    const link = document.createElement('a');
    link.href = '#';
    const displayTitle = card.title || card.titleSlug.replace(/-/g, ' ');
    link.textContent = displayTitle;
    link.title = displayTitle;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://leetcode.com/problems/' + card.titleSlug + '/?ankleet=review' });
    });

    titleRow.appendChild(link);

    if (card.difficulty) {
      const badge = document.createElement('span');
      const diffLower = card.difficulty.toLowerCase();
      let diffClass = 'unknown';
      if (diffLower === 'easy') diffClass = 'easy';
      else if (diffLower === 'medium') diffClass = 'medium';
      else if (diffLower === 'hard') diffClass = 'hard';
      badge.className = 'difficulty-badge ' + diffClass;
      badge.textContent = card.difficulty;
      titleRow.appendChild(badge);
    }

    cardEl.appendChild(titleRow);

    // Rating buttons
    const ratingRow = document.createElement('div');
    ratingRow.className = 'rating-buttons';

    for (const rating of ['Again', 'Hard', 'Good', 'Easy']) {
      const btn = document.createElement('button');
      btn.className = 'rating-btn';
      btn.dataset.rating = rating;
      btn.textContent = rating;
      btn.addEventListener('click', () => {
        // Disable buttons to prevent double-clicks
        ratingRow.querySelectorAll('.rating-btn').forEach(b => { b.disabled = true; });

        chrome.runtime.sendMessage(
          { type: 'RATE_REVIEW', payload: { titleSlug: card.titleSlug, rating } },
          () => {
            // Count remaining cards after this one is removed
            removeCard(cardEl, () => {
              const remaining = listEl.querySelectorAll('.review-card').length;
              updateReviewCountHeader(remaining);
              if (remaining === 0) {
                const emptyEl2 = document.getElementById('review-empty');
                if (emptyEl2) emptyEl2.style.display = '';
              }
              // Refresh dashboard stats since totalReviews changed
              loadDashboard();
            });
          }
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
  if (countEl) countEl.textContent = 'Loading...';

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
    const notifEnabledEl = document.getElementById('notif-enabled');
    const notifTimeEl = document.getElementById('notif-time');

    if (apiKeyEl) apiKeyEl.value = s.openRouterApiKey || '';
    if (aiModelEl) aiModelEl.value = s.aiModel || 'anthropic/claude-haiku-4.5';
    if (notifEnabledEl) notifEnabledEl.checked = (s.notificationsEnabled !== false); // default true
    if (notifTimeEl) notifTimeEl.value = s.notificationTime || '09:00';
  });
}

/**
 * Saves settings, merging with existing values to preserve captureEnabled and others.
 */
function saveSettings() {
  chrome.storage.local.get('settings', result => {
    const existing = result.settings || {};
    const apiKeyEl = document.getElementById('api-key');
    const aiModelEl = document.getElementById('ai-model');
    const notifEnabledEl = document.getElementById('notif-enabled');
    const notifTimeEl = document.getElementById('notif-time');

    const merged = {
      ...existing,
      openRouterApiKey: (apiKeyEl ? apiKeyEl.value.trim() : (existing.openRouterApiKey || '')),
      aiModel: (aiModelEl ? aiModelEl.value : (existing.aiModel || 'anthropic/claude-haiku-4.5')),
      notificationsEnabled: notifEnabledEl ? notifEnabledEl.checked : (existing.notificationsEnabled !== false),
      notificationTime: (notifTimeEl ? notifTimeEl.value : (existing.notificationTime || '09:00'))
    };

    chrome.storage.local.set({ settings: merged }, () => {
      // Show brief confirmation
      const statusEl = document.getElementById('save-status');
      if (statusEl) {
        statusEl.textContent = 'Settings saved';
        statusEl.classList.add('visible');
        setTimeout(() => {
          statusEl.classList.remove('visible');
        }, 2000);
      }
    });
  });
}

// ── Data Export/Import ──

function showDataStatus(text, isError) {
  const el = document.getElementById('data-status');
  if (!el) return;
  el.textContent = text;
  el.style.color = isError ? '#E85D75' : '#3DBAA2';
  el.classList.add('visible');
  setTimeout(() => el.classList.remove('visible'), 3000);
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
    a.click();
    URL.revokeObjectURL(url);
    showDataStatus('Data exported');
  });
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let parsed;
    try {
      parsed = JSON.parse(reader.result);
    } catch {
      showDataStatus('Invalid JSON file', true);
      return;
    }
    if (!parsed.version) {
      showDataStatus('Not a valid AnkLeet export', true);
      return;
    }

    chrome.runtime.sendMessage({ type: 'IMPORT_DATA', payload: parsed }, response => {
      if (!response || response.error) {
        showDataStatus(response?.error || 'Import failed', true);
        return;
      }
      showDataStatus('Data imported successfully');
      // Refresh current view
      loadDashboard();
      loadSettings();
    });
  };
  reader.onerror = () => showDataStatus('Failed to read file', true);
  reader.readAsText(file);
}

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadDashboard();

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
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
      if (importFile.files.length > 0) {
        importData(importFile.files[0]);
        importFile.value = ''; // reset so same file can be re-imported
      }
    });
  }
});
