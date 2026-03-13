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

      // Refresh data on tab switch to dashboard or reviews
      if (targetTab === 'dashboard') {
        loadDashboard();
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
        difficulty: sub.difficulty,
        attempts: 0
      });
    }
    bySlug.get(slug).attempts += 1;
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
    const diffLower = (item.difficulty || '').toLowerCase();
    let diffClass = 'unknown';
    if (diffLower === 'easy') diffClass = 'easy';
    else if (diffLower === 'medium') diffClass = 'medium';
    else if (diffLower === 'hard') diffClass = 'hard';
    badgeSpan.className = 'difficulty-badge ' + diffClass;
    badgeSpan.textContent = item.difficulty || '?';

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

// ── Init ──

document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  loadDashboard();
});
