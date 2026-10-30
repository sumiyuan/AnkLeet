// AnkLeet — Shared theme for injected UI (content-theme.js)
// World: ISOLATED — loaded before content-toast.js and content-chat.js, which
// share this world's globals. Same palette and fonts as the popup.

// ── Design tokens injected into every Shadow DOM ──
// Orange and amber throughout, the same as the popup.
const LR_TOKENS = `
  :host {
    --lr-bg-deep: #160f07;
    --lr-bg-surface: #22170b;
    --lr-bg-elevated: #2f2010;
    --lr-border: #3d2a14;
    --lr-border-focus: #5c4220;
    --lr-text-primary: #fbeedb;
    --lr-text-secondary: #c4a27a;
    --lr-text-muted: #c4a27a;
    --lr-primary: #F0A830;
    --lr-primary-hover: #FFB940;
    --lr-on-primary: #1a1006;
    --lr-hue: #F0A830;
    --lr-success: #F5B841;
    --lr-error: #FF7A45;
    --lr-hard: #FF9A3C;
    --lr-easy: #FFD27A;
    --lr-rate-again: #FF4D5E;
    --lr-rate-hard: #FF9F1C;
    --lr-rate-good: #3DDC84;
    --lr-rate-easy: #38BDF8;
    --lr-code-bg: #120c05;
    --lr-scrim: rgba(0, 0, 0, 0.5);
    --lr-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    --lr-radius-panel: 12px;
    --lr-radius-btn: 8px;
    --lr-radius-sm: 5px;
    --lr-font: 'AnkLeet Geist', Inter, system-ui, -apple-system, sans-serif;
    --lr-font-mono: 'AnkLeet Mono', ui-monospace, 'SF Mono', Consolas, monospace;
    color-scheme: dark;
  }
  * { box-sizing: border-box; }
  :focus-visible { outline: 2px solid var(--lr-hue); outline-offset: 2px; }
`;

/**
 * Registers the bundled fonts on the page once. @font-face inside a shadow
 * root is ignored by Chrome, so the faces are declared on the document under
 * names that cannot collide with LeetCode's.
 */
function lrEnsureFonts() {
  if (document.getElementById('ankleet-fonts')) return;
  const style = document.createElement('style');
  style.id = 'ankleet-fonts';
  style.textContent = `
    @font-face {
      font-family: 'AnkLeet Geist';
      font-weight: 400 700;
      font-display: swap;
      src: url('${chrome.runtime.getURL('fonts/geist-latin.woff2')}') format('woff2');
    }
    @font-face {
      font-family: 'AnkLeet Mono';
      font-weight: 400 500;
      font-display: swap;
      src: url('${chrome.runtime.getURL('fonts/jetbrains-mono-latin.woff2')}') format('woff2');
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

/**
 * Prepares a new shadow host: page-level fonts.
 */
function lrPrepareHost(host) {
  lrEnsureFonts();
}
