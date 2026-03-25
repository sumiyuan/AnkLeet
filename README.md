# AnkLeet

**Spaced repetition for LeetCode.** AnkLeet automatically captures every submission you make on LeetCode and schedules reviews using a custom spaced repetition algorithm tuned for day-scale problem solving. It also provides an AI tutor that can give hints, explain solutions, and chat about any problem.

No cloud accounts. No signup. Everything runs locally in your browser.

---

## Features

### Automatic Submission Capture
AnkLeet intercepts LeetCode's network requests to detect submissions in real-time. Every accepted solution creates a review card; wrong submissions trigger an AI feedback panel with hint and full solution options.

### Spaced Repetition

Review cards are scheduled using a custom algorithm designed for LeetCode — where intervals are measured in days, not minutes like traditional flashcard systems.

After each review, rate your recall and AnkLeet computes when you should revisit the problem:

| Rating | First review | Subsequent reviews |
|--------|-------------|-------------------|
| Again | 1 day | Reset to 1 day |
| Hard | 2 days | interval × 1.2 |
| Good | 4 days | interval × ease (default 2.5) |
| Easy | 7 days | interval × ease × 1.3 |

Each card tracks its own **ease factor** (starting at 2.5) that adapts based on your ratings — cards you struggle with get shorter intervals, cards you find easy get progressively longer ones. A card rated Good repeatedly grows as: 4d → 10d → 25d → 63d → 158d.

The extension badge shows how many reviews are due today.

### AI Chat & Hints
An AI chat panel (powered by [OpenRouter](https://openrouter.ai)) lives on every problem page. Use it to:
- Get Socratic hints on wrong submissions without spoiling the answer
- Request full solutions with explanations
- Have multi-turn conversations about approach, complexity, or edge cases

Supports Claude, GPT-4o, and Gemini models — configurable in settings.

### Dashboard
The popup shows:
- **Stats** — retention rate, total reviews completed, current streak
- **14-day activity grid** — GitHub-style heatmap of your recent submission activity
- **Today's activity** — problems attempted today with accept status and attempt counts
- **Review queue** — due cards with one-click rating buttons

### Code Blur on Review
When you open a problem from the review queue, AnkLeet blurs the code editor so you can attempt it fresh before revealing your previous solution.

### Data Export / Import
Transfer all your data between browsers — problem history, review schedules, and AI conversations — via a single JSON file.

---

## Install

AnkLeet is not on the Chrome Web Store. Install it as an unpacked extension:

1. **Clone the repo**
   ```
   git clone https://github.com/sumiyuan/ankleet.git
   ```

2. **Open Chrome extensions page**
   Navigate to `chrome://extensions` in your browser.

3. **Enable Developer Mode**
   Toggle the "Developer mode" switch in the top-right corner.

4. **Load the extension**
   Click "Load unpacked" and select the cloned `ankleet/` folder.

5. **Configure AI (optional)**
   Click the AnkLeet icon in your toolbar, go to the Settings tab, and paste your [OpenRouter API key](https://openrouter.ai/keys). This enables the AI chat and hint features. Without it, everything else still works.

6. **Start solving**
   Go to any problem on [leetcode.com](https://leetcode.com/problems/) and submit a solution. AnkLeet takes it from there.

---

## Architecture

AnkLeet is a vanilla Chrome Extension (Manifest V3) with no build step or npm dependencies.

```
ankleet/
├── manifest.json            # MV3 config — permissions, content scripts, service worker
├── background.js            # Service worker — data layer, SRS scheduler, OpenRouter API
├── content-main.js          # MAIN world — intercepts XHR/fetch on LeetCode pages
├── content-isolated.js      # ISOLATED world — relays messages from page to service worker
├── content-toast.js         # ISOLATED world — rating dialogs, wrong submission panel, toasts
├── content-chat.js          # ISOLATED world — floating AI chat panel (Shadow DOM)
├── popup.html / .js / .css  # Extension popup — dashboard, reviews, settings
├── fonts/                   # Bundled DM Sans and JetBrains Mono fonts
└── icons/                   # Extension icons (16, 48, 128px)
```

### Data Flow

```
LeetCode page
  │
  ├─ content-main.js (MAIN world)
  │    Intercepts fetch/XHR → extracts submission data
  │    Posts via window.postMessage
  │
  ├─ content-isolated.js (ISOLATED world)
  │    Receives postMessage → forwards via chrome.runtime.sendMessage
  │
  ├─ content-toast.js (ISOLATED world, Shadow DOM)
  │    Renders rating dialogs, wrong submission panels, toasts
  │
  └─ content-chat.js (ISOLATED world, Shadow DOM)
       Persistent AI chat FAB and side panel

Service Worker (background.js)
  │
  ├─ IndexedDB (ankleet, v3)
  │    submissions — every captured submission
  │    cards — one SRS card per problem (interval, ease, reps, lapses)
  │    reviewLogs — audit trail of every rating
  │    conversations — per-problem AI chat history
  │
  ├─ chrome.storage.local
  │    settings — API key, model, notifications config
  │
  ├─ OpenRouter API
  │    AI hints, solutions, and multi-turn chat
  │
  └─ Chrome APIs
       alarms (review check every minute)
       notifications (daily review reminder)
       action badge (due count)
```

### Design Decisions

**Two content script worlds.** LeetCode's submission detection requires intercepting `fetch` and `XMLHttpRequest` in the page's JS context (`MAIN` world). But Chrome extension APIs (`chrome.runtime`) are only available in the `ISOLATED` world. So `content-main.js` intercepts network calls and posts data via `window.postMessage`, while `content-isolated.js` relays those messages to the service worker.

**Shadow DOM for all injected UI.** Both the chat panel and toast/dialog system use closed Shadow DOM roots. This prevents LeetCode's styles from breaking the extension UI and vice versa.

**Service worker owns all data.** Content scripts are stateless and ephemeral — they request data from `background.js` via message passing. All IndexedDB reads and writes happen in the service worker, which acts as the single source of truth.

**Custom day-scale SRS over FSRS.** Traditional flashcard algorithms (like FSRS) use minute-scale learning steps because reviewing a flashcard takes seconds. Re-solving a LeetCode problem takes much longer, so AnkLeet uses a custom algorithm where intervals start at days and grow via an adaptive ease factor. This produces natural interval progression without needing to clamp or override the scheduler.

**OpenRouter over direct model APIs.** A single API key gives access to Claude, GPT, and Gemini models. Users pick their preferred model in settings without managing multiple API keys.

**No build step.** The extension is plain JavaScript with no external dependencies. No bundler, no transpiler, no node_modules. Clone and load.

---

## Permissions

| Permission | Why |
|---|---|
| `storage` | Persist settings and notification state |
| `alarms` | Check for due reviews every minute, trigger daily reminders |
| `notifications` | Daily review reminder at your configured time |
| `https://leetcode.com/*` | Intercept submissions, inject UI on problem pages |
| `https://neetcode.io/*` | Future support for neetcode problem pages |
| `https://openrouter.ai/*` | AI chat and hint API calls |

---

## License

MIT
