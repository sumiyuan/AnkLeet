# LeetReminder

## What This Is

A Chrome extension that automatically tracks LeetCode submissions, schedules spaced repetition reviews using the FSRS algorithm, and provides AI-powered feedback on wrong submissions with hint and full solution modes.

## Core Value

Users never forget a LeetCode problem — every submission is tracked and the FSRS algorithm surfaces problems for review at the optimal time.

## Requirements

### Validated

- Auto-capture LeetCode submissions (accepted and wrong) from the problem page — v1.0
- Track each submission attempt with timestamp, code, result, and problem metadata — v1.0
- Dashboard accessible via extension icon showing daily activity and due reviews — v1.0
- FSRS-based scheduling that calculates optimal review intervals for each problem — v1.0
- User rates review difficulty (Again/Hard/Good/Easy) after completing a review — v1.0
- Browser notifications when reviews are due — v1.0
- Link to LeetCode problem page for FSRS reviews (re-solve on LeetCode) — v1.0
- Local-only storage using Chrome storage APIs and IndexedDB (no backend, no account) — v1.0
- Daily problem tracking with attempt counts per question — v1.0
- Extension icon badge shows count of due reviews — v1.0
- Settings page for OpenRouter API key and notification preferences — v1.0
- AI feedback on wrong submissions — user chooses hint or full solution — v1.1
- OpenRouter API integration (user provides their own API key) — v1.1

### Active

(None — planning next milestone)

### Out of Scope

- Cloud sync / user accounts — local-only for simplicity, privacy-first
- In-extension code editor — reviews happen on LeetCode itself
- Mobile app — Chrome extension only
- Built-in/hosted AI backend — user brings their own API key via OpenRouter
- Streaming AI responses — non-streaming sufficient; models respond in 1-3s

## Context

Shipped v1.1 with ~2,289 LOC in extension/ (JS/HTML/CSS).
Tech stack: Chrome MV3, IndexedDB, ts-fsrs (UMD), Shadow DOM, OpenRouter API.
LeetCode uses REST endpoints (POST /submit/ + GET /check/) for submissions, not GraphQL.
IndexedDB schema at version 2 with stores: submissions, cards, reviewLogs.
AI feedback via OpenRouter with user-selectable model (5 options).

## Constraints

- **Platform**: Chrome extension (Manifest V3) — must follow Chrome Web Store policies
- **Storage**: Local-only via Chrome storage / IndexedDB — no external database
- **AI**: User-provided OpenRouter API key — no server-side proxy
- **LeetCode integration**: Content script injection — dependent on LeetCode's DOM structure

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-only storage (chrome.storage.local + IndexedDB) | No backend complexity, privacy-first, zero hosting cost | Good |
| OpenRouter for AI feedback | Multi-provider flexibility, user brings own key, simple REST API | Good |
| FSRS over SM-2 | More modern algorithm, better retention modeling, open-source | Good |
| REST intercept over GraphQL | LeetCode uses REST for submissions — confirmed via live traffic | Good |
| store.add() with ConstraintError for dedup | Simpler than check-then-insert, race-condition safe | Good |
| UMD bundle for ts-fsrs | MV3 service workers can't use ES modules with importScripts | Good |
| Shadow DOM (closed) for toast/rating UI | Isolates extension UI from LeetCode page styles | Good |
| Minimum 1-day review interval | FSRS learning steps (minutes) don't suit re-solving LeetCode problems | Good |
| Non-intrusive side panel for wrong submissions | User feedback: centered overlay too disruptive while coding | Good |
| User-selectable AI model | Flexibility across providers/price points via OpenRouter | Good |
| No callback in fire-and-forget sendMessage | Prevents "message port closed" Chrome warnings | Good |

---
*Last updated: 2026-03-15 after v1.1 milestone complete*
