# Project Research Summary

**Project:** LeetReminder — LeetCode FSRS Tracker with AI Feedback
**Domain:** Chrome Extension (MV3) with third-party site integration, local-only storage, spaced repetition
**Researched:** 2026-03-12
**Confidence:** MEDIUM-HIGH

## Executive Summary

LeetReminder is a Chrome extension that automatically captures LeetCode submissions (both accepted and wrong answers), schedules reviews using the FSRS spaced repetition algorithm, and optionally provides AI-generated hints on incorrect attempts. Every comparable tool in the market either uses fixed-interval scheduling, captures only accepted answers, or requires manual logging — this product's differentiation is fully automatic capture plus adaptive FSRS scheduling plus AI feedback, all with zero backend infrastructure. The recommended approach is WXT (the 2025 consensus Chrome extension framework built on Vite) with React 19, TypeScript, ts-fsrs, Dexie.js for IndexedDB, and the @openrouter/sdk for AI — a well-validated stack with multiple community templates confirming it works together.

The single highest-risk technical element is submission capture. LeetCode is a React SPA with a strict Content Security Policy that blocks inline script injection. The only reliable, stable approach is to inject a file-based script into the MAIN world (page context) that overrides `window.fetch` before LeetCode's JavaScript loads, then relay captured submission data through `window.postMessage` to the isolated content script, then via `chrome.runtime.sendMessage` to the service worker. DOM selector approaches (grabbing the "Accepted" banner text) will break on every LeetCode UI update and must never be used. This network interception architecture, combined with proper MV3 service worker patterns (no global state, `chrome.alarms` instead of `setTimeout`, synchronous top-level listener registration), are the foundation everything else depends on.

Key risks beyond submission capture are FSRS card date serialization (JavaScript `Date` objects must be explicitly serialized to ISO strings and deserialized back, or interval calculations silently return `NaN`), storage quota management (chrome.storage.local has a 10 MB cap that full code storage will eventually hit), and service worker state loss (all state must live in storage, not global variables, because the service worker terminates after 30 seconds of inactivity). These risks have clear, established mitigations — they are well-documented traps, not unknown unknowns.

---

## Key Findings

### Recommended Stack

WXT 0.20.18 is the unambiguous choice for Chrome extension scaffolding in 2025. It is Vite-powered with first-class React support, built-in type-safe storage wrappers, auto-imports, HMR for service workers and content scripts, and native support for `world: 'MAIN'` content scripts — which is required for the submission capture architecture. Plasmo is in maintenance mode and must not be used. CRXJS lacks built-in storage and messaging APIs.

For spaced repetition, ts-fsrs 5.2.3 is the official TypeScript implementation from the open-spaced-repetition org, ESM-only, browser-compatible, and actively maintained. fsrs.js (the predecessor) was deprecated by the same org. For AI, the @openrouter/sdk 0.9.11 provides a type-safe client for 300+ models behind a single BYOK integration; raw fetch to OpenRouter's endpoint is a valid fallback if the SDK has MV3 CSP issues.

**Core technologies:**
- WXT 0.20.18: Chrome extension framework — Vite-based, active in 2025, first-class React + Tailwind, handles MV3 manifest and multi-entrypoint bundling
- TypeScript 5.x: Type safety — mandatory for ts-fsrs and @openrouter/sdk; catches card state bugs at compile time
- React 19 + Tailwind CSS 4: Popup/dashboard UI — WXT has first-class module support; must configure rem→px to avoid host-page font-size leakage
- ts-fsrs 5.2.3: FSRS algorithm — official TypeScript implementation, stateless API, browser-compatible ESM
- @openrouter/sdk 0.9.11: AI integration — unified access to GPT-4/Claude/Gemini via user's own API key; pin exact version (beta)
- Dexie.js 4.0: IndexedDB wrapper — for submission history (unbounded growth); chrome.storage.local for settings/FSRS card state (fast, reactive, 10 MB cap)
- shadcn/ui: UI component primitives — copy-paste components (not a dependency), Tailwind 4 compatible

### Expected Features

The core value chain is: automatic capture → local history → FSRS scheduling → review queue → self-assessment rating → updated FSRS interval. Every link in this chain is a P1 dependency; removing any one breaks the product entirely. AI feedback is a high-value differentiator but is genuinely optional — it depends only on an API key being configured.

**Must have (table stakes):**
- Automatic submission capture (accepted AND wrong answers) — root dependency for everything; no existing tool captures wrong answers automatically
- Local problem history (title, difficulty, result, timestamp, code) — foundation for all scheduling and display
- FSRS scheduling via ts-fsrs — the core differentiator vs. fixed-interval competitors
- Due today review queue in popup — the daily action surface users open the extension for
- Self-assessment rating UI (Again / Hard / Good / Easy) — required by FSRS `repeat()` to compute next interval
- Link from review queue to LeetCode problem page — reviews happen on LeetCode; this is the "go solve it" button
- Browser notifications when reviews are due (chrome.alarms + chrome.notifications) — without this, the extension is invisible on non-active days
- Settings page with OpenRouter API key input — even if AI is optional in v1, collecting the key now avoids migration pain

**Should have (competitive):**
- AI feedback on wrong submissions (hint mode + full explanation mode) — the feature no competitor has; turns failures into learning moments
- Daily activity view — motivating once there's enough history (~1 week of use)
- Data export/import (JSON) — local-only storage makes this essential for trust; add once users have data worth protecting
- First-attempt vs multi-attempt signal feeding FSRS — low effort, improves scheduling quality

**Defer (v2+):**
- Multiple LLM model selector — add after AI feature is validated
- Pattern/category-based review grouping — meaningful only at 50+ problems
- Mastery threshold / auto-archive — FSRS supports this via retrievability score; adds complexity
- Full submission code diff view (old vs new code)

**Anti-features to avoid:** In-extension code editor (defeats the purpose — reviews belong on LeetCode), cloud sync (requires backend, kills zero-infrastructure design), streak tracking (LeetCode already does this), storing full problem descriptions (copyright risk + storage bloat).

### Architecture Approach

The system has four distinct execution contexts that cannot share memory and must communicate through defined channels: the MAIN world injected script (page context, no Chrome APIs), the isolated content script (can call Chrome APIs, cannot touch page's `window`), the background service worker (event-driven, terminates after 30s idle, all state in storage), and the popup React SPA (standard web app that queries the service worker for data). The storage layer is split: `chrome.storage.local` for settings and reactive small data (10 MB cap), Dexie.js/IndexedDB for all submission history and FSRS card state (no practical size limit). The service worker is the single writer for IndexedDB; the popup reads through service worker messages.

**Major components:**
1. Injected script (MAIN world, `injected.ts`) — overrides `window.fetch`/`XHR`, intercepts LeetCode `/check/` API responses, dispatches `CustomEvent` to content script
2. Content script (ISOLATED world, `content/index.ts`) — listens for `CustomEvent` from injected script, forwards to service worker via `chrome.runtime.sendMessage`
3. Background service worker (`background/index.ts`) — central coordinator: processes submissions, runs FSRS via ts-fsrs, manages alarms, calls OpenRouter API, fires notifications, responds to popup queries
4. Popup React SPA — dashboard showing due reviews, daily stats, history, and settings; communicates with service worker for all data
5. Storage layer — `chrome.storage.local` (settings, API key, counters) + Dexie.js IndexedDB (submissions, FSRS card state, review history)

Build order is dictated by dependency: shared types → IndexedDB schema → content script/injected script → submission handler + FSRS engine → alarm/notification handler → popup UI → AI handler.

### Critical Pitfalls

1. **DOM selector-based submission detection** — LeetCode's React SPA refactors class names regularly; DOM selectors break silently. Use MAIN world network interception of `/check/` responses only. Never use `document.querySelector` for submission results.

2. **Inline script injection blocked by LeetCode's CSP** — `document.createElement('script'); script.textContent = "..."` is blocked by LeetCode's CSP. Declare the interceptor as a separate file and inject it via `world: "MAIN"` in the manifest content scripts declaration. File-based injection from the extension origin passes CSP.

3. **Service worker state loss** — MV3 service workers terminate after 30s idle. Global variables reset on restart. Use `chrome.storage.local` as sole source of truth. Register all listeners synchronously at the top level (never inside async functions). Use `chrome.alarms` instead of `setTimeout`.

4. **FSRS card date serialization corruption** — `Date` objects serialize to ISO strings in JSON; ts-fsrs receives strings instead of `Date` objects and silently returns `NaN` intervals. Write explicit serialize/deserialize helpers; test by storing a card, reading it back, running `repeat()`, and verifying the returned interval is a real number.

5. **FSRS card mutation instead of saving returned state** — `fsrs.repeat()` is stateless; it returns a new card object, it does not mutate the input. Always save `result[rating].card` to storage. Never do `card.due = newDate` after calling `repeat()`.

6. **chrome.storage.local quota exceeded silently** — 10 MB limit will be hit after months of full-code-per-submission storage. Always handle `.catch()` on storage writes. Store full code in IndexedDB, cap retention per problem. Monitor with `getBytesInUse()`.

---

## Implications for Roadmap

Based on the dependency chain in FEATURES.md and the build order in ARCHITECTURE.md, the natural phase structure emerges from what must be true before anything else can work.

### Phase 1: Foundation and Submission Capture

**Rationale:** Submission capture is the root dependency of the entire feature tree. Without it, there is no data, no scheduling, no history, no AI — nothing. The architecture setup decisions (storage split, message type schema, MV3 listener patterns) made here propagate to every subsequent phase. The highest-risk pitfalls (DOM selectors, CSP injection, service worker state loss, storage quota) all require correct decisions at this phase.

**Delivers:** Working Chrome extension that detects LeetCode submissions (accepted + wrong), stores them locally in IndexedDB, captures problem title/difficulty/result/timestamp/code.

**Addresses features:** Automatic submission capture, local problem history, problem metadata.

**Avoids:** DOM selector fragility (use network interception), CSP injection errors (use `world: "MAIN"` file-based injection), service worker state loss (establish storage-as-source-of-truth pattern from day one), storage quota (design schema with IndexedDB for submissions, chrome.storage.local for settings only).

### Phase 2: FSRS Scheduling Engine

**Rationale:** Scheduling is the core differentiator and the second link in the dependency chain. The ts-fsrs API is stateless and well-documented, but its date serialization and immutable card update requirements are exact failure modes identified in research. Build this correctly once with tests before connecting it to the UI.

**Delivers:** FSRS card creation for each new problem, interval calculation on submission, card state persistence in IndexedDB with proper serialization, due-date query capability.

**Uses:** ts-fsrs 5.2.3, Dexie.js IndexedDB, `background/fsrs/engine.ts` + `background/storage/cards.ts`.

**Avoids:** Date serialization corruption (explicit `new Date()` deserialization), card mutation (save `result[rating].card` not the original), reading all cards on startup (index on `nextDueDate` from the beginning).

**Implements:** FSRS engine + scheduler components from the architecture.

### Phase 3: Review Queue and Notifications

**Rationale:** The review queue is the daily action surface — the reason a user opens the extension. Notifications make the tool work on days users don't actively think about it. Both depend on the FSRS scheduling engine from Phase 2 being operational.

**Delivers:** Popup dashboard with "Due Today" queue, self-assessment rating UI (Again/Hard/Good/Easy), links to LeetCode problem pages for review, chrome.alarms-based notifications when reviews are due.

**Addresses features:** Due today review queue, self-assessment rating, link to LeetCode problem, browser notifications.

**Avoids:** `setTimeout` for alarms (use `chrome.alarms`), async listener registration (top-level synchronous registration), notification click handler must open popup or review URL (not silently do nothing).

### Phase 4: Popup Dashboard and Settings

**Rationale:** With the data pipeline and scheduling working, the popup UI can be built as a React SPA that queries the service worker for data. Settings management (OpenRouter API key input) is included here because it gates Phase 5, and establishing the key storage pattern before the key is ever written is safer than retrofitting it.

**Delivers:** Full popup UI with Dashboard (daily stats, due count), Reviews page, History page with submission list, Settings page with API key input and notification preferences.

**Uses:** React 19, Tailwind CSS 4, shadcn/ui components, `popup/hooks/useStorage.ts` and `useMessages.ts`.

**Avoids:** Slow popup open (skeleton/loading state immediately, load data async), missing "tracking active" indicator (show badge on extension icon when on LeetCode), API key stored under obvious plain key with no UX explanation.

### Phase 5: AI Feedback Integration

**Rationale:** AI feedback is the highest-value differentiator but depends on everything before it — submission capture (to have wrong answers), history storage (to have submission code as context), and settings (to have the API key). It is isolated in its own phase because it has a hard external API dependency (OpenRouter) and unique security requirements.

**Delivers:** "Get Feedback" button on wrong submissions, hint mode and full explanation mode, AI call from background service worker (never from content script), graceful degradation when no API key is set.

**Uses:** @openrouter/sdk 0.9.11 (or raw fetch fallback), OpenRouter BYOK model, `background/handlers/ai.ts`.

**Avoids:** Calling OpenRouter from the content script (API key exposure), logging the API key, crashing when API key is not set (hide the button instead), using LangChain or other heavy SDKs.

### Phase 6: Quality of Life and Data Management

**Rationale:** These features add meaningful polish and trust but have no hard dependencies on each other. They are safe to defer until the core product is validated.

**Delivers:** Daily activity view, JSON data export/import, first-attempt vs multi-attempt FSRS signal, storage usage monitoring with user-facing warning.

**Addresses features:** Daily activity view, data export/import, first-attempt tracking.

---

### Phase Ordering Rationale

- Phases 1-3 are strictly sequenced by the dependency chain: capture → schedule → surface. You cannot skip any step.
- Phase 4 (popup UI) could theoretically start in parallel with Phase 2 using mock data, but completing Phase 2 first prevents building UI against an untested data model.
- Phase 5 (AI) is intentionally last among core features: it has the most external dependencies (API key, OpenRouter service), the most security surface area, and the least impact on core functionality if deferred.
- Phase 6 is genuinely additive — none of Phase 6 is required for the product to deliver its core value proposition.

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 1 (Submission Capture):** LeetCode's GraphQL endpoint structure and `operationName` values for submission polling are not publicly documented. Will need to intercept and inspect real traffic to identify the exact endpoint patterns before building the interceptor. The `/submissions/detail/{id}/check/` REST pattern is confirmed by community sources (MEDIUM confidence), but GraphQL is the newer path — verify which LeetCode currently uses.
- **Phase 5 (AI Feedback):** @openrouter/sdk is in beta (0.9.11 pinned); verify it has no MV3 service worker compatibility issues (ESM imports, CSP headers) before building against it. The fallback to raw fetch is documented if issues arise.

Phases with standard patterns (skip research-phase):

- **Phase 2 (FSRS Scheduling):** ts-fsrs is thoroughly documented with official examples. The API is stable and the pitfalls are well-characterized.
- **Phase 3 (Alarms/Notifications):** chrome.alarms and chrome.notifications are official Chrome APIs with complete documentation. Patterns are established.
- **Phase 4 (Popup UI):** Standard React SPA patterns apply. WXT + React + Tailwind + shadcn has confirmed community templates.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Core choices (WXT, ts-fsrs, React, Tailwind) verified via official repos and community templates. @openrouter/sdk pinned at beta version — minor uncertainty. |
| Features | MEDIUM | Competitor landscape verified against live products and community threads. LeetCode-specific behavior (what users actually want vs fixed-interval tools) is community-validated but not user-tested. |
| Architecture | HIGH | Based primarily on official Chrome Developer documentation. MAIN world injection pattern confirmed by multiple community implementations of LeetCode-adjacent extensions. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls (CSP, service worker state, FSRS API) cross-referenced from official docs + practitioner accounts. LeetCode-specific API stability is MEDIUM — LeetCode does not publish a public API contract. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **LeetCode API endpoint verification:** The exact GraphQL `operationName` or REST endpoint path for submission polling needs to be confirmed by intercepting real LeetCode traffic during Phase 1. Do not hard-code an endpoint without live verification.
- **@openrouter/sdk MV3 compatibility:** The SDK is ESM-only and in beta. Verify it can be imported in a MV3 service worker without CSP or module format issues before committing to it in Phase 5. The raw fetch fallback is ready if needed.
- **Storage schema migration strategy:** The research recommends IndexedDB `onupgradeneeded` handlers from day one. Define an explicit versioning strategy in Phase 1 before any schema is committed, to avoid costly migrations after data is in users' browsers.
- **Tailwind rem→px configuration:** Confirm the rem-to-px configuration works correctly in the WXT + Tailwind 4 setup to prevent popup font size being controlled by LeetCode's host page CSS (affects popup when opened on leetcode.com tab).

---

## Sources

### Primary (HIGH confidence)
- [wxt-dev/wxt GitHub Releases](https://github.com/wxt-dev/wxt/releases) — WXT version and release date
- [wxt.dev/guide/essentials/storage](https://wxt.dev/guide/essentials/storage.html) — WXT storage API
- [open-spaced-repetition/ts-fsrs GitHub](https://github.com/open-spaced-repetition/ts-fsrs) — FSRS TypeScript implementation
- [OpenRouterTeam/typescript-sdk GitHub](https://github.com/OpenRouterTeam/typescript-sdk) — OpenRouter SDK
- [Chrome Extension Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — MV3 patterns
- [Content Scripts Documentation](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — isolated vs MAIN world
- [chrome.storage API Reference](https://developer.chrome.com/docs/extensions/reference/api/storage) — quota limits
- [chrome.alarms API Reference](https://developer.chrome.com/docs/extensions/reference/api/alarms) — alarm patterns
- [Chrome Extension Message Passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging) — runtime messaging
- [javydevx/leetcode-tracker GitHub](https://github.com/javydevx/leetcode-tracker) — closest open-source analog

### Secondary (MEDIUM confidence)
- [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — WXT vs Plasmo vs CRXJS comparison
- [Building LeetHub Automated Sync Feature (Richard Fu, 2025)](https://www.richardfu.net/building-an-automated-leetcode-solution-post-sync-feature-for-leethub/) — LeetCode CSP bypass, MAIN world injection, GraphQL operationName interception
- [Lanki HN thread](https://news.ycombinator.com/item?id=40173237) — user feature requests, competitor signal
- [WXT + React + shadcn + Tailwind community template](https://github.com/imtiger/wxt-react-shadcn-tailwindcss-chrome-extension) — stack compatibility confirmation
- [ts-fsrs DeepWiki](https://deepwiki.com/open-spaced-repetition/ts-fsrs) — date input handling, enable_short_term edge cases
- [How to Secure API Keys in Chrome Extension](https://dev.to/notearthian/how-to-secure-api-keys-in-chrome-extension-3f19) — chrome.storage.session vs local
- [Network Request Interception Patterns](https://rxliuli.com/blog/intercepting-network-requests-in-chrome-extensions/) — MAIN world fetch override technique
- [LeetCopilot: Best LeetCode Chrome Extensions 2026](https://leetcopilot.dev/blog/best-leetcode-chrome-extensions-2025) — competitor feature survey

### Tertiary (LOW confidence)
- [Hacker News DSA spaced repetition CLI](https://news.ycombinator.com/item?id=45480280) — implementation patterns (minimal HN engagement)

---

*Research completed: 2026-03-12*
*Ready for roadmap: yes*
