# Pitfalls Research

**Domain:** Chrome extension with third-party site integration (LeetCode) + FSRS spaced repetition + local-only storage
**Researched:** 2026-03-12
**Confidence:** MEDIUM — Critical pitfalls confirmed via multiple sources; some LeetCode-specific items are MEDIUM confidence due to the closed-source nature of LeetCode's frontend

---

## Critical Pitfalls

### Pitfall 1: Relying on LeetCode's DOM Selectors Instead of Network Interception

**What goes wrong:**
The content script queries the DOM for submission results (e.g., finding a "Accepted" banner via CSS selectors). LeetCode is a React SPA that frequently refactors component class names, IDs, and DOM structure. Within months of shipping, a LeetCode deploy silently breaks all DOM-based detection. Users see nothing happen when they submit — the extension appears dead.

**Why it happens:**
DOM scraping feels like the obvious first approach. The "Accepted" element is right there in the inspector. Developers grab a selector and move on. They don't discover the fragility until LeetCode redeploys.

**How to avoid:**
Intercept LeetCode's GraphQL network requests instead of parsing the DOM. LeetCode uses a GraphQL endpoint at `https://leetcode.com/graphql`. A content script injected into the `MAIN` world (using `world: "MAIN"` in the manifest content script declaration) can patch `window.fetch` and `window.XMLHttpRequest` before LeetCode's code runs, capturing submission responses. The `operationName` in the GraphQL body identifies submission operations. This is far more stable than DOM selectors because API contracts change much less frequently than UI markup. Use `window.postMessage` to relay captured data from the MAIN world script back to the isolated content script.

**Warning signs:**
- Content script selects elements by class name or text content (e.g., `document.querySelector('.text-green-s')`)
- Tests pass locally but fail after a LeetCode deploy
- No integration tests against the actual network layer

**Phase to address:**
Phase 1 (submission capture) — this is the foundation. Getting this wrong requires a full rewrite of the detection layer.

---

### Pitfall 2: LeetCode's CSP Blocking Inline Script Injection

**What goes wrong:**
The developer tries to inject a `<script>` tag with inline code into the LeetCode page to intercept fetch calls. LeetCode's strict Content Security Policy blocks inline scripts with a `script-src` directive that does not include `'unsafe-inline'`. The injected script silently fails or throws a CSP violation error.

**Why it happens:**
Many tutorials demonstrate DOM manipulation via content scripts, but the content script itself runs in an isolated world — it can't directly patch `window.fetch` on the page. The instinct is to inject a `<script>` tag with inline code, which LeetCode's CSP blocks.

**How to avoid:**
Use a file-based injection, not inline code. Declare the interceptor as a separate `.js` file in your extension and inject it using `world: "MAIN"` in `manifest.json` content scripts, or dynamically via `chrome.scripting.executeScript({ world: "MAIN", files: ["interceptor.js"] })`. Since the script is loaded from the extension origin (a `chrome-extension://` URL), it passes LeetCode's CSP. Never construct script content as a string and inject it.

**Warning signs:**
- CSP violation errors in the browser console: `Refused to execute inline script because it violates the following Content Security Policy directive`
- Code that does `document.createElement('script'); script.textContent = "..."` pattern
- The interceptor doesn't fire but no error is visible in the content script console (wrong world)

**Phase to address:**
Phase 1 (submission capture) — must be resolved before any submission data can flow.

---

### Pitfall 3: Service Worker State Loss Causing Silent Failures

**What goes wrong:**
State is stored in global JavaScript variables in the background service worker (e.g., `let pendingReviews = []`). The service worker terminates after 30 seconds of inactivity. The next time it wakes up, `pendingReviews` is empty. Alarms fire but have no data to act on. Notifications are never sent. FSRS scheduling logic runs on stale or empty state.

**Why it happens:**
In Manifest V2, background pages were persistent and global variables lived indefinitely. MV3 service workers are ephemeral. Developers familiar with MV2 (or unfamiliar with the difference) carry over the in-memory state pattern.

**How to avoid:**
Treat `chrome.storage.local` (or IndexedDB) as the sole source of truth. Never cache extension state in global variables. On every service worker wakeup, read from storage before acting. All alarm handlers must be registered at the top level of the service worker script (not inside callbacks or async functions) so they are re-registered on every wakeup. Use `chrome.alarms` instead of `setTimeout`/`setInterval` for all scheduled work — timers are terminated with the service worker.

**Warning signs:**
- Global arrays or objects in the service worker that hold review queues or submission lists
- `setTimeout` used for scheduling review notifications
- Event listeners registered inside `.then()` callbacks or async function bodies
- DevTools shows notifications working but production (with DevTools closed) doesn't fire them (DevTools prevents service worker termination, masking the bug during development)

**Phase to address:**
Phase 1 (architecture setup) and Phase 3 (notifications) — establish the pattern early or you will debug ghost failures later.

---

### Pitfall 4: FSRS Card Date Serialization Corruption in Storage

**What goes wrong:**
FSRS card objects (from `ts-fsrs`) contain JavaScript `Date` fields (`due`, `last_review`). When stored as JSON in `chrome.storage.local` or IndexedDB, `Date` objects serialize to ISO strings. When read back, they come back as strings, not `Date` objects. The FSRS scheduler receives string inputs where it expects `Date` objects, causing interval calculations to return `NaN` or incorrect values. Cards are never surfaced for review, or worse, they all become due simultaneously.

**Why it happens:**
`JSON.stringify(date)` → ISO string. `JSON.parse(isoString)` → plain string. This is standard JavaScript behavior, but developers assume round-trip fidelity. `ts-fsrs` accepts `DateInput` (which includes strings), so it may silently produce wrong results rather than throwing.

**How to avoid:**
Write explicit serialization/deserialization helpers for card objects. Before writing to storage: convert all `Date` fields to ISO strings explicitly. Before reading from storage: convert string fields back to `Date` objects using `new Date(str)`. Never store raw card objects and assume they come back usable. Add a test that stores a card, reads it back, and runs `repeat()` — verifying the returned interval is a sane number (not `NaN`, not `Infinity`).

**Warning signs:**
- Cards stored without a custom serializer/deserializer
- `typeof card.due` returns `'string'` after reading from storage
- Interval values are `NaN` or `0` in the scheduler output
- All reviews become due on the same date

**Phase to address:**
Phase 2 (FSRS integration) — build serialization as part of the data model, not as an afterthought.

---

### Pitfall 5: Mutating FSRS Card Objects Instead of Saving Returned State

**What goes wrong:**
After calling `fsrs.repeat(card, now)`, the developer modifies the original `card` object in place instead of using the returned `RecordLogItem`. The FSRS library is stateless — `repeat()` returns a new card object; the original is not updated. The stored card never advances through states. All problems remain in "New" state indefinitely regardless of how many reviews have been done.

**Why it happens:**
Mutable update patterns are common in JavaScript. `card.due = newDate` feels natural. The stateless API contract of ts-fsrs is not immediately obvious.

**How to avoid:**
After calling `const result = fsrs.repeat(card, now)`, save `result[rating].card` (the new state) to storage, replacing the old card entirely. Never mutate the input card. Document this as an explicit architectural rule in the codebase. Write a test that reviews a card three times and verifies the state advances from `New` → `Learning` → `Review`.

**Warning signs:**
- Code that does `card.due = ...` or `card.state = ...` after calling `repeat()`
- All cards stay in `State.New` after multiple reviews
- Stability/difficulty values never change across sessions

**Phase to address:**
Phase 2 (FSRS integration).

---

### Pitfall 6: chrome.storage.local Quota Exceeded Silently

**What goes wrong:**
The extension stores full submission code with every attempt. After months of usage (hundreds of problems, multiple attempts each, with code snippets), the 10 MB `chrome.storage.local` limit is hit. Storage writes fail — but only if the developer is checking `chrome.runtime.lastError`. If not checked, writes silently fail. The user's review history and FSRS card states stop updating. From the user's perspective, the extension just stops working.

**Why it happens:**
10 MB sounds large for a simple extension. Developers don't account for the cumulative growth of submission code (which can be several KB per submission), review logs, and FSRS parameters over years of use. Error checking on `chrome.storage.set` is easy to skip.

**How to avoid:**
Always handle the Promise rejection from `chrome.storage.local.set()`. Monitor storage usage with `chrome.storage.local.getBytesInUse()` and warn users when approaching the limit. Store full code snapshots strategically — consider capping at the last 3 submissions per problem, or truncating after a character limit. For larger data volumes, use IndexedDB (no practical size limit, just disk space). Design the data schema to be storage-efficient from the start.

**Warning signs:**
- Submission code stored in full without any truncation policy
- `chrome.storage.local.set()` calls without `.catch()` or `lastError` checks
- No monitoring of storage utilization
- User reports of the extension stopping after extended use

**Phase to address:**
Phase 1 (data model) — storage architecture must be decided before building the submission capture pipeline.

---

### Pitfall 7: API Key Stored in Plain Text in Extension Storage

**What goes wrong:**
The user's OpenRouter API key is stored as a plain string in `chrome.storage.local`. Any extension running in the browser can read `chrome.storage.local` of another extension if they know the extension ID (with the right permissions). More practically, users who inspect browser storage via DevTools can see the key in plain text. A malicious page with a XSS vector in the extension could also exfiltrate it.

**Why it happens:**
`chrome.storage.local` is the obvious place to put user settings. API key security for extensions is an underexplored area and most tutorials don't address it.

**How to avoid:**
This is a BYOK (bring your own key) extension, so the key must live locally. Use `chrome.storage.session` for the in-memory runtime reference (cleared on browser close, not accessible to content scripts). For persistence across sessions, store in `chrome.storage.local` but document the security tradeoff clearly in the UI. Do not store it in `window.localStorage` (accessible to page scripts). Never log the key to the console. Validate the key format before storing. Add a UI indicator showing the key is stored locally and how to revoke it.

**Warning signs:**
- API key stored as a plain string under an obvious key like `"apiKey"`
- Key accessible from content script context
- No user-facing explanation of where/how the key is stored

**Phase to address:**
Phase 4 (AI feedback integration) — establish the storage pattern before the key is ever written.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| DOM selector-based submission detection | Fast to implement | Breaks on every LeetCode UI update; requires ongoing maintenance | Never — use network interception from day one |
| Global variables in service worker for state | Simpler code | State lost on service worker termination; impossible to debug in production | Never — use storage as source of truth |
| No serialization layer for FSRS card objects | Save time initially | Date corruption corrupts all review history | Never — always serialize/deserialize |
| Skip error handling on `chrome.storage.set()` | Less boilerplate | Silent data loss when quota exceeded | Never for writes that affect user data |
| Store full submission code without limit | Simpler model | Storage quota exhausted after extended use | MVP only, with a documented cleanup task |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| LeetCode GraphQL interception | Inject inline script that LeetCode's CSP blocks | Inject a file from the extension origin into `world: "MAIN"`, relay data via `window.postMessage` |
| LeetCode GraphQL interception | Monitor DOM for "Accepted" text | Intercept the GraphQL response body and parse `operationName` + result |
| ts-fsrs `repeat()` | Mutate original card object | Use the returned card from `result[rating].card` |
| ts-fsrs date handling | Trust JSON round-trip for Date fields | Explicitly serialize to ISO string, deserialize with `new Date()` |
| OpenRouter API | Call from content script directly | Call from background service worker to avoid exposing the key to page context |
| `chrome.alarms` | Register `onAlarm` listener inside an async callback | Register at top level of service worker so it fires after service worker wakeup |
| `chrome.storage.local` | Assume unlimited capacity | Monitor usage, cap stored code, plan IndexedDB migration if needed |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Intercepting all fetch requests in MAIN world | High CPU on pages with heavy network activity | Filter immediately: only process requests to `leetcode.com/graphql` with known submission `operationName` | As soon as LeetCode makes frequent polling calls |
| Reading all FSRS cards on every service worker wakeup | Slow alarm response, storage bottleneck | Index cards by `due` date; only load cards due today on wakeup | At ~500+ tracked problems |
| Recalculating all due cards on popup open | Popup feels slow to open | Pre-compute due counts and cache them; only invalidate when a review is submitted | At ~200+ tracked problems |
| Storing full code in review log entries | Storage fills up | Cap at last 3 submissions per problem or truncate at 2000 chars | After ~6 months of active use |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Calling OpenRouter from content script | API key exposed to page JavaScript context via message passing | Make all LLM calls from background service worker; content script only triggers the request |
| Logging FSRS card data or API keys to `console.log` | DevTools-accessible in production | Remove all sensitive logging before publishing; use a debug flag |
| Using `eval()` or string-based `setTimeout()` in content script | CSP violation + XSS vector | Use closure form of `setTimeout`, never `eval()` |
| Requesting `<all_urls>` host permission | Web Store rejection + excessive user trust risk | Declare only `*://*.leetcode.com/*` in `host_permissions` |
| Not validating GraphQL response structure before parsing | Extension crash on unexpected LeetCode API response shape | Validate that expected fields exist before accessing; fail gracefully |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Notification fires but clicking it doesn't navigate to the review | User ignores all notifications after first confusing click | `chrome.notifications` click handler opens the extension popup or a review URL |
| FSRS rating shown as "Again/Hard/Good/Easy" with no context | User doesn't know what to rate their LeetCode submission | Pre-select a rating based on submission outcome (Accepted → "Good", Wrong Answer → "Again"), allow override |
| Extension silently stops after storage quota exceeded | User thinks extension is broken; loses trust | Show a storage warning badge; offer a "Clear old history" action |
| Dashboard loads slowly because all data is queried at once | Popup feels sluggish | Show a skeleton/loading state immediately; load data async |
| No indication that submissions are being tracked | User unsure if extension is working | Show a subtle "Tracking active" badge on the extension icon when on a LeetCode problem page |

---

## "Looks Done But Isn't" Checklist

- [ ] **Submission capture:** The content script captures submissions in dev — verify it still works after clearing the extension's DevTools session (service worker has restarted)
- [ ] **FSRS scheduling:** Cards appear to schedule — verify by storing a card, closing the browser, reopening, and confirming the due date is correct (not `NaN` or epoch)
- [ ] **Notifications:** Notifications appear in dev — verify they fire when the browser has been idle for 30+ seconds (service worker terminated between alarm registration and alarm fire)
- [ ] **Storage persistence:** Data survives extension reload — verify by going to `chrome://extensions`, clicking "Reload," and confirming all history is intact
- [ ] **OpenRouter call:** AI feedback works — verify the call is made from the background service worker, not the content script, by checking the initiator in DevTools Network tab
- [ ] **Storage quota:** Extension works after storing 200+ problems — run a bulk import test or simulate high-volume storage usage before shipping

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| DOM-based submission detection breaks on LeetCode update | HIGH | Rewrite detection layer to use network interception; requires re-testing all submission flows |
| FSRS date serialization corruption in production | HIGH | Ship a migration script that reads all stored cards, detects string dates, converts to Date, re-saves; notify users their history may have gaps |
| Service worker state loss pattern baked in | MEDIUM | Refactor all global state to storage reads on startup; affects alarm handlers, notification logic, and review logic |
| Storage quota exceeded in production | MEDIUM | Ship a one-time cleanup that truncates old submission code; add storage monitoring going forward |
| API key stored insecurely | LOW | Re-prompt user to re-enter key (can't migrate existing key to a different storage scope after-the-fact) |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| DOM selector fragility | Phase 1: Submission Capture | Integration test that submission detection fires off a real GraphQL response, not a DOM query |
| LeetCode CSP blocking injection | Phase 1: Submission Capture | Verify interceptor logs fire in console after LeetCode page load (no CSP errors) |
| Service worker state loss | Phase 1: Architecture | Test: restart service worker manually via DevTools, verify alarm still fires |
| FSRS date serialization corruption | Phase 2: FSRS Integration | Test: store card, read back, call `repeat()`, verify interval is a real number |
| FSRS card mutation instead of save | Phase 2: FSRS Integration | Test: review card 3 times, verify state transitions from New → Learning → Review |
| Storage quota exceeded | Phase 1: Data Model | Load test: simulate 500 problems × 5 submissions and check storage usage |
| API key stored plaintext | Phase 4: AI Feedback | Security review: confirm key is never logged, never passed to content script |

---

## Sources

- [Chrome Content Scripts — Official Docs](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — isolated worlds, CSP restrictions, MAIN world injection
- [Chrome Storage API — Official Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) — quota limits, rate limits, error handling
- [Migrate to Service Workers — Chrome for Developers](https://developer.chrome.com/docs/extensions/develop/migrate/to-service-workers) — global variable persistence, timer gotchas, alarm API requirement
- [Building LeetHub Automated Sync Feature — Richard Fu (2025)](https://www.richardfu.net/building-an-automated-leetcode-solution-post-sync-feature-for-leethub/) — real-world LeetCode CSP bypass, MAIN world injection pattern, GraphQL operationName interception
- [ts-fsrs GitHub — open-spaced-repetition](https://github.com/open-spaced-repetition/ts-fsrs) — stateless API design, card mutation pitfall
- [ts-fsrs DeepWiki](https://deepwiki.com/open-spaced-repetition/ts-fsrs) — date input handling, enable_short_term edge cases, review log structure
- [How to Secure API Keys in Chrome Extension — DEV Community](https://dev.to/notearthian/how-to-secure-api-keys-in-chrome-extension-3f19) — chrome.storage.session vs local for keys
- [Chrome Alarms API — Official Reference](https://developer.chrome.com/docs/extensions/reference/api/alarms) — alarm persistence, top-level listener registration requirement
- [MV3 Service Worker Gotchas — Chromium Extensions Group](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/k5upFLVnPqE) — alarm wakeup, inactive service worker patterns
- [Why Chrome Extensions Get Rejected — Extension Radar (2025)](https://www.extensionradar.com/blog/chrome-extension-rejected) — excessive permissions, privacy policy requirements

---

*Pitfalls research for: Chrome extension + LeetCode integration + FSRS spaced repetition*
*Researched: 2026-03-12*
