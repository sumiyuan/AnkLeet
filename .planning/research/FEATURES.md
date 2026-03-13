# Feature Research

**Domain:** Chrome extension — LeetCode problem tracking with FSRS spaced repetition + AI feedback
**Researched:** 2026-03-12
**Confidence:** MEDIUM (cross-referenced multiple tools, web search verified against official Chrome docs and live products)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Automatic submission capture (accepted + wrong) | Core promise: "never miss a submission"; manual logging kills retention | MEDIUM | Requires content script intercepting LeetCode's network layer (GraphQL/XHR); LeetCode's DOM changes break this regularly — multiple existing extensions (LeetPlug, LeetSync) solve this same problem |
| Per-problem history: attempt count, timestamp, result | Users need to see their full attempt record, not just "solved once" | LOW | Can be stored in chrome.storage.local or IndexedDB; straightforward once capture works |
| FSRS-based review scheduling (due dates per problem) | The entire value proposition; without it this is just a logger | HIGH | ts-fsrs library exists (TypeScript, ES modules, supports browser); requires storing Card state, running repeat() on each rating |
| "Due today" review queue in dashboard | Users need to know what to do next; a queue without today's view is useless | LOW | Filter stored cards by nextReview <= now; simple query |
| Dashboard accessible from extension icon | Standard extension UX; popup or new-tab page | LOW | Popup (300×400px) or full-page new tab; choice affects layout |
| Browser notification when reviews are due | Without this, users forget to open the dashboard | MEDIUM | Chrome Alarms API (MV3) + chrome.notifications; alarms fire reliably but service worker must re-register on startup — known MV3 pitfall |
| Link back to the LeetCode problem page for review | Reviews must happen on LeetCode itself (no in-extension editor); this is load-bearing for usability | LOW | Store problem URL/slug at capture time; open in new tab |
| Problem metadata: title, difficulty, tags | Users need to identify what they're reviewing; difficulty informs FSRS parameters | LOW | Captured at submission time from the LeetCode page DOM |
| Local-only data storage (no account required) | Privacy expectation for dev tools; account creation is a high-friction barrier for a niche tool | MEDIUM | chrome.storage.local (~5MB) is fine for most users; heavy users (1000+ submissions) may need IndexedDB (~unlimited) |
| Self-assessment rating after review (Again / Hard / Good / Easy) | Required by FSRS; without this the algorithm cannot compute next interval | LOW | Four-button UI shown after user returns from LeetCode; mirrors Anki's rating system |

---

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI feedback on wrong submissions (hint-only vs full explanation) | Competing tools log failures but don't help you understand them; AI turns a wrong answer into a learning moment | HIGH | OpenRouter API call on wrong submission capture; user-provided API key; offer two modes: "nudge me" (hint) or "show me" (full walkthrough); progressive hint model used by LeetCopilot validates the demand |
| Capture wrong submissions (not just accepted) | Most trackers (LeetSync, LeetHub) only capture accepted submissions; wrong answers are equally valuable for FSRS scheduling | MEDIUM | Must distinguish "Wrong Answer", "Time Limit Exceeded", "Runtime Error" result types from submission response |
| Tracks solution code per submission | Users want to see what they wrote before vs now; "how did I solve this 3 months ago?" is a real question | LOW | Store code string alongside result; display in history view |
| Correct-on-first-attempt vs multiple-attempt tracking | FSRS benefits from this signal: first-try success = longer interval; multiple attempts = shorter | LOW | Derived from stored attempt count per session; no extra capture needed |
| Daily activity view with attempt counts per problem | Shows "I tried Problem X 4 times today before getting it" — motivating and diagnostic | LOW | Group stored attempts by date; render as list or mini-heatmap |
| User-selectable LLM model via OpenRouter | Different users have different LLM preferences (cost vs quality); OpenRouter supports GPT-4, Claude, Gemini in one integration | MEDIUM | OpenRouter BYOK model; user stores their own key in extension settings; model selector dropdown |
| Submission code stored for AI context | AI feedback is dramatically better when it has the actual wrong code to analyze | LOW | Pass captured code as context to the AI prompt alongside the problem description |
| Data export/import (JSON) | Local-only storage is lost if browser data is cleared; export lets users back up and migrate | LOW | JSON.stringify the storage, offer a download; parse and restore on import; the javydevx/leetcode-tracker precedent validates this need |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| In-extension code editor / re-solve in popup | "One-stop shop"; users like the idea of solving without leaving the extension | Defeats the purpose: LeetCode's runtime, test cases, and IDE features can't be replicated; reviews should happen on LeetCode proper | Link directly to the LeetCode problem page; the review IS solving it on LeetCode again |
| Cloud sync / user accounts | "I want my data on all my devices" | Requires a backend, database, auth, hosting costs, GDPR compliance; kills the "zero infrastructure" design; out of scope per PROJECT.md | JSON export/import for manual migration; document the limitation clearly |
| Social features (compare with friends, leaderboards) | Gamification appeal | High complexity; niche demand for a personal tool; adds backend requirement | Stay personal-progress-focused; don't add social graph complexity |
| LeetCode Premium problem access / scraping | "Show me premium problems I haven't paid for" | Chrome Web Store policy violation; legal risk under LeetCode ToS | Only track problems the user actually encounters through their own LeetCode session |
| Built-in AI model (no API key needed) | Lower friction for users | Requires server-side proxy, hosting cost, API key management on the backend, rate limiting; completely breaks the "local-only, no backend" constraint | OpenRouter BYOK; document setup once clearly in onboarding; the friction is a one-time cost |
| Streak tracking / daily goal gamification | Motivating for some users | Already provided by LeetCode itself; duplicating it adds clutter; "solving to maintain streak" incentivizes low-quality practice over retention | Focus on "due reviews" as the daily action signal instead of arbitrary streaks |
| Full problem content storage (descriptions, images) | "I want to see the problem in the extension" | Copyright concern with storing LeetCode's proprietary content; storage bloat; LeetCode's CSP may block scraping | Store problem title, slug, and difficulty only; link to the live problem page for full content |
| Timer / time-spent-per-problem tracking | Popular feature (LeetCode Timer extension exists) | Scope creep; the value of this tool is retention scheduling, not time management; a separate extension already does this well | Out of scope; recommend the dedicated LeetCode Timer extension to users who want this |

---

## Feature Dependencies

```
[Submission Capture (content script)]
    └──required by──> [Problem history storage]
                          └──required by──> [FSRS scheduling]
                                                └──required by──> [Due today queue]
                                                                      └──required by──> [Browser notifications]

[Self-assessment rating UI]
    └──required by──> [FSRS scheduling] (ratings drive interval calculation)

[OpenRouter API key (settings)]
    └──required by──> [AI feedback on wrong submissions]
                          └──enhanced by──> [Stored submission code as AI context]

[Problem history storage]
    └──required by──> [Daily activity view]
    └──required by──> [Data export/import]
    └──required by──> [Link to LeetCode problem for review]
```

### Dependency Notes

- **FSRS scheduling requires self-assessment rating**: The FSRS algorithm's `repeat()` function takes the card state and a rating (Again=1, Hard=2, Good=3, Easy=4) and returns the next card state with computed next review date. Without explicit ratings, there is no scheduling.
- **AI feedback requires API key setup**: If the user hasn't configured their OpenRouter key, AI feedback must degrade gracefully (hide the AI button, not crash).
- **Submission capture is the root dependency**: Every other feature depends on reliably capturing submissions. If the content script breaks (due to a LeetCode DOM update), nothing works. This is the highest-risk dependency.
- **Browser notifications require alarm registration on service worker startup**: MV3 service workers do not persist between browser sessions; alarms must be re-registered each time the service worker wakes. Failure to do this = silent notification loss.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [ ] Automatic submission capture (accepted + wrong answers) — without this there is no product
- [ ] Problem history stored locally (title, difficulty, result, timestamp, code) — foundation for everything
- [ ] FSRS scheduling — the core differentiator; every other LeetCode tracker uses fixed intervals (1/3/7/14 days); FSRS adapts
- [ ] Due today review queue in popup/dashboard — the daily action surface
- [ ] Self-assessment rating UI (Again / Hard / Good / Easy) — required by FSRS; without it scheduling can't run
- [ ] Link to LeetCode problem page from review queue — reviews happen on LeetCode; this is the "go solve it" button
- [ ] Browser notification when reviews are due — passive retention; without it the tool is invisible on non-active days
- [ ] Basic settings: OpenRouter API key input — enables AI features; even if AI feedback is optional in v1, collecting the key means no migration pain later

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] AI feedback on wrong submissions (hint mode + explanation mode) — highest differentiator; add once capture+scheduling is proven stable
- [ ] Daily activity view — motivating; add when there's enough history to make it meaningful (after ~1 week of use)
- [ ] Data export/import (JSON) — add when users have data worth protecting; premature if they're still evaluating the tool
- [ ] Correct-on-first-attempt tracking with FSRS signal — small improvement to scheduling quality; low effort

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Multiple LLM model selector — user value unclear until they've used the AI feature; add based on feedback
- [ ] Full submission code diff view (old code vs new code) — interesting but requires more complex UI; defer
- [ ] Pattern/category-based review grouping — HN commenters requested this; meaningful once user has 50+ problems; defer
- [ ] Mastery threshold (auto-archive a card once stability is high enough) — FSRS supports this via retrievability score; adds complexity; defer

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Submission capture (accepted + wrong) | HIGH | MEDIUM | P1 |
| FSRS scheduling | HIGH | MEDIUM | P1 |
| Due today review queue | HIGH | LOW | P1 |
| Self-assessment rating (Again/Hard/Good/Easy) | HIGH | LOW | P1 |
| Link to LeetCode problem for review | HIGH | LOW | P1 |
| Browser notifications (due reviews) | HIGH | MEDIUM | P1 |
| Problem history storage (local) | HIGH | LOW | P1 |
| OpenRouter API key settings | MEDIUM | LOW | P1 |
| AI feedback on wrong submissions | HIGH | HIGH | P2 |
| Daily activity view | MEDIUM | LOW | P2 |
| Data export/import (JSON) | MEDIUM | LOW | P2 |
| Stored code as AI context | MEDIUM | LOW | P2 |
| First-attempt vs multi-attempt signal | LOW | LOW | P2 |
| Multiple LLM model selector | LOW | MEDIUM | P3 |
| Pattern/category grouping for reviews | MEDIUM | MEDIUM | P3 |
| Mastery threshold / auto-archive | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Lanki (HN tool) | javydevx/leetcode-tracker | DSA Memoizer | LeetSync/LeetHub | Our Approach |
|---------|-----------------|---------------------------|--------------|-------------------|--------------|
| Submission auto-capture | Manual | Manual | Manual | Accepted only | Auto-capture accepted + wrong via content script |
| Spaced repetition algorithm | Custom score formula | Fixed intervals (1/3/7/14/30 days) | Fixed intervals (3/7/15 days) | None | FSRS (adaptive, tunable retention rate) |
| AI feedback on wrong answers | None | None | None | None | OpenRouter + user API key; hint or full explanation |
| Rating-based scheduling | Easy/Hard/Medium | Not present | Not present | Not present | Again/Hard/Good/Easy (standard FSRS ratings) |
| Wrong answer capture | Not supported | Not supported | Not supported | Not supported | Core feature |
| Local-only storage | Yes (MongoDB local) | Yes (localStorage) | Not local (extension) | GitHub repo | Yes (chrome.storage + IndexedDB) |
| Browser notifications | None | None | Yes (basic) | None | Chrome Alarms API + notifications |
| Data export | None | JSON export/import | None | GitHub (implicit) | JSON export/import |
| Open source | Yes | Yes | No | Yes | Intended yes |

---

## Sources

- [LeetCopilot: 12 Best LeetCode Chrome Extensions 2026](https://leetcopilot.dev/blog/best-leetcode-chrome-extensions-2025) — competitor feature survey (MEDIUM confidence: single commercial source)
- [Lanki HN thread: Show HN: spaced repetition tool for coding problems](https://news.ycombinator.com/item?id=40173237) — user feature requests from HN comments (MEDIUM confidence: community validated)
- [javydevx/leetcode-tracker GitHub](https://github.com/javydevx/leetcode-tracker) — feature set of closest open-source analog (HIGH confidence: live repo)
- [LeetPlug GitHub](https://github.com/LorenzoBe/LeetPlug) — submission interception technique reference (MEDIUM confidence)
- [ts-fsrs GitHub](https://github.com/open-spaced-repetition/ts-fsrs) — official FSRS TypeScript implementation, confirms four-rating API (HIGH confidence: official source)
- [FlashRecall: LeetCode Anki blog](https://flashrecall.app/blog/leetcode-anki) — user pain points with manual LeetCode review (MEDIUM confidence)
- [DSA Prep](https://www.dsaprep.dev/) — feature set of active competitor (MEDIUM confidence)
- [SpaceLeet](https://spaceleet.vercel.app/) — AI + spaced repetition for LeetCode feature set (MEDIUM confidence)
- [Chrome Alarms API docs](https://developer.chrome.com/docs/extensions/reference/api/alarms) — MV3 alarm behavior for notifications (HIGH confidence: official Chrome docs)
- [Hacker News DSA spaced repetition CLI](https://news.ycombinator.com/item?id=45480280) — implementation patterns and feature priorities (LOW confidence: minimal engagement)
- [Building AutoDeck: AI SRS lessons](https://www.seangoedecke.com/autodeck/) — AI-driven spaced repetition design lessons (MEDIUM confidence: practitioner account)
- [LeetCode feedback GitHub issues](https://github.com/LeetCode-Feedback/LeetCode-Feedback/issues) — signal on what users find broken/missing (MEDIUM confidence)

---

*Feature research for: Chrome extension — LeetCode FSRS tracker with AI feedback*
*Researched: 2026-03-12*
