# Phase 3: Dashboard, Reviews, and Notifications - Research

**Researched:** 2026-03-13
**Domain:** Chrome Extension MV3 — popup UI, browser notifications, alarms, badge management
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Popup layout & navigation**
- Tabbed navigation: Dashboard, Reviews, and Settings (gear icon) as separate tabs
- Fixed popup size (~350-400px wide, ~500px tall), content scrolls within each tab
- No popup exists yet — needs `action.default_popup` in manifest.json plus popup.html/css/js

**Dashboard tab**
- Stats bar (retention rate, review count, streak) at the top of the Dashboard tab, always visible
- Today's activity list below stats showing problems attempted with attempt counts
- Empty state: just show the stats bar and an empty activity list — no special messaging

**Review workflow**
- Inline rating in the review list: each due problem shows title, difficulty, link, and 4 rating buttons (Again/Hard/Good/Easy) in the same row
- "Open on LeetCode" link always opens a new tab (no tab reuse)
- After rating: card removed from list immediately (fade/slide animation), due count updates
- Empty review queue: "All caught up!" — clean done state, no extra actions

**Settings tab**
- OpenRouter API key input field (for v2 AI feedback — store now, use later)
- Notification preferences (on/off, time of day)

**Notifications & badge**
- Browser notification when reviews become due
- Extension icon badge shows current due count (number)
- Requires adding `notifications` and `alarms` permissions to manifest.json

### Claude's Discretion
- Exact tab styling, colors, typography, and spacing
- Animation details for card removal after rating
- Notification scheduling strategy (alarm interval, check frequency)
- Badge update frequency and logic
- Settings page layout and validation
- How to query today's submissions for the Dashboard tab (new message handler or extend existing)

### Deferred Ideas (OUT OF SCOPE)
- AI feedback on wrong submissions (v2 — AIFB-01, AIFB-02) — OpenRouter API key stored in settings but not used yet
- Cards-by-state dashboard visualization (New/Learning/Review/Relearning breakdown)
- Next review date display in empty queue state
- Tab reuse for LeetCode links (navigate existing tab instead of opening new)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Daily activity view showing problems attempted today with attempt counts | New `GET_TODAY_SUBMISSIONS` message handler in background.js; query `submissions` store by `capturedAt` index for today's date range |
| DASH-02 | Review queue with links to re-solve problems on LeetCode | `GET_DUE_TODAY` handler already exists; popup renders cards with `chrome.tabs.create` for links; `RATE_REVIEW` handler already exists |
| DASH-03 | Settings page for OpenRouter API key and notification preferences | `chrome.storage.local` for persistence; `storage` permission already declared; settings read/write in popup.js |
| NOTF-01 | Browser notification when reviews are due | `chrome.notifications.create` with `"basic"` type; requires `"notifications"` permission in manifest |
| NOTF-02 | Extension icon badge shows count of due reviews | `chrome.action.setBadgeText` + `chrome.action.setBadgeBackgroundColor`; driven by alarm in service worker |
</phase_requirements>

---

## Summary

Phase 3 introduces the only user-facing UI in the extension: a popup with three tabs (Dashboard, Reviews, Settings), plus background notification and badge logic. The codebase has no popup yet — `manifest.json` currently declares no `action` key. All backend message handlers needed for the popup (`GET_DUE_TODAY`, `GET_STATS`, `RATE_REVIEW`) are already implemented in `background.js`. The main work is: (1) wiring up `manifest.json`, (2) building the popup HTML/CSS/JS, (3) adding a new `GET_TODAY_SUBMISSIONS` message handler, (4) implementing the `chrome.alarms` + `chrome.notifications` loop in the service worker, and (5) keeping the badge count current.

The entire popup is built with vanilla HTML/CSS/JS — no build tooling, no framework — matching the pattern already established by `content-toast.js`. All JS must be in external files (MV3 CSP forbids inline scripts). Tab switching is pure CSS class toggling. Animation for card removal uses CSS transitions + `transitionend` to defer DOM removal until animation completes.

**Primary recommendation:** Wire manifest first (unlock popup + permissions), then build popup.html/popup.css/popup.js, then add the alarm/notification loop to the existing background.js top-level event listeners.

---

## Standard Stack

### Core
| Library / API | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `chrome.action` | MV3 built-in | `default_popup`, `setBadgeText`, `setBadgeBackgroundColor` | Only badge API available in MV3 |
| `chrome.alarms` | MV3 built-in | Periodic wake-up of service worker to check due cards | Replaces `setInterval` which dies when worker terminates |
| `chrome.notifications` | MV3 built-in | Display system browser notifications | Native, no external dependency |
| `chrome.storage.local` | MV3 built-in | Persist settings (API key, notification prefs) | Already used in project; works across all extension contexts |
| Vanilla HTML/CSS/JS | — | Popup UI | Consistent with existing code; no build step needed |

### Supporting
| API | Purpose | When to Use |
|-----|---------|-------------|
| `chrome.tabs.create` | Open LeetCode problem link in new tab | Every "Open on LeetCode" button click from popup |
| `chrome.runtime.sendMessage` | Popup → background data fetch | All data requests from popup.js to background.js |
| `IDBKeyRange` | Date-range query on `capturedAt` index | `GET_TODAY_SUBMISSIONS` handler to find today's submissions |
| CSS `transition` + `transitionend` | Animate card removal | After user rates a review card |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `chrome.alarms` | `setInterval` in service worker | `setInterval` is killed when the worker terminates — NOT reliable in MV3 |
| `chrome.notifications` | Web Notifications API | `chrome.notifications` works in service worker context; Web Notifications requires a foreground page |
| Vanilla JS tabs | React/Vue/Preact | Framework requires a build step; project has none; overkill for a 3-tab popup |

**Installation:** No packages needed — all APIs are Chrome built-ins available to MV3 extensions.

---

## Architecture Patterns

### Recommended Project Structure
```
extension/
├── background.js          # Service worker — ADD alarm/notification/badge logic here
├── manifest.json          # ADD action.default_popup, notifications, alarms permissions
├── popup.html             # NEW — shell with tab nav, loads popup.js and popup.css
├── popup.css              # NEW — tab layout, stats bar, review card, settings form
├── popup.js               # NEW — tab switching, data fetch, render, rating, settings
├── content-main.js        # Unchanged
├── content-isolated.js    # Unchanged
├── content-toast.js       # Unchanged (reference for shadow DOM / vanilla JS pattern)
├── icons/
└── lib/
    └── ts-fsrs.umd.js
```

### Pattern 1: Manifest Wiring — Action + Permissions
**What:** Declare popup file and new permissions in manifest.json
**When to use:** First task — nothing else works without this

```json
// Source: https://developer.chrome.com/docs/extensions/reference/api/action
// Source: https://developer.chrome.com/docs/extensions/reference/api/alarms
// Source: https://developer.chrome.com/docs/extensions/reference/api/notifications
{
  "manifest_version": 3,
  "permissions": ["storage", "alarms", "notifications"],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### Pattern 2: Popup Tab Switching (Vanilla JS + CSS)
**What:** Show/hide tab content panels by toggling a CSS class; store active tab in memory only (popup is ephemeral)
**When to use:** All popup tab navigation

```html
<!-- popup.html structure -->
<div class="tabs">
  <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
  <button class="tab-btn" data-tab="reviews">Reviews</button>
  <button class="tab-btn" data-tab="settings">&#9881;</button>
</div>
<div id="tab-dashboard" class="tab-panel active">...</div>
<div id="tab-reviews" class="tab-panel">...</div>
<div id="tab-settings" class="tab-panel">...</div>
```

```javascript
// popup.js — tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});
```

```css
/* popup.css */
.tab-panel { display: none; overflow-y: auto; }
.tab-panel.active { display: block; }
```

### Pattern 3: Popup Data Fetch via Message Passing
**What:** Popup sends messages to background.js; responses are used to render UI
**When to use:** Fetching due cards, stats, today's submissions

```javascript
// popup.js
async function loadDashboard() {
  const [statsRes, todayRes] = await Promise.all([
    chrome.runtime.sendMessage({ type: 'GET_STATS' }),
    chrome.runtime.sendMessage({ type: 'GET_TODAY_SUBMISSIONS' })
  ]);
  renderStats(statsRes);
  renderTodayActivity(todayRes.submissions);
}

async function loadReviews() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_DUE_TODAY' });
  renderReviewQueue(res.cards);
  updateBadge(res.cards.length);  // sync badge with what popup sees
}
```

### Pattern 4: New Background Message Handler — GET_TODAY_SUBMISSIONS
**What:** Query `submissions` store using `capturedAt` index for today's date window
**When to use:** Dashboard tab needs today's activity list

```javascript
// background.js — add to onMessage.addListener block
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

// New function in background.js
function getTodaySubmissions(database) {
  return new Promise((resolve, reject) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    // capturedAt is stored as Date.now() (milliseconds integer), not ISO string
    const range = IDBKeyRange.bound(start.getTime(), end.getTime());
    const tx = database.transaction(['submissions'], 'readonly');
    const store = tx.objectStore('submissions');
    const index = store.index('capturedAt');
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
```

**Important:** `capturedAt` is stored as `Date.now()` (milliseconds number), not an ISO string — confirmed from `background.js` line 225. The IDBKeyRange must use numeric bounds, not ISO strings.

### Pattern 5: Card Removal Animation
**What:** CSS transition on opacity + max-height, remove from DOM on `transitionend`
**When to use:** After user submits a rating — card fades and collapses before DOM removal

```javascript
// popup.js
function removeCard(cardEl, onComplete) {
  cardEl.style.transition = 'opacity 0.3s ease, max-height 0.3s ease';
  cardEl.style.overflow = 'hidden';
  cardEl.style.opacity = '0';
  cardEl.style.maxHeight = '0';
  cardEl.addEventListener('transitionend', () => {
    cardEl.remove();
    if (onComplete) onComplete();
  }, { once: true });
}
```

### Pattern 6: Alarm + Notification Loop in Service Worker
**What:** Create a named alarm on startup (if not exists), listen for it, check due count, fire notification + update badge
**When to use:** NOTF-01 and NOTF-02

```javascript
// background.js — alarm setup at top level (module scope, runs on every worker startup)
chrome.alarms.get('checkDueReviews', (alarm) => {
  if (!alarm) {
    chrome.alarms.create('checkDueReviews', { periodInMinutes: 1 });
  }
});

// background.js — top-level listener (MUST be registered synchronously)
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'checkDueReviews') return;
  if (!db) {
    try { db = await openDatabase(); } catch { return; }
  }
  const cards = await getDueToday(db);
  const count = cards.length;
  updateBadge(count);

  // Only fire notification if user has notifications enabled in settings
  const { settings } = await chrome.storage.local.get('settings');
  if (settings?.notificationsEnabled && count > 0) {
    chrome.notifications.create('dueReviews', {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'LeetReminder',
      message: `You have ${count} review${count === 1 ? '' : 's'} due.`
    });
  }
});

function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#E05C5C' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}
```

### Pattern 7: Settings Save / Load
**What:** Read settings on popup open; write on change/blur; use `chrome.storage.local`
**When to use:** Settings tab for API key and notification preferences

```javascript
// popup.js — load settings
async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  document.getElementById('api-key').value = settings?.openRouterApiKey || '';
  document.getElementById('notif-enabled').checked = settings?.notificationsEnabled ?? true;
  document.getElementById('notif-time').value = settings?.notificationTime || '09:00';
}

// popup.js — save settings
async function saveSettings() {
  const { settings: existing } = await chrome.storage.local.get('settings');
  const updated = {
    ...existing,
    openRouterApiKey: document.getElementById('api-key').value.trim(),
    notificationsEnabled: document.getElementById('notif-enabled').checked,
    notificationTime: document.getElementById('notif-time').value
  };
  await chrome.storage.local.set({ settings: updated });
}
```

**Note:** Existing `settings` object in storage already has `{ captureEnabled: true }` (set in `onInstalled`). The save must merge, not overwrite.

### Anti-Patterns to Avoid

- **Inline `<script>` in popup.html:** MV3 CSP forbids inline JavaScript. All JS must be `<script src="popup.js"></script>` in a separate file.
- **`setInterval` / `setTimeout` in service worker:** These are cancelled when the worker terminates. Use `chrome.alarms` instead.
- **Registering `chrome.alarms.onAlarm.addListener` inside an async callback:** Listener must be registered synchronously at the top level of the service worker or Chrome won't wake the worker when the alarm fires.
- **Creating a notification every alarm tick:** Check due count first; only fire notification if count > 0 AND notificationsEnabled is true. Repeat notifications on every minute are intrusive.
- **Overwriting `settings` object entirely:** Use `chrome.storage.local.get('settings')` first, spread existing values, then set. Otherwise `captureEnabled` is lost.
- **Using `Date.toISOString()` bounds for `capturedAt` IDBKeyRange:** `capturedAt` is stored as `Date.now()` (a number), so use numeric `IDBKeyRange.bound(start.getTime(), end.getTime())`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Periodic background tasks | Custom keep-alive / `setInterval` | `chrome.alarms` | Service worker lifecycle; `setInterval` cancelled on termination |
| System browser notifications | Custom UI overlay | `chrome.notifications.create` | Native OS notifications; works even when popup is closed |
| Badge count display | Canvas overlay on icon | `chrome.action.setBadgeText` | Native Chrome badge; no image manipulation needed |
| Settings persistence | `localStorage` in popup | `chrome.storage.local` | `localStorage` is isolated per page; service worker can't read it |
| Card fade-out removal | JS animation library | CSS `transition` + `transitionend` | No dependency; consistent with no-build-step project pattern |

**Key insight:** Every non-trivial background concern (scheduling, notifications, badge) has a dedicated Chrome API. Custom solutions fail silently when the service worker terminates.

---

## Common Pitfalls

### Pitfall 1: Alarm Listener Not Registered at Top Level
**What goes wrong:** `chrome.alarms.onAlarm.addListener` registered inside a `.then()` callback or conditional block. Worker wakes but the event handler isn't registered yet — alarm fires silently.
**Why it happens:** Developer waits for `openDatabase()` to complete before registering listeners; the async callback is too late.
**How to avoid:** Register all Chrome event listeners (including `onAlarm`) synchronously at module scope. Do async DB work inside the listener, not before registering it.
**Warning signs:** Alarms appear in DevTools but notifications never fire; badge never updates.

### Pitfall 2: capturedAt IDBKeyRange Type Mismatch
**What goes wrong:** Using ISO string bounds (`new Date().toISOString()`) on the `capturedAt` index, which stores millisecond integers. Query returns zero results or throws.
**Why it happens:** The `due` field in `cards` uses ISO strings but `capturedAt` in `submissions` uses `Date.now()` (integer). Easy to conflate.
**How to avoid:** Confirmed from background.js line 225: `capturedAt: Date.now()`. Use numeric bounds: `IDBKeyRange.bound(start.getTime(), end.getTime())`.
**Warning signs:** Dashboard activity list always empty even after solving problems today.

### Pitfall 3: Popup Inline Script Blocked by CSP
**What goes wrong:** Adding `<script>alert('hi')</script>` or `onclick="..."` attributes in popup.html. Extension fails to load with a CSP violation error.
**Why it happens:** MV3 enforces a strict Content Security Policy that blocks all inline scripts.
**How to avoid:** All JavaScript goes in popup.js (or other external .js files). Use `addEventListener` in popup.js instead of `onclick` attributes.
**Warning signs:** Extension loads but popup is blank/broken; console shows CSP errors.

### Pitfall 4: Notification Firing on Every Alarm Tick
**What goes wrong:** Notification fires once per minute indefinitely, even after the user has seen it or started reviewing.
**Why it happens:** No state tracking for "notification already shown for this due batch."
**How to avoid:** Track last notification with a `lastNotifiedCount` in `chrome.storage.local`. Only fire a new notification when the count changes from 0 to N, or use `chrome.notifications.create` with a fixed `notificationId` (`'dueReviews'`) — Chrome replaces existing notification with the same ID rather than stacking.
**Warning signs:** User sees dozens of stacked notifications.

### Pitfall 5: Settings Object Overwrite Loses captureEnabled
**What goes wrong:** `chrome.storage.local.set({ settings: { openRouterApiKey: '...', notificationsEnabled: true } })` silently discards `captureEnabled: true` set during `onInstalled`.
**Why it happens:** `set()` replaces the entire value for a key, not just the fields you specify.
**How to avoid:** Always read current settings first, spread, then write: `const { settings } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...settings, openRouterApiKey: '...' } })`.
**Warning signs:** Submission capture stops working after visiting the settings tab.

### Pitfall 6: Popup Closes When User Opens LeetCode Link
**What goes wrong:** Using `chrome.tabs.update` instead of `chrome.tabs.create` causes the current tab (the popup's opener) to navigate to LeetCode, closing the popup.
**Why it happens:** The user decision says "always opens a new tab" — but if `chrome.tabs.update` is used without a `tabId`, it defaults to the active tab.
**How to avoid:** Use `chrome.tabs.create({ url: 'https://leetcode.com/problems/...' })` — this is the locked decision from CONTEXT.md.
**Warning signs:** LeetCode link navigates away instead of opening new tab; popup disappears.

---

## Code Examples

### GET_TODAY_SUBMISSIONS — Today's Submissions by capturedAt Index
```javascript
// Source: background.js analysis — capturedAt stored as Date.now() (integer ms)
function getTodaySubmissions(database) {
  return new Promise((resolve, reject) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const range = IDBKeyRange.bound(start.getTime(), end.getTime());
    const tx = database.transaction(['submissions'], 'readonly');
    const index = tx.objectStore('submissions').index('capturedAt');
    const req = index.getAll(range);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  });
}
```

### Badge Update
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/action
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#E05C5C' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}
```

### Alarm Creation with Idempotent Guard
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/alarms
// Run at module scope (top level of background.js)
chrome.alarms.get('checkDueReviews', (alarm) => {
  if (!alarm) {
    chrome.alarms.create('checkDueReviews', { periodInMinutes: 1 });
  }
});
```

### Notification with Deduplication via Fixed ID
```javascript
// Source: https://developer.chrome.com/docs/extensions/reference/api/notifications
chrome.notifications.create('dueReviews', {
  type: 'basic',
  iconUrl: 'icons/icon128.png',
  title: 'LeetReminder',
  message: `You have ${count} review${count === 1 ? '' : 's'} due.`
});
// Using same notificationId replaces existing notification instead of stacking
```

### Today's Submissions Aggregation (Dashboard DASH-01)
```javascript
// popup.js — aggregate attempt counts per problem from raw submissions array
function aggregateTodayActivity(submissions) {
  const map = new Map();
  for (const sub of submissions) {
    const key = sub.titleSlug;
    if (!map.has(key)) {
      map.set(key, { titleSlug: key, title: sub.title, url: sub.url, attempts: 0 });
    }
    map.get(key).attempts++;
  }
  return [...map.values()];
}
```

---

## State of the Art

| Old Approach | Current Approach | Notes |
|--------------|------------------|-------|
| `setInterval` in background page (MV2) | `chrome.alarms` in service worker (MV3) | Service workers terminate; alarms survive termination |
| `localStorage` in popup | `chrome.storage.local` | `localStorage` unavailable in service workers |
| Inline `<script>` in HTML pages | External JS files only | MV3 CSP change — strictly enforced |
| `browserAction` (MV2) | `action` (MV3) | Unified action API; `default_popup` unchanged conceptually |

**Deprecated/outdated:**
- `chrome.browserAction.*`: Replaced by `chrome.action.*` in MV3. Do not use.
- `chrome.background.page`: Background pages removed in MV3. Service workers only.
- `window.webkitNotifications`: Ancient API. Use `chrome.notifications`.

---

## Open Questions

1. **Notification time-of-day preference**
   - What we know: Settings tab stores a `notificationTime` (HH:MM). Current alarm fires every minute.
   - What's unclear: Should the alarm fire a notification only once per day at the preferred time, or continuously whenever reviews are due?
   - Recommendation (Claude's discretion): Fire notification on every alarm tick when reviews are due AND it is past `notificationTime` for the day. Track `lastNotifiedDate` in `chrome.storage.local` to avoid repeat same-day notifications. This is simple and respects the user's time preference.

2. **Badge on extension install / service worker restart**
   - What we know: The alarm fires every minute to update the badge. On fresh browser start there is a gap until the first alarm fires.
   - What's unclear: Should the badge be updated immediately on service worker startup?
   - Recommendation: Yes — call `getDueToday` and `updateBadge` in the module-scope startup sequence alongside the alarm guard. One extra DB read on startup is acceptable.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — manual browser testing |
| Config file | none |
| Quick run command | Load unpacked extension in Chrome; open popup; verify visually |
| Full suite command | Manual UAT checklist (see Phase gate below) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Dashboard shows today's solved problems with attempt counts | manual | Load popup after solving a problem; verify list | N/A |
| DASH-02 | Review queue shows due cards with Open link and rating buttons | manual | Load popup with due cards; verify links open new tab; rate a card | N/A |
| DASH-03 | Settings saves API key and notification prefs without reload | manual | Enter key, toggle notifs, close popup, reopen; verify persistence | N/A |
| NOTF-01 | Browser notification fires when reviews are due | manual | Trigger alarm from DevTools or wait 1 min with due cards | N/A |
| NOTF-02 | Badge shows due count on extension icon | manual | Verify badge number matches due card count | N/A |

### Sampling Rate
- **Per task commit:** Reload extension in `chrome://extensions`; open popup; verify rendered state
- **Per wave merge:** Full manual UAT covering all 5 requirements above
- **Phase gate:** All 5 requirements verified before `/gsd:verify-work`

### Wave 0 Gaps
- None — no automated test infrastructure is established for this project; all verification is manual UAT consistent with Phases 1 and 2.

---

## Sources

### Primary (HIGH confidence)
- [chrome.action API](https://developer.chrome.com/docs/extensions/reference/api/action) — badge APIs, default_popup declaration
- [chrome.alarms API](https://developer.chrome.com/docs/extensions/reference/api/alarms) — alarm creation, minimum period (30s / 0.5 min), onAlarm listener, persistence behavior
- [chrome.notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications) — create notification, TemplateType enum, required fields
- [Add a popup — Chrome Developers](https://developer.chrome.com/docs/extensions/develop/ui/add-popup) — popup registration, CSP restrictions, external JS requirement
- `extension/background.js` (project codebase) — confirmed `capturedAt: Date.now()` storage format, existing message handlers, DB schema

### Secondary (MEDIUM confidence)
- [Service worker lifecycle — Chrome Developers](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — top-level listener registration requirement, termination behavior
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — `chrome.storage.local` vs `localStorage` distinction, cross-context availability

### Tertiary (LOW confidence)
- Community discussions on alarm recreation after browser restart — consistent with official docs guidance to recreate on startup

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all APIs are Chrome built-ins with official documentation verified
- Architecture: HIGH — patterns derived directly from existing codebase + official Chrome docs
- Pitfalls: HIGH — derived from code inspection (capturedAt type), official CSP docs, and established MV3 service worker lifecycle docs
- Notification scheduling strategy: MEDIUM — specific time-of-day logic is Claude's discretion; basic notification pattern is HIGH

**Research date:** 2026-03-13
**Valid until:** 2026-06-13 (stable Chrome extension APIs; notify if Chrome ships MV4 announcements)
