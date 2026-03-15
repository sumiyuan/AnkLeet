# Stack Research

**Domain:** Chrome Extension MV3 — AI feedback via Anthropic Messages API (v1.1 addendum)
**Researched:** 2026-03-13
**Confidence:** HIGH (all critical claims verified against official Anthropic docs and Chrome extension documentation)

---

> **Scope note:** This file supersedes the v1.0 STACK.md for AI integration decisions.
> The v1.0 stack (plain MV3 JS, IndexedDB, ts-fsrs UMD, Shadow DOM) is already shipped and
> validated. Only additions/changes needed for v1.1 AI feedback are documented here.

---

## Recommended Stack — v1.1 Additions Only

### AI Integration

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Native `fetch` | built-in | Call Anthropic Messages API from service worker | No SDK, no bundle overhead, no MV3 compatibility risk. The Messages API is a single POST endpoint. Plain fetch with 4 headers is all that is needed. The existing codebase uses plain JS with no build step — adding a Node SDK would require bundling |
| `chrome.storage.local` | built-in | Store user's Anthropic API key | Already used in the project for settings. Field already exists as `openRouterApiKey` — rename to `anthropicApiKey`. Never in content scripts or page context |

### No New Dependencies

The v1.1 feature requires **zero new npm packages or library files.** The Anthropic Messages API
is simpler than the existing LeetCode REST interception pattern already in the codebase.

---

## How to Call the Anthropic API from a Service Worker

### Endpoint and Headers

```
POST https://api.anthropic.com/v1/messages
```

Required headers:

| Header | Value | Notes |
|--------|-------|-------|
| `x-api-key` | `{user's key}` | Read from `chrome.storage.local` |
| `anthropic-version` | `2023-06-01` | Fixed string — this is the stable API version |
| `content-type` | `application/json` | Standard JSON body |
| `anthropic-dangerous-direct-browser-access` | `true` | **Required for browser CORS** — see below |

### CORS Behavior

Anthropic added CORS support in August 2024 (SDK 0.27.0 / API change). Without the
`anthropic-dangerous-direct-browser-access: true` header, the API returns a CORS error
for all browser-origin requests (including Chrome extension service workers).

**Service worker context:** Chrome extension service workers are browser-origin contexts.
The `anthropic-dangerous-direct-browser-access` header is required even in a service worker.
Confirmed by real-world extension implementations and the open GitHub issue thread.

**The name is intentional.** Anthropic named it this way to discourage embedding API keys
in public web apps. For a bring-your-own-key Chrome extension this is the correct pattern —
the key is the user's own key, stored locally, never transmitted except to Anthropic.

### Minimal Fetch Example

```javascript
async function callAnthropic(apiKey, systemPrompt, userMessage) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text; // first text block
}
```

---

## Manifest Changes Required

### 1. Add `host_permissions` for `api.anthropic.com`

```json
"host_permissions": [
  "https://leetcode.com/*",
  "https://neetcode.io/*",
  "https://api.anthropic.com/*"
]
```

Without this, Chrome blocks the fetch from the service worker entirely (not a CORS issue — a
Chrome extension permission issue). The CSP `content_security_policy` field does **not** need
to be added or changed — the default MV3 CSP restricts `script-src` only; `fetch()` network
requests to declared `host_permissions` are not blocked by CSP.

**Verification:** Chrome MV3 documentation confirms `host_permissions` governs network access
to external origins. CSP `connect-src` directives are separate from `host_permissions` and the
default extension page CSP does not include `connect-src` restrictions.

### 2. No CSP changes needed

The default MV3 `content_security_policy` is:

```
script-src 'self' 'wasm-unsafe-eval'; object-src 'self';
```

This restricts script loading only. `fetch()` calls from service workers to declared
`host_permissions` origins are not blocked by this policy. Do not add a custom
`content_security_policy` unless there is a specific reason — the Chrome Web Store review
process scrutinizes CSP relaxations.

---

## Model Recommendation

Use `claude-haiku-4-5-20251001` (API alias: `claude-haiku-4-5`).

| Model | API ID | Input | Output | Rationale |
|-------|--------|-------|--------|-----------|
| **Claude Haiku 4.5** | `claude-haiku-4-5-20251001` | $1/MTok | $5/MTok | Fastest, cheapest, strong coding performance (73.3% SWE-bench). For hint/solution generation on LeetCode problems this is more than sufficient |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | $3/MTok | $15/MTok | Use if Haiku quality is demonstrably insufficient for complex problems |
| Claude Opus 4.6 | `claude-opus-4-6` | $5/MTok | $25/MTok | Overkill for single-problem hints |

A typical hint request is ~300 input tokens (problem title + user code + error message) and
~400 output tokens. At Haiku 4.5 rates: approximately **$0.000275 per request** — effectively
free from a user's perspective.

**Expose model as a user setting?** Not recommended for v1.1. Hard-code Haiku 4.5 and
revisit if users request Opus/Sonnet. Reduces UI complexity.

---

## API Key Storage

Store as `settings.anthropicApiKey` in `chrome.storage.local` — the same `settings` object
already used by the extension for `openRouterApiKey` and notification preferences.

**Rename from `openRouterApiKey` to `anthropicApiKey`:** The existing popup settings form
already has the field wired up; only the key name and label text need updating.

**Do not** store the key in `chrome.storage.sync` — sync storage has a 100KB total quota and
is shared across devices, which could create confusion if a user has different keys per device.

**Do not** store the key in `sessionStorage` or `localStorage` — these are not accessible
from the service worker.

---

## Alternatives Considered

| Recommended | Alternative | Why Not |
|-------------|-------------|---------|
| Plain `fetch` | `@anthropic-ai/sdk` npm package | SDK requires a bundler (not used in this project), adds ~300KB to extension size, and the `dangerouslyAllowBrowser: true` constructor flag is equivalent to our header approach. No benefit for a single endpoint call |
| Plain `fetch` | OpenRouter proxy | OpenRouter was referenced in earlier planning but the active milestone explicitly specifies direct Anthropic API. OpenRouter adds a middleman and requires a separate API key |
| `chrome.storage.local` | Hardcoded API key | Never — users must provide their own key per Chrome Web Store policy |
| `chrome.storage.local` | `chrome.storage.session` | Session storage is cleared when browser closes; users would need to re-enter key every browser restart |

---

## What NOT to Add

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@anthropic-ai/sdk` npm package | Requires bundler this project does not have; `dangerouslyAllowBrowser: true` is equivalent to setting the header manually; adds significant bundle weight | Plain `fetch` |
| Streaming responses | Adds message-passing complexity (streaming from service worker to popup requires ports, not sendMessage). Haiku 4.5 is fast enough that a single response completes in 1-3 seconds | Single `await response.json()` |
| Custom `content_security_policy` in manifest | Not needed for fetch to `host_permissions` origins; Chrome Web Store reviewers scrutinize any CSP entry | Omit the field entirely |
| Server-side proxy | Defeats the local-only, privacy-first design; adds hosting cost and complexity | Direct fetch from service worker |
| LangChain / LlamaIndex | Massive overhead for a single-turn completion call | Plain `fetch` |

---

## Sources

- Anthropic Models Overview: [platform.claude.com/docs/en/about-claude/models/overview](https://platform.claude.com/docs/en/about-claude/models/overview) — HIGH confidence (official docs, verified 2026-03-13)
- Anthropic Pricing: [platform.claude.com/docs/en/about-claude/pricing](https://platform.claude.com/docs/en/about-claude/pricing) — HIGH confidence (official docs, verified 2026-03-13)
- CORS support announcement (Aug 2024): [simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access](https://simonwillison.net/2024/Aug/23/anthropic-dangerous-direct-browser-access/) — HIGH confidence (contemporaneous coverage of official Anthropic change)
- CORS GitHub issue resolution: [github.com/anthropics/anthropic-sdk-typescript/issues/410](https://github.com/anthropics/anthropic-sdk-typescript/issues/410) — HIGH confidence (official repo issue, resolved in SDK 0.27.0)
- Chrome MV3 CSP defaults: [developer.chrome.com/docs/extensions/mv3/manifest/content_security_policy](https://developer.chrome.com/docs/extensions/mv3/manifest/content_security_policy/) — HIGH confidence (official Chrome docs)
- Chrome MV3 host_permissions: Chrome Extensions developer docs — HIGH confidence; `host_permissions` governs network access; CSP governs script loading separately
- Real-world Chrome extension + Anthropic: [github.com/aramxc/claude-on-chrome](https://github.com/aramxc/claude-on-chrome) — MEDIUM confidence (community example confirming pattern)

---

*Stack research for: v1.1 AI feedback — Anthropic Messages API in existing MV3 service worker*
*Researched: 2026-03-13*
