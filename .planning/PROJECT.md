# LeetReminder

## What This Is

A Chrome extension that automatically tracks LeetCode submissions (both wrong and accepted), schedules spaced repetition reviews using the FSRS algorithm, and provides AI-powered feedback on wrong submissions. It gives users a dashboard to monitor their daily progress and review history.

## Core Value

Users never forget a LeetCode problem — every submission is tracked and the FSRS algorithm surfaces problems for review at the optimal time.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Auto-capture LeetCode submissions (accepted and wrong) from the problem page
- [ ] Track each submission attempt with timestamp, code, result, and problem metadata
- [ ] Dashboard accessible via extension icon showing daily activity, history, and due reviews
- [ ] FSRS-based scheduling that calculates optimal review intervals for each problem
- [ ] Browser notifications when reviews are due
- [ ] AI feedback on wrong submissions — user chooses hint-only or full explanation
- [ ] OpenRouter integration for LLM flexibility (user provides their own API key)
- [ ] Link to LeetCode problem page for FSRS reviews (re-solve on LeetCode)
- [ ] Local-only storage using Chrome storage APIs (no backend, no account)
- [ ] Daily problem tracking with attempt counts per question

### Out of Scope

- Cloud sync / user accounts — keeping it local-only for simplicity
- In-extension code editor — reviews happen on LeetCode itself
- Mobile app — Chrome extension only
- Built-in/hosted AI backend — user brings their own API key via OpenRouter

## Context

- Chrome extension using Manifest V3
- Needs content script on LeetCode pages to intercept submissions
- FSRS (Free Spaced Repetition Scheduler) is an open-source algorithm with JS implementations available
- OpenRouter provides a unified API for multiple LLM providers (OpenAI, Claude, Gemini, etc.)
- Chrome storage API has limits (~5MB for local, ~100KB for sync) — may need IndexedDB for larger datasets

## Constraints

- **Platform**: Chrome extension (Manifest V3) — must follow Chrome Web Store policies
- **Storage**: Local-only via Chrome storage / IndexedDB — no external database
- **AI**: User-provided API key through OpenRouter — no server-side proxy
- **LeetCode integration**: Content script injection — dependent on LeetCode's DOM structure

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-only storage | No backend complexity, privacy-first, zero hosting cost | — Pending |
| OpenRouter for AI | Single integration supports multiple LLM providers | — Pending |
| FSRS over SM-2 | More modern algorithm, better retention modeling, open-source | — Pending |
| Hints vs full solution as user choice | Different users want different levels of help | — Pending |

---
*Last updated: 2026-03-12 after initialization*
