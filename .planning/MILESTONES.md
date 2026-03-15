# Milestones

## v1.1 AI Feedback (Shipped: 2026-03-15)

**Phases completed:** 2 phases, 2 plans
**Timeline:** 2026-03-14 → 2026-03-15

**Key accomplishments:**
- OpenRouter API integration via MV3 service worker with Bearer auth, error handling, and keepalive
- Non-intrusive bottom-right side panel for wrong submissions with Hint and Full Solution buttons
- Safe markdown renderer for AI code blocks (textContent-only, no XSS risk)
- AI model selector in Settings (Claude Haiku, Sonnet, Gemini Flash, GPT-4o Mini, GPT-4o)
- Socratic hint mode that nudges without revealing the answer

---

## v1.0 MVP (Shipped: 2026-03-13)

**Phases completed:** 3 phases, 7 plans
**Lines of code:** ~3,869
**Timeline:** 2026-03-12 → 2026-03-13

**Key accomplishments:**
- MV3 Chrome extension with IndexedDB storage and duplicate-safe submission capture
- Fetch/XHR interceptor pipeline capturing LeetCode REST submissions with Shadow DOM toast
- ts-fsrs FSRS scheduling engine with card creation, rating, due-today queue, and stats
- Tabbed popup UI with dashboard stats, today's activity, review queue, and settings
- Alarm-driven badge updates and daily browser notifications for due reviews

---

