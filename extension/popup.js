// LeetReminder — Popup Script
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
      chrome.tabs.create({ url: 'https://leetcode.com/problems/' + card.titleSlug + '/?leetreminder=review' });
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
    const notifEnabledEl = document.getElementById('notif-enabled');
    const notifTimeEl = document.getElementById('notif-time');

    if (apiKeyEl) apiKeyEl.value = s.openRouterApiKey || '';
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
    const notifEnabledEl = document.getElementById('notif-enabled');
    const notifTimeEl = document.getElementById('notif-time');

    const merged = {
      ...existing,
      openRouterApiKey: (apiKeyEl ? apiKeyEl.value.trim() : (existing.openRouterApiKey || '')),
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

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadDashboard();

  // Wire settings save button
  const saveBtn = document.getElementById('save-settings');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSettings);
  }
});
