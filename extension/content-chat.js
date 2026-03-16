// LeetReminder — Chat Panel (content-chat.js)
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
        if (event.data && event.data.source === 'leetreminder' &&
            event.data.type === 'editor-code' && event.data.reqId === reqId) {
          resolved = true;
          window.removeEventListener('message', handler);
          resolve(event.data.code || '');
        }
      }
      window.addEventListener('message', handler);

      window.postMessage({
        source: 'leetreminder',
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
    chatHost.id = 'leetreminder-chat-host';
    document.body.appendChild(chatHost);

    shadowRoot = chatHost.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
      }

      /* Floating action button */
      .chat-btn {
        all: initial;
        display: flex;
        align-items: center;
        justify-content: center;
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #FF6B00;
        color: white;
        cursor: pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        z-index: 2147483647;
        transition: background 0.15s, transform 0.1s;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 22px;
        border: none;
        outline: none;
      }
      .chat-btn:hover { background: #e05f00; transform: scale(1.06); }
      .chat-btn:active { transform: scale(0.97); }

      /* Chat panel */
      .chat-panel {
        all: initial;
        display: flex;
        flex-direction: column;
        position: fixed;
        bottom: 80px;
        right: 24px;
        width: 380px;
        height: 520px;
        border-radius: 12px;
        background: #1a1a2e;
        color: #e0e0e0;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
        z-index: 2147483647;
        overflow: hidden;
        font-size: 14px;
      }

      /* Panel header */
      .panel-header {
        display: flex;
        align-items: center;
        padding: 12px 14px;
        border-bottom: 1px solid #2d2d44;
        flex-shrink: 0;
        gap: 8px;
      }
      .panel-title {
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
        flex-shrink: 0;
      }
      .problem-name {
        font-size: 12px;
        color: #888;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        flex: 1;
      }
      .new-chat-btn {
        all: initial;
        display: inline-block;
        padding: 4px 8px;
        border-radius: 5px;
        background: #2d2d44;
        color: #b0b0cc;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 11px;
        font-weight: 500;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.15s;
        border: none;
      }
      .new-chat-btn:hover { background: #3d3d5c; color: #e0e0e0; }
      .close-btn {
        all: initial;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 22px;
        height: 22px;
        border-radius: 4px;
        font-family: system-ui, sans-serif;
        font-size: 16px;
        color: #666;
        cursor: pointer;
        flex-shrink: 0;
        transition: color 0.15s, background 0.15s;
      }
      .close-btn:hover { color: #ccc; background: #2d2d44; }

      /* Messages area */
      .messages-area {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        scrollbar-width: thin;
        scrollbar-color: #3d3d5c transparent;
      }
      .messages-area::-webkit-scrollbar { width: 4px; }
      .messages-area::-webkit-scrollbar-track { background: transparent; }
      .messages-area::-webkit-scrollbar-thumb { background: #3d3d5c; border-radius: 2px; }

      /* Message bubbles */
      .message {
        display: flex;
        flex-direction: column;
        max-width: 85%;
        word-break: break-word;
      }
      .message.user {
        align-self: flex-end;
      }
      .message.assistant {
        align-self: flex-start;
      }
      .bubble {
        padding: 8px 12px;
        border-radius: 10px;
        line-height: 1.5;
        font-size: 13px;
      }
      .message.user .bubble {
        background: #FF6B00;
        color: white;
        border-bottom-right-radius: 3px;
      }
      .message.assistant .bubble {
        background: #2d2d44;
        color: #e0e0e0;
        border-bottom-left-radius: 3px;
      }

      /* Markdown styles inside assistant bubbles */
      .bubble p {
        margin: 0 0 6px 0;
        white-space: pre-wrap;
      }
      .bubble p:last-child { margin-bottom: 0; }
      .bubble pre {
        background: #0d0d1a;
        padding: 12px;
        border-radius: 6px;
        overflow-x: auto;
        font-family: 'Fira Mono', 'Consolas', monospace;
        font-size: 13px;
        white-space: pre;
        margin: 6px 0;
        color: #cdd6f4;
      }
      .bubble code {
        background: #0d0d1a;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: 'Fira Mono', 'Consolas', monospace;
        font-size: 12px;
        color: #cdd6f4;
      }
      .bubble pre code {
        background: none;
        padding: 0;
        border-radius: 0;
      }
      .bubble ul {
        margin: 4px 0;
        padding-left: 20px;
      }
      .bubble ol {
        margin: 4px 0;
        padding-left: 20px;
      }
      .bubble li {
        margin-bottom: 3px;
        line-height: 1.5;
      }
      .bubble strong {
        font-weight: 700;
        color: #ffffff;
      }

      /* Empty state */
      .empty-state {
        text-align: center;
        color: #555;
        font-size: 13px;
        margin: auto;
        padding: 20px;
        line-height: 1.6;
      }

      /* Input area */
      .input-area {
        display: flex;
        flex-direction: column;
        padding: 10px 12px 12px;
        border-top: 1px solid #2d2d44;
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
        height: 60px;
        resize: none;
        background: #16162a;
        color: #e0e0e0;
        border: 1px solid #3d3d5c;
        border-radius: 8px;
        padding: 8px 10px;
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        font-size: 13px;
        line-height: 1.4;
        outline: none;
        transition: border-color 0.15s;
      }
      .chat-textarea:focus { border-color: #FF6B00; }
      .chat-textarea::placeholder { color: #555; }
      .send-btn {
        all: initial;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 14px;
        height: 60px;
        border-radius: 8px;
        background: #FF6B00;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        flex-shrink: 0;
        transition: background 0.15s;
        border: none;
      }
      .send-btn:hover:not(:disabled) { background: #e05f00; }
      .send-btn:disabled { opacity: 0.4; cursor: default; }

      /* Loading indicator */
      .loading {
        font-size: 12px;
        color: #888;
        text-align: center;
        animation: pulse 1.5s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.4; }
      }

      /* Error message */
      .error-msg {
        font-size: 12px;
        color: #e05c5c;
        text-align: left;
        line-height: 1.4;
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
    chatPanel.style.display = 'none';

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
    newChatBtn.className = 'new-chat-btn';
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
    emptyState.textContent = 'Ask anything about this problem. Shift+Enter for a new line.';
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
    loadingEl.textContent = 'Thinking...';
    loadingEl.style.display = 'none';

    errorEl = document.createElement('div');
    errorEl.className = 'error-msg';
    errorEl.style.display = 'none';

    inputArea.appendChild(inputRow);
    inputArea.appendChild(loadingEl);
    inputArea.appendChild(errorEl);

    chatPanel.appendChild(header);
    chatPanel.appendChild(messagesArea);
    chatPanel.appendChild(inputArea);

    shadowRoot.appendChild(style);
    shadowRoot.appendChild(chatButton);
    shadowRoot.appendChild(chatPanel);
  }

  function removeChatHost() {
    const existing = document.getElementById('leetreminder-chat-host');
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
    panelVisible = true;
    reloadConversation(currentTitleSlug);
  }

  function hidePanel() {
    if (!chatPanel) return;
    chatPanel.style.display = 'none';
    panelVisible = false;
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
    emptyState.textContent = 'Ask anything about this problem. Shift+Enter for a new line.';
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
            showError('Connection lost — ' + (chrome.runtime.lastError.message || 'try again'));
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
    if (loadingEl) loadingEl.style.display = 'block';
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
