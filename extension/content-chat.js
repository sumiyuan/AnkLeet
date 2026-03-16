// AnkLeet — Chat Panel (content-chat.js)
// World: ISOLATED (default) — runs at document_end so document.body is ready.
// Injects a persistent floating chat button and slide-out panel onto every
// leetcode.com/problems/* page. Uses Shadow DOM to prevent style bleed.

(function () {
  'use strict';

  // Guard: only run on problem pages
  if (!/^\/problems\/[^/]+/.test(location.pathname)) return;

  // --- State ---
  let currentTitleSlug = getCurrentTitleSlug();
  let panelVisible = false;
  let chatHost = null;
  let shadowRoot = null;

  // Shadow DOM element references (set during inject)
  let chatPanel = null;
  let chatButton = null;
  let messagesArea = null;
  let inputTextarea = null;
  let sendBtn = null;
  let loadingEl = null;
  let errorEl = null;
  let problemNameEl = null;

  // --- Helpers ---

  function getCurrentTitleSlug() {
    return location.pathname.split('/')[2] || '';
  }

  /**
   * Extracts the user's current code from LeetCode's Monaco editor.
   * Sends a postMessage to content-main.js (MAIN world) which has access
   * to the monaco.editor API, and receives the code back via postMessage.
   */
  function extractEditorCode() {
    return new Promise(function (resolve) {
      var reqId = 'lr-code-' + Date.now();
      var resolved = false;

      function handler(event) {
        if (event.data && event.data.source === 'ankleet' &&
            event.data.type === 'editor-code' && event.data.reqId === reqId) {
          resolved = true;
          window.removeEventListener('message', handler);
          resolve(event.data.code || '');
        }
      }
      window.addEventListener('message', handler);

      window.postMessage({
        source: 'ankleet',
        type: 'request-code',
        reqId: reqId
      }, '*');

      // Timeout fallback — resolve empty if Monaco not available
      setTimeout(function () {
        if (!resolved) {
          window.removeEventListener('message', handler);
          resolve('');
        }
      }, 300);
    });
  }

  function formatProblemName(slug) {
    return slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  // --- Shadow DOM injection ---

  function injectChatPanel(titleSlug) {
    // Remove any existing host
    removeChatHost();

    currentTitleSlug = titleSlug;
    panelVisible = false;

    chatHost = document.createElement('div');
    chatHost.id = 'ankleet-chat-host';
    document.body.appendChild(chatHost);

    shadowRoot = chatHost.attachShadow({ mode: 'closed' });

    // --- Google Fonts ---
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap';

    const style = document.createElement('style');
    style.textContent = `
      :host {
        --lr-bg-deep: #0f0f13;
        --lr-bg-surface: #1a1a21;
        --lr-bg-elevated: #242430;
        --lr-border: #2e2e3a;
        --lr-border-focus: #4a4a5c;
        --lr-text-primary: #e8e8ed;
        --lr-text-secondary: #8888a0;
        --lr-text-muted: #5c5c72;
        --lr-accent: #F0A830;
        --lr-accent-hover: #D89620;
        --lr-accent-glow: rgba(240, 168, 48, 0.15);
        --lr-success: #3DBAA2;
        --lr-error: #E85D75;
        --lr-code-bg: #12121a;
        --lr-radius-panel: 14px;
        --lr-radius-btn: 8px;
        --lr-radius-sm: 5px;
        --lr-font: 'DM Sans', system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
        --lr-font-mono: 'JetBrains Mono', 'Fira Mono', 'Consolas', monospace;
      }

      * {
        box-sizing: border-box;
      }

      /* ── Floating Action Button ── */
      .chat-btn {
        all: initial;
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 52px;
        height: 52px;
        border-radius: 14px;
        background: var(--lr-accent);
        color: #0f0f13;
        cursor: pointer;
        box-shadow:
          0 2px 8px rgba(0,0,0,0.4),
          0 0 20px var(--lr-accent-glow);
        z-index: 2147483647;
        transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s;
        font-family: var(--lr-font);
        border: none;
        outline: none;
      }
      .chat-btn:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow:
          0 4px 16px rgba(0,0,0,0.5),
          0 0 30px var(--lr-accent-glow);
      }
      .chat-btn:active { transform: scale(0.96); }
      .chat-btn svg { filter: drop-shadow(0 1px 1px rgba(0,0,0,0.15)); }

      /* ── Chat Panel ── */
      .chat-panel {
        all: initial;
        display: flex;
        flex-direction: column;
        position: fixed;
        bottom: 84px;
        right: 24px;
        width: 400px;
        height: 540px;
        border-radius: var(--lr-radius-panel);
        background: var(--lr-bg-surface);
        color: var(--lr-text-primary);
        font-family: var(--lr-font);
        box-shadow:
          0 12px 48px rgba(0,0,0,0.5),
          0 0 0 1px var(--lr-border);
        z-index: 2147483647;
        overflow: hidden;
        font-size: 14px;
        opacity: 0;
        transform: translateY(12px) scale(0.97);
        transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1);
        pointer-events: none;
      }
      .chat-panel.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: auto;
      }

      /* ── Panel Header ── */
      .panel-header {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid var(--lr-border);
        flex-shrink: 0;
        gap: 10px;
        background: linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%);
      }
      .panel-title {
        font-size: 14px;
        font-weight: 700;
        color: var(--lr-accent);
        flex-shrink: 0;
        letter-spacing: -0.01em;
      }
      .problem-name {
        font-size: 12px;
        color: var(--lr-text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      .header-btn {
        all: initial;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 5px 10px;
        border-radius: var(--lr-radius-sm);
        background: var(--lr-bg-elevated);
        color: var(--lr-text-secondary);
        font-family: var(--lr-font);
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.15s, color 0.15s;
        border: 1px solid var(--lr-border);
        letter-spacing: 0.01em;
      }
      .header-btn:hover {
        background: var(--lr-border);
        color: var(--lr-text-primary);
      }
      .close-btn {
        all: initial;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: var(--lr-radius-sm);
        font-family: var(--lr-font);
        font-size: 16px;
        color: var(--lr-text-muted);
        cursor: pointer;
        flex-shrink: 0;
        transition: color 0.15s, background 0.15s;
      }
      .close-btn:hover {
        color: var(--lr-text-primary);
        background: var(--lr-bg-elevated);
      }

      /* ── Messages Area ── */
      .messages-area {
        flex: 1;
        overflow-y: auto;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scrollbar-width: thin;
        scrollbar-color: var(--lr-border) transparent;
      }
      .messages-area::-webkit-scrollbar { width: 5px; }
      .messages-area::-webkit-scrollbar-track { background: transparent; }
      .messages-area::-webkit-scrollbar-thumb {
        background: var(--lr-border);
        border-radius: 3px;
      }

      /* ── Message Bubbles ── */
      .message {
        display: flex;
        flex-direction: column;
        max-width: 85%;
        word-break: break-word;
      }
      .message.user { align-self: flex-end; }
      .message.assistant { align-self: flex-start; }

      .bubble {
        padding: 10px 14px;
        border-radius: 12px;
        line-height: 1.55;
        font-size: 13px;
        font-family: var(--lr-font);
      }
      .message.user .bubble {
        background: var(--lr-accent);
        color: #0f0f13;
        border-bottom-right-radius: 4px;
        font-weight: 500;
      }
      .message.assistant .bubble {
        background: var(--lr-bg-elevated);
        color: var(--lr-text-primary);
        border-bottom-left-radius: 4px;
        border: 1px solid var(--lr-border);
      }

      /* ── Markdown inside assistant bubbles ── */
      .bubble p {
        margin: 0 0 8px 0;
        white-space: pre-wrap;
      }
      .bubble p:last-child { margin-bottom: 0; }
      .bubble pre {
        background: var(--lr-code-bg);
        padding: 12px 14px;
        border-radius: 8px;
        overflow-x: auto;
        font-family: var(--lr-font-mono);
        font-size: 12.5px;
        white-space: pre;
        margin: 8px 0;
        color: #cdd6f4;
        border: 1px solid var(--lr-border);
      }
      .bubble code {
        background: var(--lr-code-bg);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: var(--lr-font-mono);
        font-size: 12px;
        color: var(--lr-accent);
      }
      .bubble pre code {
        background: none;
        padding: 0;
        border-radius: 0;
        color: #cdd6f4;
      }
      .bubble ul, .bubble ol {
        margin: 6px 0;
        padding-left: 20px;
      }
      .bubble li {
        margin-bottom: 4px;
        line-height: 1.55;
      }
      .bubble strong {
        font-weight: 700;
        color: #ffffff;
      }

      /* ── Empty State ── */
      .empty-state {
        text-align: center;
        color: var(--lr-text-muted);
        font-size: 13px;
        margin: auto;
        padding: 24px 20px;
        line-height: 1.7;
      }
      .empty-state-icon {
        display: block;
        margin: 0 auto 12px;
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: var(--lr-bg-elevated);
        border: 1px solid var(--lr-border);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
      }

      /* ── Input Area ── */
      .input-area {
        display: flex;
        flex-direction: column;
        padding: 12px 14px 14px;
        border-top: 1px solid var(--lr-border);
        flex-shrink: 0;
        gap: 8px;
        background: linear-gradient(0deg, rgba(255,255,255,0.01) 0%, transparent 100%);
      }
      .input-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }
      .chat-textarea {
        flex: 1;
        height: 60px;
        resize: none;
        background: var(--lr-bg-deep);
        color: var(--lr-text-primary);
        border: 1px solid var(--lr-border);
        border-radius: var(--lr-radius-btn);
        padding: 10px 12px;
        font-family: var(--lr-font);
        font-size: 13px;
        line-height: 1.45;
        outline: none;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      .chat-textarea:focus {
        border-color: var(--lr-accent);
        box-shadow: 0 0 0 2px var(--lr-accent-glow);
      }
      .chat-textarea::placeholder { color: var(--lr-text-muted); }
      .send-btn {
        all: initial;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 16px;
        height: 60px;
        border-radius: var(--lr-radius-btn);
        background: var(--lr-accent);
        color: #0f0f13;
        font-family: var(--lr-font);
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.15s, transform 0.1s;
        border: none;
        letter-spacing: 0.01em;
      }
      .send-btn:hover:not(:disabled) {
        background: var(--lr-accent-hover);
        transform: translateY(-1px);
      }
      .send-btn:active:not(:disabled) { transform: translateY(0); }
      .send-btn:disabled { opacity: 0.35; cursor: default; }

      /* ── Loading: animated dots ── */
      .loading {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--lr-text-secondary);
        font-family: var(--lr-font);
      }
      .loading-dots {
        display: flex;
        gap: 3px;
      }
      .loading-dots span {
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: var(--lr-accent);
        animation: dot-bounce 1.2s ease-in-out infinite;
      }
      .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
      .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes dot-bounce {
        0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
        30% { opacity: 1; transform: translateY(-3px); }
      }

      /* ── Error message ── */
      .error-msg {
        font-size: 12px;
        color: var(--lr-error);
        text-align: left;
        line-height: 1.4;
        font-family: var(--lr-font);
      }
    `;

    // Chat button (FAB)
    chatButton = document.createElement('button');
    chatButton.className = 'chat-btn';
    chatButton.title = 'Open AI Chat';
    // SVG speech bubble icon
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', '22');
    svg.setAttribute('height', '22');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    const path1 = document.createElementNS(svgNS, 'path');
    path1.setAttribute('d', 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z');
    svg.appendChild(path1);
    chatButton.appendChild(svg);
    chatButton.addEventListener('click', togglePanel);

    // Panel
    chatPanel = document.createElement('div');
    chatPanel.className = 'chat-panel';

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'panel-title';
    titleEl.textContent = 'AI Chat';

    problemNameEl = document.createElement('div');
    problemNameEl.className = 'problem-name';
    problemNameEl.textContent = formatProblemName(titleSlug);

    const newChatBtn = document.createElement('button');
    newChatBtn.className = 'header-btn';
    newChatBtn.textContent = 'New Chat';
    newChatBtn.addEventListener('click', handleNewChat);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '\u00d7';
    closeBtn.title = 'Close chat';
    closeBtn.addEventListener('click', hidePanel);

    header.appendChild(titleEl);
    header.appendChild(problemNameEl);
    header.appendChild(newChatBtn);
    header.appendChild(closeBtn);

    // Messages area
    messagesArea = document.createElement('div');
    messagesArea.className = 'messages-area';

    // Empty state (shown when no messages)
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.id = 'lr-empty-state';

    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'empty-state-icon';
    emptyIcon.textContent = '\u2728';
    emptyState.appendChild(emptyIcon);
    emptyState.appendChild(document.createTextNode('Ask anything about this problem.\nShift+Enter for a new line.'));
    messagesArea.appendChild(emptyState);

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'input-area';

    const inputRow = document.createElement('div');
    inputRow.className = 'input-row';

    inputTextarea = document.createElement('textarea');
    inputTextarea.className = 'chat-textarea';
    inputTextarea.placeholder = 'Ask about this problem...';
    inputTextarea.addEventListener('keydown', function (event) {
      // Always stop propagation to prevent LeetCode key handlers from intercepting
      event.stopPropagation();
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        triggerSend();
      }
    });

    sendBtn = document.createElement('button');
    sendBtn.className = 'send-btn';
    sendBtn.textContent = 'Send';
    sendBtn.addEventListener('click', triggerSend);

    inputRow.appendChild(inputTextarea);
    inputRow.appendChild(sendBtn);

    loadingEl = document.createElement('div');
    loadingEl.className = 'loading';
    loadingEl.style.display = 'none';
    const dotsContainer = document.createElement('div');
    dotsContainer.className = 'loading-dots';
    for (let i = 0; i < 3; i++) dotsContainer.appendChild(document.createElement('span'));
    loadingEl.appendChild(dotsContainer);
    const loadingText = document.createElement('span');
    loadingText.textContent = 'Thinking';
    loadingEl.appendChild(loadingText);

    errorEl = document.createElement('div');
    errorEl.className = 'error-msg';
    errorEl.style.display = 'none';

    inputArea.appendChild(inputRow);
    inputArea.appendChild(loadingEl);
    inputArea.appendChild(errorEl);

    chatPanel.appendChild(header);
    chatPanel.appendChild(messagesArea);
    chatPanel.appendChild(inputArea);

    shadowRoot.appendChild(fontLink);
    shadowRoot.appendChild(style);
    shadowRoot.appendChild(chatButton);
    shadowRoot.appendChild(chatPanel);
  }

  function removeChatHost() {
    const existing = document.getElementById('ankleet-chat-host');
    if (existing) existing.remove();
    chatHost = null;
    shadowRoot = null;
    chatPanel = null;
    chatButton = null;
    messagesArea = null;
    inputTextarea = null;
    sendBtn = null;
    loadingEl = null;
    errorEl = null;
    problemNameEl = null;
    panelVisible = false;
  }

  // --- Panel show/hide ---

  function togglePanel() {
    if (panelVisible) {
      hidePanel();
    } else {
      showPanel();
    }
  }

  function showPanel() {
    if (!chatPanel) return;
    chatPanel.style.display = 'flex';
    // Trigger reflow then add class for CSS transition
    void chatPanel.offsetWidth;
    chatPanel.classList.add('visible');
    panelVisible = true;
    reloadConversation(currentTitleSlug);
  }

  function hidePanel() {
    if (!chatPanel) return;
    chatPanel.classList.remove('visible');
    panelVisible = false;
    // Wait for transition to finish before hiding
    setTimeout(function () {
      if (!panelVisible && chatPanel) chatPanel.style.display = 'none';
    }, 250);
  }

  // --- Conversation loading ---

  /**
   * Loads conversation from background.js and renders all non-system messages.
   * Named reloadConversation for Plan 02 contract (SHOW_CHAT_SEED handler).
   */
  function reloadConversation(titleSlug) {
    if (!messagesArea) return;
    chrome.runtime.sendMessage(
      { type: 'CHAT_LOAD_CONVERSATION', payload: { titleSlug } },
      function (response) {
        if (chrome.runtime.lastError) return;
        if (!response) return;
        clearMessagesArea();
        const conversation = response.conversation;
        if (!conversation || !conversation.messages || conversation.messages.length === 0) {
          showEmptyState();
          return;
        }
        // Render all non-system messages
        let hasVisible = false;
        for (const msg of conversation.messages) {
          if (msg.role === 'system') continue;
          appendMessageBubble(msg.role, msg.content);
          hasVisible = true;
        }
        if (!hasVisible) {
          showEmptyState();
        }
      }
    );
  }

  function clearMessagesArea() {
    if (!messagesArea) return;
    while (messagesArea.firstChild) messagesArea.removeChild(messagesArea.firstChild);
  }

  function showEmptyState() {
    if (!messagesArea) return;
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';

    const emptyIcon = document.createElement('div');
    emptyIcon.className = 'empty-state-icon';
    emptyIcon.textContent = '\u2728';
    emptyState.appendChild(emptyIcon);
    emptyState.appendChild(document.createTextNode('Ask anything about this problem.\nShift+Enter for a new line.'));
    messagesArea.appendChild(emptyState);
  }

  // --- New Chat ---

  function handleNewChat() {
    if (!currentTitleSlug) return;
    clearError();
    chrome.runtime.sendMessage(
      { type: 'CHAT_CLEAR_CONVERSATION', payload: { titleSlug: currentTitleSlug } },
      function (response) {
        if (chrome.runtime.lastError) {
          showError('Connection lost');
          return;
        }
        if (!response) {
          showError('No response received');
          return;
        }
        if (response.error) {
          showError(response.error);
          return;
        }
        clearMessagesArea();
        showEmptyState();
      }
    );
  }

  // --- Send message ---

  function triggerSend() {
    if (!inputTextarea || !sendBtn) return;
    const content = inputTextarea.value.trim();
    if (!content) return;
    if (sendBtn.disabled) return;

    // Clear empty state if present
    const emptyState = messagesArea ? messagesArea.querySelector('.empty-state') : null;
    if (emptyState) emptyState.remove();

    // Append user bubble
    appendMessageBubble('user', content);

    // Clear input
    inputTextarea.value = '';

    // Show loading, disable send
    showLoading();
    clearError();
    sendBtn.disabled = true;

    // Extract current editor code, then send message with code context
    extractEditorCode().then(function (userCode) {
      chrome.runtime.sendMessage(
        { type: 'CHAT_SEND_MESSAGE', payload: { titleSlug: currentTitleSlug, content, userCode } },
        function (response) {
          hideLoading();
          sendBtn.disabled = false;

          if (chrome.runtime.lastError) {
            showError('Connection lost \u2014 ' + (chrome.runtime.lastError.message || 'try again'));
            return;
          }
          if (!response) {
            showError('No response received');
            return;
          }
          if (response.error) {
            showError(response.error);
            return;
          }

          clearError();
          appendMessageBubble('assistant', response.reply);
        }
      );
    });
  }

  // --- Message bubble ---

  function appendMessageBubble(role, text) {
    if (!messagesArea) return;
    const messageEl = document.createElement('div');
    messageEl.className = 'message ' + role;

    const bubble = document.createElement('div');
    bubble.className = 'bubble';

    if (role === 'assistant') {
      renderMarkdown(bubble, text);
    } else {
      // User text: plain text content only, never innerHTML
      bubble.textContent = text;
    }

    messageEl.appendChild(bubble);
    messagesArea.appendChild(messageEl);
    messagesArea.scrollTop = messagesArea.scrollHeight;
  }

  // --- Markdown renderer ---

  /**
   * Renders AI response text into DOM nodes inside container.
   * All text content set via textContent or createTextNode — never innerHTML.
   * Handles: triple-backtick code fences, **bold**, `inline code`, bullet lists,
   * numbered lists, and regular paragraphs.
   */
  function renderMarkdown(container, text) {
    // Split on triple-backtick code fences first
    const parts = text.split(/(```[\s\S]*?```)/g);
    for (const part of parts) {
      if (part.startsWith('```')) {
        // Code fence: strip opening line (language tag) and closing fence
        const firstNewline = part.indexOf('\n');
        const body = firstNewline !== -1
          ? part.slice(firstNewline + 1).replace(/```$/, '')
          : part.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = body;
        pre.appendChild(code);
        container.appendChild(pre);
      } else {
        // Process line-by-line for block elements
        const lines = part.split('\n');
        let currentList = null;
        let currentListType = null; // 'ul' or 'ol'

        for (const line of lines) {
          const isBullet = /^[-*] /.test(line);
          const isNumbered = /^\d+\. /.test(line);

          if (isBullet) {
            if (currentListType !== 'ul') {
              currentList = document.createElement('ul');
              currentListType = 'ul';
              container.appendChild(currentList);
            }
            const li = document.createElement('li');
            appendInlineMarkdown(li, line.replace(/^[-*] /, ''));
            currentList.appendChild(li);
          } else if (isNumbered) {
            if (currentListType !== 'ol') {
              currentList = document.createElement('ol');
              currentListType = 'ol';
              container.appendChild(currentList);
            }
            const li = document.createElement('li');
            appendInlineMarkdown(li, line.replace(/^\d+\. /, ''));
            currentList.appendChild(li);
          } else {
            // Non-list line: reset list context
            currentList = null;
            currentListType = null;
            if (line.trim()) {
              const p = document.createElement('p');
              appendInlineMarkdown(p, line);
              container.appendChild(p);
            }
          }
        }
      }
    }
  }

  /**
   * Appends inline markdown (bold, inline code) as DOM nodes to el.
   * Text nodes set via createTextNode — never innerHTML.
   */
  function appendInlineMarkdown(el, text) {
    // Split on **bold** and `inline code` patterns
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    for (const part of parts) {
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const strong = document.createElement('strong');
        strong.textContent = part.slice(2, -2);
        el.appendChild(strong);
      } else if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
        const code = document.createElement('code');
        code.textContent = part.slice(1, -1);
        el.appendChild(code);
      } else {
        el.appendChild(document.createTextNode(part));
      }
    }
  }

  // --- Loading and error helpers ---

  function showLoading() {
    if (loadingEl) loadingEl.style.display = 'flex';
  }

  function hideLoading() {
    if (loadingEl) loadingEl.style.display = 'none';
  }

  function showError(message) {
    if (!errorEl) return;
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  function clearError() {
    if (!errorEl) return;
    errorEl.textContent = '';
    errorEl.style.display = 'none';
  }

  // --- SPA navigation detection ---

  function reinitChatPanel(newSlug) {
    injectChatPanel(newSlug);
  }

  let lastPath = location.pathname;

  const navObserver = new MutationObserver(function () {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (/^\/problems\/[^/]+/.test(location.pathname)) {
        reinitChatPanel(getCurrentTitleSlug());
      } else {
        removeChatHost();
        // Disconnect observer when navigated off problems/* entirely
        // (re-inject would happen if user navigates back via a new script invocation)
      }
    }
  });

  navObserver.observe(document.body, { childList: true, subtree: true });

  // --- Message listener (for SHOW_CHAT_SEED from background.js — Plan 02) ---

  chrome.runtime.onMessage.addListener(function (msg) {
    if (msg.type === 'SHOW_CHAT_SEED') {
      // Reload conversation regardless of whether the panel is currently open.
      // If panel is open, re-render messages; if closed, messages will load on next open.
      reloadConversation(msg.titleSlug || currentTitleSlug);
    }
  });

  // --- Bootstrap ---

  injectChatPanel(currentTitleSlug);

})();
