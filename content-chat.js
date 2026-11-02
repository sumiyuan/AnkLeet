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

  function attachResizeBehavior(handle, panel) {
    const MIN_W = 320;
    const MIN_H = 360;
    let startX = 0;
    let startY = 0;
    let startW = 0;
    let startH = 0;
    let activePointer = null;

    function onMove(e) {
      if (e.pointerId !== activePointer) return;
      // Panel is anchored bottom-right, so moving up-left grows it.
      const dx = startX - e.clientX;
      const dy = startY - e.clientY;
      const maxW = window.innerWidth - 48;
      const maxH = window.innerHeight - 108;
      const newW = Math.max(MIN_W, Math.min(maxW, startW + dx));
      const newH = Math.max(MIN_H, Math.min(maxH, startH + dy));
      panel.style.width = newW + 'px';
      panel.style.height = newH + 'px';
    }

    function onUp(e) {
      if (e.pointerId !== activePointer) return;
      activePointer = null;
      panel.classList.remove('resizing');
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
      try {
        localStorage.setItem('ankleet-chat-size', JSON.stringify({
          w: panel.offsetWidth,
          h: panel.offsetHeight
        }));
      } catch (_) {}
    }

    handle.addEventListener('pointerdown', function (e) {
      if (activePointer !== null) return;
      e.preventDefault();
      e.stopPropagation();
      activePointer = e.pointerId;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startW = rect.width;
      startH = rect.height;
      panel.classList.add('resizing');
      // Listen on window (with capture) so events fire even if the cursor
      // leaves the small handle area or drifts onto LeetCode's own UI.
      window.addEventListener('pointermove', onMove, true);
      window.addEventListener('pointerup', onUp, true);
      window.addEventListener('pointercancel', onUp, true);
    });
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

    lrPrepareHost(chatHost);

    // Tokens come from content-theme.js (LR_TOKENS), shared with the toast UI
    const style = document.createElement('style');
    style.textContent = LR_TOKENS + `
      /* ── Launcher: a labelled pill, the panel's one way in ── */
      .chat-btn {
        all: initial;
        display: flex;
        align-items: center;
        gap: 8px;
        position: fixed;
        bottom: 24px;
        right: 24px;
        height: 40px;
        padding: 0 16px 0 14px;
        border-radius: 20px;
        background: var(--lr-primary);
        color: var(--lr-on-primary);
        font-family: var(--lr-font);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        box-shadow: var(--lr-shadow);
        z-index: 2147483647;
        transition: background 0.15s, transform 0.1s;
      }
      .chat-btn:hover { background: var(--lr-primary-hover); }
      .chat-btn:active { transform: translateY(1px); }
      .chat-btn:focus-visible { outline: 2px solid var(--lr-hue); outline-offset: 2px; }
      .chat-btn[aria-expanded="true"] { display: none; }

      /* ── Chat Panel ── */
      .chat-panel {
        all: initial;
        display: flex;
        flex-direction: column;
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 400px;
        height: 560px;
        min-width: 320px;
        min-height: 360px;
        max-width: calc(100vw - 48px);
        max-height: calc(100vh - 48px);
        border-radius: var(--lr-radius-panel);
        border: 1px solid var(--lr-border);
        background: var(--lr-bg-surface);
        color: var(--lr-text-primary);
        font-family: var(--lr-font);
        box-shadow: var(--lr-shadow);
        z-index: 2147483647;
        overflow: hidden;
        font-size: 14px;
        line-height: 21px;
        opacity: 0;
        transform: translateY(8px);
        transition: opacity 0.2s ease, transform 0.2s ease-out;
        pointer-events: none;
      }
      .chat-panel.visible {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }
      .chat-panel.resizing {
        transition: none;
        user-select: none;
      }

      /* ── Resize grip (top-left, panel anchored bottom-right) ── */
      .resize-handle {
        position: absolute;
        top: 0;
        left: 0;
        width: 18px;
        height: 18px;
        cursor: nwse-resize;
        z-index: 20;
        touch-action: none;
        display: flex;
        align-items: flex-start;
        justify-content: flex-start;
        padding: 4px;
        color: var(--lr-border-focus);
        user-select: none;
        transition: color 0.15s;
      }
      .resize-handle:hover { color: var(--lr-text-secondary); }

      /* ── Panel Header ── */
      .panel-header {
        display: flex;
        align-items: center;
        padding: 12px 12px 12px 20px;
        border-bottom: 1px solid var(--lr-border);
        flex-shrink: 0;
        gap: 8px;
      }
      .panel-head-text {
        flex: 1;
        min-width: 0;
      }
      .panel-title {
        font-size: 14px;
        line-height: 20px;
        font-weight: 600;
      }
      .problem-name {
        font-size: 12px;
        line-height: 16px;
        color: var(--lr-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .header-btn {
        all: initial;
        display: inline-flex;
        align-items: center;
        height: 28px;
        padding: 0 10px;
        border-radius: var(--lr-radius-btn);
        border: 1px solid var(--lr-border-focus);
        color: var(--lr-text-primary);
        font-family: var(--lr-font);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        flex-shrink: 0;
        transition: border-color 0.15s;
      }
      .header-btn:hover { border-color: var(--lr-text-primary); }
      .header-btn:focus-visible { outline: 2px solid var(--lr-hue); outline-offset: 2px; }
      .close-btn {
        all: initial;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: var(--lr-radius-sm);
        color: var(--lr-text-secondary);
        cursor: pointer;
        flex-shrink: 0;
        transition: color 0.15s, background 0.15s;
      }
      .close-btn:hover {
        color: var(--lr-text-primary);
        background: var(--lr-bg-elevated);
      }
      .close-btn:focus-visible { outline: 2px solid var(--lr-hue); outline-offset: 2px; }

      /* ── Messages Area ── */
      .messages-area {
        flex: 1;
        overflow-y: auto;
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
        scrollbar-width: thin;
        scrollbar-color: var(--lr-border) transparent;
      }

      /* ── Messages: the user's in a grey well on the right, the tutor's as plain text ── */
      .message {
        display: flex;
        flex-direction: column;
        word-break: break-word;
      }
      .message.user { align-self: flex-end; max-width: 85%; }
      .message.assistant { align-self: stretch; }

      .bubble {
        font-size: 14px;
        line-height: 21px;
        font-family: var(--lr-font);
      }
      .message.user .bubble {
        padding: 8px 12px;
        border-radius: var(--lr-radius-panel);
        background: var(--lr-bg-elevated);
        color: var(--lr-text-primary);
      }
      .message.assistant .bubble {
        color: var(--lr-text-primary);
      }

      /* ── Markdown inside assistant messages ── */
      .bubble p {
        margin: 0 0 10px 0;
        white-space: pre-wrap;
      }
      .bubble p:last-child { margin-bottom: 0; }
      .bubble pre {
        background: var(--lr-code-bg);
        padding: 12px 14px;
        border-radius: var(--lr-radius-btn);
        overflow-x: auto;
        font-family: var(--lr-font-mono);
        font-size: 12.5px;
        line-height: 19px;
        white-space: pre;
        margin: 10px 0;
        color: var(--lr-text-primary);
        border: 1px solid var(--lr-border);
      }
      .bubble code {
        background: var(--lr-code-bg);
        padding: 1px 5px;
        border-radius: var(--lr-radius-sm);
        font-family: var(--lr-font-mono);
        font-size: 12.5px;
        color: var(--lr-text-primary);
      }
      .bubble pre code {
        background: none;
        padding: 0;
        border-radius: 0;
      }
      .bubble ul, .bubble ol {
        margin: 6px 0 10px;
        padding-left: 20px;
      }
      .bubble li {
        margin-bottom: 4px;
      }
      .bubble strong {
        font-weight: 600;
      }

      /* ── Empty State ── */
      .empty-state {
        margin: auto 0 0;
        color: var(--lr-text-secondary);
        font-size: 14px;
        line-height: 21px;
      }
      .empty-state-title {
        display: block;
        color: var(--lr-text-primary);
        font-weight: 600;
        margin-bottom: 4px;
      }

      /* ── Input Area ── */
      .input-area {
        display: flex;
        flex-direction: column;
        padding: 12px 12px 12px 20px;
        border-top: 1px solid var(--lr-border);
        flex-shrink: 0;
        gap: 8px;
      }
      .input-row {
        display: flex;
        gap: 8px;
        align-items: flex-end;
      }
      .chat-textarea {
        flex: 1;
        height: 64px;
        resize: none;
        background: var(--lr-bg-surface);
        color: var(--lr-text-primary);
        border: 1px solid var(--lr-border-focus);
        border-radius: var(--lr-radius-btn);
        padding: 9px 12px;
        font-family: var(--lr-font);
        font-size: 14px;
        line-height: 20px;
        outline: none;
        transition: border-color 0.15s;
      }
      .chat-textarea:focus { border-color: var(--lr-text-primary); }
      .chat-textarea::placeholder { color: var(--lr-text-secondary); }
      .send-btn {
        all: initial;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 14px;
        height: 36px;
        border-radius: var(--lr-radius-btn);
        background: var(--lr-primary);
        color: var(--lr-on-primary);
        font-family: var(--lr-font);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.15s, transform 0.1s;
      }
      .send-btn:hover:not(:disabled) { background: var(--lr-primary-hover); }
      .send-btn:active:not(:disabled) { transform: translateY(1px); }
      .send-btn:focus-visible { outline: 2px solid var(--lr-hue); outline-offset: 2px; }
      .send-btn:disabled { opacity: 0.45; cursor: default; }

      /* ── Loading ── */
      .loading {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        color: var(--lr-text-secondary);
        font-family: var(--lr-font);
      }
      .loading-dots {
        display: flex;
        gap: 3px;
      }
      .loading-dots span {
        width: 4px;
        height: 4px;
        border-radius: 50%;
        background: currentColor;
        animation: dot-pulse 1.2s ease-in-out infinite;
      }
      .loading-dots span:nth-child(2) { animation-delay: 0.15s; }
      .loading-dots span:nth-child(3) { animation-delay: 0.3s; }
      @keyframes dot-pulse {
        0%, 60%, 100% { opacity: 0.25; }
        30% { opacity: 1; }
      }

      /* ── Error message ── */
      .error-msg {
        font-size: 13px;
        color: var(--lr-error);
        text-align: left;
        line-height: 18px;
        font-family: var(--lr-font);
      }

      @media (prefers-reduced-motion: reduce) {
        .chat-panel { transition: none; }
        .loading-dots span { animation: none; }
      }
    `;

    // Chat button (FAB)
    chatButton = document.createElement('button');
    chatButton.className = 'chat-btn';
    chatButton.setAttribute('aria-expanded', 'false');
    // Speech bubble icon, then the label
    chatButton.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
    chatButton.appendChild(document.createTextNode('Ask the tutor'));
    chatButton.addEventListener('click', togglePanel);

    // Panel
    chatPanel = document.createElement('div');
    chatPanel.className = 'chat-panel';
    chatPanel.setAttribute('role', 'dialog');
    chatPanel.setAttribute('aria-label', 'AI tutor');

    // Header
    const header = document.createElement('div');
    header.className = 'panel-header';

    const headText = document.createElement('div');
    headText.className = 'panel-head-text';

    const titleEl = document.createElement('div');
    titleEl.className = 'panel-title';
    titleEl.textContent = 'AI tutor';

    problemNameEl = document.createElement('div');
    problemNameEl.className = 'problem-name';
    problemNameEl.textContent = formatProblemName(titleSlug);

    const newChatBtn = document.createElement('button');
    newChatBtn.className = 'header-btn';
    newChatBtn.textContent = 'New chat';
    newChatBtn.addEventListener('click', handleNewChat);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    closeBtn.setAttribute('aria-label', 'Close chat');
    closeBtn.addEventListener('click', hidePanel);

    headText.appendChild(titleEl);
    headText.appendChild(problemNameEl);
    header.appendChild(headText);
    header.appendChild(newChatBtn);
    header.appendChild(closeBtn);

    // Messages area
    messagesArea = document.createElement('div');
    messagesArea.className = 'messages-area';

    // Empty state (shown when no messages)
    messagesArea.appendChild(buildEmptyState());

    // Input area
    const inputArea = document.createElement('div');
    inputArea.className = 'input-area';

    const inputRow = document.createElement('div');
    inputRow.className = 'input-row';

    inputTextarea = document.createElement('textarea');
    inputTextarea.className = 'chat-textarea';
    inputTextarea.placeholder = 'Ask about this problem…';
    inputTextarea.setAttribute('aria-label', 'Message the tutor');
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

    // Resize handle (top-left corner — panel is anchored bottom-right)
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    resizeHandle.title = 'Drag to resize';
    resizeHandle.innerHTML = '<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M1 9V1h8M1 5V1h4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';
    attachResizeBehavior(resizeHandle, chatPanel);

    chatPanel.appendChild(resizeHandle);
    chatPanel.appendChild(header);
    chatPanel.appendChild(messagesArea);
    chatPanel.appendChild(inputArea);

    // Restore previously saved size
    try {
      const saved = localStorage.getItem('ankleet-chat-size');
      if (saved) {
        const size = JSON.parse(saved);
        if (size && typeof size.w === 'number' && typeof size.h === 'number') {
          chatPanel.style.width = size.w + 'px';
          chatPanel.style.height = size.h + 'px';
        }
      }
    } catch (_) {}

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
    if (chatButton) chatButton.setAttribute('aria-expanded', 'true');
    if (inputTextarea) inputTextarea.focus();
    reloadConversation(currentTitleSlug);
    document.addEventListener('pointerdown', onOutsidePointer, true);
  }

  // Close the panel when the user clicks anywhere on the page outside it.
  // Clicks inside the closed shadow root are retargeted to chatHost.
  function onOutsidePointer(e) {
    if (!panelVisible || !chatHost) return;
    if (e.composedPath().includes(chatHost)) return;
    hidePanel(false);
  }

  function hidePanel(restoreFocus) {
    if (!chatPanel) return;
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    chatPanel.classList.remove('visible');
    panelVisible = false;
    if (chatButton) {
      chatButton.setAttribute('aria-expanded', 'false');
      if (restoreFocus !== false) chatButton.focus();
    }
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

  function buildEmptyState() {
    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';

    const title = document.createElement('strong');
    title.className = 'empty-state-title';
    title.textContent = 'Ask about this problem';
    emptyState.appendChild(title);
    emptyState.appendChild(document.createTextNode(
      'An approach, a bug, the complexity. Your current code is sent along with each message. ' +
      'Enter sends; Shift+Enter starts a new line.'));
    return emptyState;
  }

  function showEmptyState() {
    if (!messagesArea) return;
    messagesArea.appendChild(buildEmptyState());
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
