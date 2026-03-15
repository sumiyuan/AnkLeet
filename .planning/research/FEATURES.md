# Feature Research

**Domain:** AI-powered code feedback on wrong LeetCode submissions (Chrome extension, MV3)
**Researched:** 2026-03-13
**Confidence:** HIGH (API patterns from official docs), MEDIUM (UX patterns from community/competitor data)

> **Scope note:** This is v1.1 milestone research. The existing v1.0 features (submission capture,
> FSRS queue, rating dialog, toast, badge, settings) are already built. This file covers only
> the NEW AI feedback features being added.

---

## What the Existing Pipeline Already Provides

The submission capture pipeline stores these fields — all available as context for AI calls:

| Field | Source | Notes |
|-------|--------|-------|
| `titleSlug` | REST `/check/` | Problem identifier |
| `title` | REST or GraphQL | Human-readable problem name |
| `difficulty` | GraphQL path only | null on REST path |
| `topicTags[]` | GraphQL path only | empty on REST path |
| `code` | REST or GraphQL | User's submitted code |
| `lang` / `langDisplay` | Both paths | Programming language |
| `statusDisplay` | Both paths | "Wrong Answer", "Time Limit Exceeded", "Runtime Error" |
| `runtime` / `memory` | REST path | Performance stats |

**Not currently stored (in raw `/check/` response but discarded):**

| Field | Available in raw response | Value for AI |
|-------|--------------------------|--------------|
| `last_testcase` | Yes (REST) | Specific failing input — makes feedback concrete |
| `expected_output` | Yes (REST) | What the correct answer was |
| `code_output` | Yes (REST) | What the user's code actually produced |

These three fields transform generic feedback ("check your edge cases") into specific feedback ("your code returns `3` for input `[1,2,3]` but expected `6`"). They are HIGH value and require a minor schema addition.

The wrong-submission path in `background.js` currently calls `notifyTab(tabId, { type: 'SHOW_TOAST' })`. The AI feedback feature replaces this with a richer payload.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Hint" button on wrong-submission popup | Every AI coding tool (LeetCopilot, Copilot, ChatGPT) offers tiered hints; users expect graduated help | LOW | Replaces the plain toast; same Shadow DOM popup pattern as existing rating dialog |
| "Full Solution" button on same popup | The counterpart to hints; users need an escape hatch when genuinely stuck | LOW | Same popup, different system prompt sent to Claude |
| Loading state while AI generates | Without it, the popup appears frozen for 5-15 seconds after click | LOW | Spinner or "Thinking..." text while fetch is in flight |
| Error state for missing API key | User forgot to configure key — must show an actionable message, not a broken UI | LOW | Check `chrome.storage.local` before calling API; show "Add your API key in Settings" with a shortcut |
| Error state for API failures | 429 rate limit, 529 overloaded, network error — these happen routinely | LOW | Display human-readable error in the popup; never show raw JSON |
| Dismiss / close button | User has read the response and wants to continue coding | LOW | Already in existing dialog pattern (`host.remove()`) |
| Response displayed inline in the popup | Must appear where the user triggered it — not a new tab, not the extension popup | MEDIUM | Shadow DOM popup in `content-toast.js` is the right surface; requires expanding the existing dialog with a response area |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Hint vs Full Solution as distinct UX — not just different prompts | Hint shows "think about X approach" with no code; Full Solution shows working code with explanation. Visual distinction (different button colors, labeled response header) reinforces that one spoils the answer | MEDIUM | Two system prompts; response area labels which mode was requested; hint buttons styled differently from solution button |
| Contextual prompt: include failing test case, expected output, actual output | Passing the specific failing test case transforms feedback from generic to targeted. "Your code returns 3 for [1,2,3] but expected 6" is actionable; "your logic might be wrong" is not | MEDIUM | Requires storing `last_testcase`, `expected_output`, `code_output` from the `/check/` response at capture time — minor schema change in `background.js` |
| Streaming response rendering | Response appears token-by-token rather than all-at-once after a blank pause. Dramatically improves perceived responsiveness for 3-10 second responses | HIGH | Architecture: content script opens a long-lived port (`chrome.runtime.connect`) to service worker; service worker streams fetch and relays chunks via `port.postMessage`. Service worker stays alive while port is open. Non-trivial but well-understood MV3 pattern. |
| Markdown rendering for AI response | Claude outputs markdown: backtick code blocks, bold text, bullet lists. Raw text with literal backticks is noticeably bad UX for code explanations | MEDIUM | No external library needed for v1.1: a minimal regex-based renderer (~50 lines) handles the common patterns. Works inside Shadow DOM without CSP issues. |
| Hint framing that avoids spoiling the approach | Hint system prompt explicitly forbids mentioning the algorithm name or showing code — pure Socratic nudge | LOW | Pure prompt engineering, zero code complexity. Differentiates from tools that call partial solutions "hints". |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-trigger AI on every wrong submission | "Feels smart and proactive" | Burns API credits on every test run and typo. Chrome Web Store policies are strict about unexpected network calls. Users want control over when AI is invoked. | Keep "Hint" and "Full Solution" as explicit user-triggered buttons only |
| Chat / follow-up questions in the popup | Natural extension — "explain more", "show an alternative approach" | Multiplies UI complexity: input field, message history, scroll state, multi-turn context management. Out of scope for this milestone. | Single-shot response for v1.1; chat can be v1.2+ once the single-shot UX is validated |
| Caching AI responses in IndexedDB | "Efficient — same submission won't re-call the API" | Wrong submissions for the same problem often differ (different code, different failing test). Stale cache gives wrong feedback. Adds DB schema complexity. | No caching for v1.1. Users who click "Hint" again get a fresh response. |
| Fetching problem description from LeetCode GraphQL | "More context = better feedback" | LeetCode's GraphQL requires auth cookies that rotate. Adds a fragile network call and a new failure mode. Claude can infer the problem from titleSlug + user code alone. | Use titleSlug + code + error message + failing test case. Sufficient for good feedback. |
| Streaming via `sendMessage` loop | Streaming UX is desirable | `chrome.runtime.sendMessage` is not designed for high-frequency token-by-token relay. Each call has overhead; 50+ calls per response creates jank. | Use `chrome.runtime.connect()` (long-lived port) for streaming, not `sendMessage` |

---

## Feature Dependencies

```
[Wrong submission captured] (existing: saveSubmission → SHOW_TOAST)
    └──triggers──> [AI Feedback Popup with Hint + Solution buttons]
                       ├──requires──> [API key in chrome.storage.local]
                       │                  └──exists: settings.openRouterApiKey (may rename to anthropicApiKey)
                       ├──requires──> [Explicit user button click (Hint OR Full Solution)]
                       │
                       ├──AI call path (non-streaming, v1.1)──>
                       │      [background.js: fetch POST /v1/messages, await full response]
                       │          └──requires──> [submission payload in message to background]
                       │                             └──enhanced by──> [last_testcase + expected_output + code_output]
                       │                                                   └──requires──> [schema addition at capture time]
                       │
                       ├──AI call path (streaming, future)──>
                       │      [content script: chrome.runtime.connect() opens port]
                       │          └──[background: streaming fetch, port.postMessage per chunk]
                       │
                       ├──enhances──> [Markdown rendering of response]
                       └──enhances──> [Streaming response]
```

### Dependency Notes

- **API key must exist before any call:** The popup must check `chrome.storage.local` for the key before showing Hint/Solution buttons, or check at click time and show an inline error. Keys are already stored under `settings.openRouterApiKey` — the field name may need updating to `anthropicApiKey` since the project now targets Claude directly, not OpenRouter.
- **API call should run in service worker, not content script:** Content scripts CAN call external APIs in MV3 (no policy restriction), but running the API call in the background service worker keeps the raw API key off the page context (isolated from LeetCode's JavaScript). The content script sends a message with the submission data; the background fetches and returns the response.
- **Streaming requires port, not sendMessage:** If streaming is added, the architecture must use `chrome.runtime.connect()`. This is a deliberate architectural choice, not an optimization — `sendMessage` is not suitable for high-frequency chunk relay.
- **Enhanced context requires schema change:** `last_testcase`, `expected_output`, and `code_output` are available in the raw `/check/` response but currently discarded in `saveSubmission()`. They must either be stored in IndexedDB or included in the `SHOW_AI_FEEDBACK` message payload at capture time. The payload approach (pass-through without storage) is simpler and avoids a DB migration.

---

## MVP Definition

### Launch With (v1.1)

Minimum viable product — what's needed to validate the concept.

- [ ] Wrong submission popup shows "Hint" and "Full Solution" buttons — replace the plain `SHOW_TOAST` for wrong answers with a richer popup
- [ ] Clicking either button sends submission data to background, calls Claude API (non-streaming), displays response in popup
- [ ] Missing API key: inline error "Add your API key in Settings" — popup does not break
- [ ] API errors (rate limit, network failure): human-readable error message in popup
- [ ] Response rendered with minimal markdown (code blocks, bold) using inline regex renderer
- [ ] Dismiss / close on button click or overlay click

### Add After Validation (v1.x)

Features to add once non-streaming is confirmed working.

- [ ] Pass `last_testcase` + `expected_output` + `code_output` in prompt — improves feedback quality significantly; requires adding these fields to the capture payload
- [ ] Streaming response via long-lived port — improves perceived responsiveness; add after the non-streaming path is stable
- [ ] Hint prompt refinement: explicit prohibition on algorithm name and code in hint mode — pure prompt tuning, zero code change

### Future Consideration (v2+)

Features to defer until the AI feedback UX is validated.

- [ ] Follow-up chat / multi-turn conversation in popup
- [ ] Cross-problem pattern analysis ("you consistently struggle with DP")
- [ ] Language-aware prompt variations (different hints for Python vs Java verbosity)

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Hint + Full Solution buttons replacing toast | HIGH | LOW | P1 |
| Claude API call (non-streaming, background) | HIGH | LOW | P1 |
| Missing API key error state | HIGH | LOW | P1 |
| API error handling (rate limit, network) | HIGH | LOW | P1 |
| Markdown rendering (code blocks, bold, bullets) | MEDIUM | LOW | P1 |
| Distinct hint vs solution UX framing | MEDIUM | LOW | P1 |
| Pass failing test case / expected output in prompt | HIGH | MEDIUM | P2 |
| Streaming response via long-lived port | MEDIUM | HIGH | P2 |
| Hint prompt that blocks algorithm name + code | MEDIUM | LOW | P2 |
| Follow-up chat in popup | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## API Context: What to Send to Claude

**Minimum viable context (all available in current submission record):**
- Problem title / slug
- User's submitted code
- Programming language
- Status ("Wrong Answer", "Time Limit Exceeded", "Runtime Error")

**Enhanced context (requires adding fields to capture payload):**
- `last_testcase` — the specific input that failed
- `expected_output` — correct answer for that input
- `code_output` — what the user's code actually produced

Passing the failing test case is the single highest-value improvement to feedback quality. It converts abstract advice into concrete diagnosis.

**Do not send:**
- Full problem description — requires fragile LeetCode DOM scraping
- All past submissions for this problem — not relevant to the immediate wrong answer
- FSRS card state — not relevant to code correctness

---

## Streaming Architecture Detail (MV3-Specific)

**HIGH confidence — verified against official Chrome docs and Anthropic streaming docs.**

**Non-streaming (v1.1):**
1. Content script sends `chrome.runtime.sendMessage({ type: 'GET_AI_FEEDBACK', payload: {...} })`
2. Service worker does `fetch('https://api.anthropic.com/v1/messages', { stream: false })`
3. Awaits full JSON response, returns text via `sendResponse`
4. Content script renders complete response at once
5. Service worker stays alive because `return true` signals async response to Chrome

**Streaming (v1.x if added):**
1. Content script opens port: `const port = chrome.runtime.connect({ name: 'ai-stream' })`
2. Service worker's `chrome.runtime.onConnect` handler receives port, starts streaming fetch
3. Each SSE `content_block_delta` event sends `port.postMessage({ chunk: text })`
4. Content script receives chunks and appends to the response area in real time
5. Service worker sends `port.postMessage({ done: true })` on `message_stop` event
6. Port connection keeps service worker alive throughout the stream — no keepalive hack needed

The Claude Streaming API emits `content_block_delta` events with `{ type: "text_delta", text: "..." }`. Parse by reading the `data:` line of each SSE event, JSON.parse it, check `type === 'content_block_delta'` and `delta.type === 'text_delta'`, then use `delta.text`.

---

## Markdown Rendering Approach

**MEDIUM confidence — based on Shadow DOM constraints and Claude's output patterns.**

Claude's code feedback reliably uses:
- Triple-backtick code blocks (``` language ... ```)
- Inline backticks for identifiers
- `**bold**` for emphasis
- `- bullet` lists

**Option A — Inline regex renderer (~50 lines, recommended for v1.1):**
Handles the four patterns above. Zero bundle size. Works inside Shadow DOM without CSP issues. No new dependency.

**Option B — marked.js bundled UMD (~35KB minified):**
Full CommonMark support. Must be bundled (no CDN in MV3 CSP). Overhead is justified only if rendering complex docs.

**Recommendation:** Build a minimal inline renderer first. If it proves insufficient (nested lists, tables, complex code blocks), swap in marked.js. The switch is a one-file change.

---

## Sources

- [Claude API Streaming Docs](https://platform.claude.com/docs/en/build-with-claude/streaming) — SSE event format, `content_block_delta` structure (HIGH confidence — official Anthropic docs)
- [Chrome Extension MV3 Service Worker Lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle) — termination constraints, port-based keepalive (HIGH confidence — official Chrome docs)
- [MV3 Service Worker Keepalive via Port](https://gist.github.com/sunnyguan/f94058f66fab89e59e75b1ac1bf1a06e) — community-verified port connection pattern (MEDIUM confidence)
- [Best AI Tools for LeetCode 2025](https://leetcopilot.dev/blog/best-ai-tools-for-leetcode-2025) — UX patterns for hint vs solution in the space (MEDIUM confidence)
- [How AI Chatbots Help Without Giving Answers](https://dev.to/pratikshya_behera_/how-ai-chatbots-helped-me-improve-at-leetcode-without-giving-me-the-answers-4cn2) — user expectations for progressive hints (MEDIUM confidence)
- LeetReminder codebase: `background.js`, `content-toast.js`, `popup.js`, `manifest.json` — existing infrastructure and constraints (HIGH confidence — direct code inspection)

---

*Feature research for: AI code feedback — LeetReminder v1.1 milestone*
*Researched: 2026-03-13*
