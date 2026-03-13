# Requirements: LeetReminder

**Defined:** 2026-03-13
**Core Value:** Users never forget a LeetCode problem — every submission is tracked and the FSRS algorithm surfaces problems for review at the optimal time.

## v1.1 Requirements

Requirements for AI feedback feature. Each maps to roadmap phases.

### AI Feedback

- [ ] **AIFB-01**: User sees a popup with "Hint" and "Full Solution" buttons when a wrong submission is detected
- [ ] **AIFB-02**: User receives a hint that nudges toward the solution without revealing the answer
- [ ] **AIFB-03**: User receives a full solution with explanation and code
- [ ] **AIFB-04**: AI response is displayed inline in the popup on the LeetCode page

### API Integration

- [ ] **API-01**: Extension calls OpenRouter API from the background service worker
- [ ] **API-02**: Extension uses the existing OpenRouter API key from settings
- [ ] **API-03**: Extension handles API errors gracefully (invalid key, rate limit, network failure)

## Future Requirements

### Review Enhancements

- **REV-01**: AI-generated hints during spaced repetition reviews
- **REV-02**: Problem difficulty auto-tagging from AI analysis

## Out of Scope

| Feature | Reason |
|---------|--------|
| Streaming responses | Non-streaming sufficient for v1.1; Haiku responds in 1-3s |
| In-extension code editor | Reviews happen on LeetCode itself |
| Built-in/hosted AI backend | User brings their own API key via OpenRouter |
| Multiple AI provider UIs | OpenRouter abstracts this — one key, many models |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AIFB-01 | Phase 5 | Pending |
| AIFB-02 | Phase 5 | Pending |
| AIFB-03 | Phase 5 | Pending |
| AIFB-04 | Phase 5 | Pending |
| API-01 | Phase 4 | Pending |
| API-02 | Phase 4 | Pending |
| API-03 | Phase 4 | Pending |

**Coverage:**
- v1.1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-03-13*
*Last updated: 2026-03-13 after roadmap creation*
