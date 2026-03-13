# Stack Research

**Domain:** Chrome Extension (LeetCode tracker with FSRS spaced repetition + AI feedback)
**Researched:** 2026-03-12
**Confidence:** MEDIUM-HIGH (core stack HIGH, version numbers MEDIUM — some npm versions could not be confirmed via direct registry access)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WXT | 0.20.18 | Chrome extension framework | Clear 2025 market leader for extension development. Vite-powered, active maintenance (released Feb 22 2025), framework-agnostic, auto-imports, built-in storage wrapper, HMR for service workers and content scripts. Outperforms Plasmo (maintenance mode) and CRXJS (plugin-only, no built-in APIs) |
| TypeScript | 5.x (latest) | Type safety across entire codebase | Mandatory for ts-fsrs and @openrouter/sdk which both ship TypeScript types. Catches card state bugs at compile time instead of runtime |
| React | 19.x | Popup/dashboard UI | React 19 compiler auto-optimizes re-renders — critical for the popup dashboard which shows live review state. WXT has first-class `@wxt-dev/module-react` support |
| Tailwind CSS | 4.x | Styling | WXT + Tailwind v4 is a confirmed working combination with starter templates. Produces lean, consistent UI without custom CSS overhead. Must configure `rem` → `px` to avoid host-page font-size leakage into popup |
| Chrome MV3 | — | Extension platform | Required by Chrome Web Store. WXT targets MV3 by default. Background is a service worker, not a persistent background page |

### Spaced Repetition

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| ts-fsrs | 5.2.3 | FSRS algorithm implementation | The official TypeScript FSRS implementation from the open-spaced-repetition org. Actively maintained, ships ES modules, supports both FSRS v5 and v6. Supersedes fsrs.js (deprecated by the same org). Node >= 20 required but this runs in the browser, not Node |

### AI Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| @openrouter/sdk | 0.9.11 | OpenRouter API client | Official SDK from OpenRouterTeam. Type-safe, supports streaming, provides unified access to 300+ models. Beta — pin exact version. For a user-side-key extension, the SDK is simpler than raw fetch |
| Native fetch (fallback) | — | OpenRouter API calls | If SDK has MV3 service worker compatibility issues, raw fetch to `https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer` header is fully documented and sufficient |

### Storage

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| WXT Storage (`wxt/utils/storage`) | built-in | Extension settings, FSRS card state, API key | WXT's built-in wrapper over `chrome.storage.local`. Type-safe, supports watchers, versioning, metadata. Sufficient for settings and small card datasets. Limit: 10 MB (can request `unlimitedStorage` permission to raise this) |
| Dexie.js | 4.0 | IndexedDB for submission history | For submission history (code + timestamps + review logs), the dataset will grow unbounded. Dexie wraps IndexedDB with a clean async API. Use for the submissions table; keep FSRS card state in WXT storage for reactivity |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `wxt` CLI | Project scaffolding, dev server, build, zip | `npx wxt` — generates MV3 manifest, handles multi-entrypoint bundling |
| `@wxt-dev/module-react` | WXT React module | Adds React JSX transform and module configuration to WXT |
| `shadcn/ui` | Accessible UI component primitives | Copy-paste components (not a dep). Works with Tailwind v4 in extension popups. Provides Card, Button, Badge, Progress, etc. for the dashboard |
| ESLint + TypeScript ESLint | Linting | Standard TS project linting |
| Prettier | Formatting | Consistent code style |

---

## Content Script: Network Interception Strategy

This is the most critical technical decision in the stack. LeetCode submission detection requires intercepting XHR/fetch responses in the page context.

**The MV3 constraint:** Content scripts run in an isolated world — they cannot directly intercept page-initiated network requests. `chrome.webRequest` can no longer read response bodies in MV3.

**The solution:** Inject a script into the **MAIN world** (page context) that overrides `window.fetch` and `XMLHttpRequest` before LeetCode's JavaScript loads. The injected script posts captured submission data to the content script via `window.postMessage`. The content script relays to the service worker via `chrome.runtime.sendMessage`.

```
Page context (injected script)         Content script world           Service worker
  ↓ override fetch/XHR                      ↓ listen postMessage         ↓ store + schedule
  ↓ capture /submit response body    →      ↓ chrome.runtime.sendMessage → FSRS + IndexedDB
```

WXT supports `world: 'MAIN'` content scripts natively in its entrypoint configuration, making this pattern straightforward.

**Do not use:** `declarativeNetRequest` (cannot read response body), `chrome.webRequest` in MV3 (response body blocked), MSW (requires service worker registration on page origin — not possible for content scripts).

---

## Installation

```bash
# Bootstrap project
npx wxt@latest init leetreminder
# Select: React, TypeScript, Tailwind CSS

# Add WXT React module
npm install @wxt-dev/module-react

# Spaced repetition
npm install ts-fsrs

# AI integration
npm install @openrouter/sdk@0.9.11

# IndexedDB for submission history
npm install dexie

# UI components (shadcn — copy-paste, no package install)
# Run shadcn init after Tailwind is configured
npx shadcn@latest init

# Dev dependencies (most included by WXT init)
npm install -D typescript @types/chrome eslint prettier
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| WXT | Plasmo | Never for new projects — Plasmo is in maintenance mode as of 2025 |
| WXT | CRXJS (Vite plugin) | Only if you need a minimal Vite plugin with no framework opinions and are prepared to wire up storage, messaging, and build tooling manually |
| WXT | Bare Vite + webpack | Never — WXT IS Vite under the hood but adds all the extension-specific config automatically |
| ts-fsrs | fsrs.js | Never — the ts-fsrs authors explicitly deprecated fsrs.js in favor of ts-fsrs |
| ts-fsrs | SM-2 (custom) | Only if FSRS is overkill (it is not — FSRS has measurably better retention curves) |
| @openrouter/sdk | Raw fetch | If the SDK has MV3 CSP issues or bloats bundle; raw fetch to OpenRouter's endpoint works identically |
| Dexie.js | chrome.storage.local with unlimitedStorage | chrome.storage.local is simpler but lacks query capabilities; use it only if submission volume will stay under ~2K records |
| Dexie.js | RxDB | Overkill — RxDB adds reactive sync and replication we do not need for local-only storage |
| React 19 | React 18 | React 18 is fine if react-compiler causes issues; both work with WXT |
| shadcn/ui | Radix UI directly | shadcn adds Tailwind styling on top of Radix; use Radix directly only if you want full custom styling |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Plasmo | Maintenance mode — lagging Parcel, community-reported build issues, shrinking maintainer presence | WXT |
| CRXJS (for this project) | No built-in storage/messaging APIs; still pre-stable; provides only a Vite plugin requiring manual extension wiring | WXT |
| fsrs.js | Officially deprecated by open-spaced-repetition org; maintainer recommends ts-fsrs | ts-fsrs 5.x |
| webpack | No HMR for extension contexts, slow rebuild, no tree-shaking by default | WXT (Vite under the hood) |
| `chrome.webRequest` for response body capture | Blocked in MV3 — cannot read response bodies; will silently fail | MAIN-world content script with `window.fetch` override |
| localStorage for extension data | Not shared across extension contexts (popup, service worker, content script) | `chrome.storage.local` via WXT storage util |
| Directly importing heavy AI SDKs (LangChain, LlamaIndex) | Massive bundle sizes, server-side assumptions, unnecessary abstraction for a simple chat completion call | @openrouter/sdk or raw fetch |

---

## Stack Patterns by Variant

**For FSRS scheduling (pure calculation, no I/O):**
- Run in the service worker or inline in the popup
- ts-fsrs is pure TypeScript with no DOM or Node.js dependencies
- Use `createEmptyCard()` → `new FSRS()` → `fsrs.repeat(card, now)` → persist chosen rating card back to storage

**For submission detection (content script):**
- Entrypoint with `world: 'MAIN'` in WXT
- Override `fetch` at `document_start` to intercept LeetCode's submission API calls
- Filter for LeetCode's `/problems/*/submit/` response pattern
- Post to isolated content script world via `postMessage`

**For AI feedback (service worker):**
- Receive message from popup with problem code + error output
- Call `@openrouter/sdk` or `fetch` to OpenRouter
- Stream response back to popup via `chrome.runtime.sendMessage` or streaming port

**For review scheduling (service worker + alarm):**
- Register `chrome.alarms.create()` for next due card at service worker startup
- Re-register alarm each time service worker wakes (alarms are not guaranteed to persist across restarts)
- Use `chrome.notifications.create()` to surface due review to user

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| wxt@0.20.18 | React 19, Tailwind 4, TypeScript 5 | Confirmed — WXT starter templates use this combination |
| ts-fsrs@5.2.3 | TypeScript 5.x, ESM | ESM-only; WXT's Vite build handles this correctly |
| @openrouter/sdk@0.9.11 | ESM only | ESM-only package. MV3 service workers support ESM modules. Verify CSP policy does not block `https://openrouter.ai` in production |
| dexie@4.0 | Chrome 80+, MV3 | IndexedDB available in all extension contexts (popup, content script, service worker) |
| shadcn/ui | Tailwind 4, React 19 | shadcn CLI generates components; verify `tailwind.config` is v4 compatible post-init |

---

## Sources

- WXT comparison and version: [2025 State of Browser Extension Frameworks](https://redreamality.com/blog/the-2025-state-of-browser-extension-frameworks-a-comparative-analysis-of-plasmo-wxt-and-crxjs/) — MEDIUM confidence (WebSearch + WebFetch verified)
- WXT latest release: [wxt-dev/wxt GitHub Releases](https://github.com/wxt-dev/wxt/releases) — HIGH confidence (official GitHub, v0.20.18, Feb 22 2025)
- WXT storage API: [wxt.dev/guide/essentials/storage](https://wxt.dev/guide/essentials/storage.html) — HIGH confidence (official docs)
- ts-fsrs: [open-spaced-repetition/ts-fsrs GitHub](https://github.com/open-spaced-repetition/ts-fsrs) — HIGH confidence (official repo, v5.2.3)
- ts-fsrs API: [TS-FSRS Official Docs](https://open-spaced-repetition.github.io/ts-fsrs/) — HIGH confidence (official docs)
- OpenRouter SDK: [OpenRouterTeam/typescript-sdk GitHub](https://github.com/OpenRouterTeam/typescript-sdk) — HIGH confidence (official repo, v0.9.11, Feb 23 2026)
- OpenRouter quickstart: [openrouter.ai/docs/quickstart](https://openrouter.ai/docs/quickstart) — HIGH confidence (official docs)
- Chrome MV3 network interception: [Intercepting Network Requests in Chrome Extensions](https://rxliuli.com/blog/intercepting-network-requests-in-chrome-extensions/) + [Chrome Developers MV3 content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — MEDIUM confidence (blog + official docs)
- Chrome storage limits: [chrome.storage API reference](https://developer.chrome.com/docs/extensions/reference/api/storage) — HIGH confidence (official docs)
- Dexie.js: [dexie.org](https://dexie.org) — MEDIUM confidence (official site, v4.0 confirmed)
- WXT + React + Tailwind + shadcn template: [imtiger/wxt-react-shadcn-tailwindcss-chrome-extension](https://github.com/imtiger/wxt-react-shadcn-tailwindcss-chrome-extension) — MEDIUM confidence (community template, confirms stack compatibility)

---

*Stack research for: Chrome Extension — LeetCode tracker with FSRS spaced repetition and OpenRouter AI*
*Researched: 2026-03-12*
