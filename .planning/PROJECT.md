# LeetReminder

## What This Is

A Chrome extension that automatically tracks LeetCode submissions (both wrong and accepted), schedules spaced repetition reviews using the FSRS algorithm, and gives users a dashboard to monitor daily progress and a review queue with in-page rating.

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

### Active

- [ ] AI feedback on wrong submissions — user chooses hint or full solution
- [ ] Gemini API integration (user provides their own API key)

### Out of Scope

- Cloud sync / user accounts — local-only for simplicity, privacy-first
- In-extension code editor — reviews happen on LeetCode itself
- Mobile app — Chrome extension only
- Built-in/hosted AI backend — user brings their own API key via OpenRouter

## Context

Shipped v1.0 with ~3,869 LOC (JS/HTML/CSS/JSON).
Tech stack: Chrome MV3, IndexedDB, ts-fsrs (UMD), Shadow DOM.
LeetCode uses REST endpoints (POST /submit/ + GET /check/) for submissions, not GraphQL.
IndexedDB schema at version 2 with stores: submissions, cards, reviewLogs.

## Constraints

- **Platform**: Chrome extension (Manifest V3) — must follow Chrome Web Store policies
- **Storage**: Local-only via Chrome storage / IndexedDB — no external database
- **AI**: User-provided Gemini API key — no server-side proxy
- **LeetCode integration**: Content script injection — dependent on LeetCode's DOM structure

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-only storage (chrome.storage.local + IndexedDB) | No backend complexity, privacy-first, zero hosting cost | Good |
| Gemini for AI feedback | Free tier, simple REST API, no SDK needed in MV3 | Pending (v1.1) |
| FSRS over SM-2 | More modern algorithm, better retention modeling, open-source | Good |
| REST intercept over GraphQL | LeetCode uses REST for submissions — confirmed via live traffic | Good |
| store.add() with ConstraintError for dedup | Simpler than check-then-insert, race-condition safe | Good |
| UMD bundle for ts-fsrs | MV3 service workers can't use ES modules with importScripts | Good |
| Shadow DOM (closed) for toast/rating UI | Isolates extension UI from LeetCode page styles | Good |
| Minimum 1-day review interval | FSRS learning steps (minutes) don't suit re-solving LeetCode problems | Good |

## Current Milestone: v1.1 AI Feedback

**Goal:** Give users AI-powered feedback on wrong submissions — hint or full solution via Gemini API.

**Target features:**
- Wrong submission popup with "Hint" and "Full Solution" buttons
- Gemini API integration using user-provided API key
- AI response displayed inline in the popup

---
*Last updated: 2026-03-13 after v1.1 milestone started*
