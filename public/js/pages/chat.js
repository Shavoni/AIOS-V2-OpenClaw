/**
 * AIOS V2 - Chat Page (V1 Polish)
 * Full-featured chat with streaming, agent directory, routing transparency,
 * confidence indicators, source citations, HITL badges, message actions,
 * suggested follow-ups, and conversation management.
 */

import { renderMarkdown } from '../components/markdown.js';
import { showToast } from '../components/toast.js';
import { escapeHtml, formatTime, formatRelative, $, debounce } from '../utils.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "Summarize the last conversation",
  "What skills are available?",
  "Draft a professional email",
  "Review this for compliance issues",
  "Explain the current governance rules",
];

const HITL_BADGE_MAP = {
  INFORM:   'badge badge-hitl-inform',
  AUTO:     'badge badge-hitl-inform',
  DRAFT:    'badge badge-hitl-draft',
  REVIEW:   'badge badge-hitl-review',
  ESCALATE: 'badge badge-hitl-escalate',
};

const DOMAIN_BADGE_MAP = {
  general:   'badge badge-domain-general',
  hr:        'badge badge-domain-hr',
  finance:   'badge badge-domain-finance',
  legal:     'badge badge-domain-legal',
  health:    'badge badge-domain-health',
  comms:     'badge badge-domain-comms',
  devops:    'badge badge-domain-devops',
  research:  'badge badge-domain-research',
  concierge: 'badge badge-domain-concierge',
};

// ---------------------------------------------------------------------------
// ChatPage
// ---------------------------------------------------------------------------

export class ChatPage {
  constructor(app) {
    this.state = app.state;
    this.api = app.api;
    this.router = app.router;
    this._unsubs = [];
    this._activeConvId = null;
    this._sending = false;
    this._lastUserMessage = '';
    this._allConversations = [];
    this._streamMeta = {};          // metadata gathered during SSE stream
  }

  // =========================================================================
  //  Render
  // =========================================================================

  render(mount) {
    mount.innerHTML = `
      <div class="page page-chat">
        <div class="chat-layout">

          <!-- ─── Sidebar ─────────────────────────────────────── -->
          <aside class="chat-sidebar glass-card">
            <div class="chat-sidebar-header">
              <h3>Conversations</h3>
              <button class="btn btn-sm btn-primary" id="new-chat-btn">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round">
                  <line x1="7" y1="2" x2="7" y2="12"/>
                  <line x1="2" y1="7" x2="12" y2="7"/>
                </svg>
                New
              </button>
            </div>
            <div class="conv-search-wrap">
              <input type="text" class="conv-search-input" id="conv-search"
                     placeholder="Search conversations..." />
            </div>
            <div class="conversation-list" id="conversation-list"></div>

            <div class="agent-directory">
              <h4 class="agent-dir-title">Available Agents</h4>
              <div id="agent-directory-list" class="agent-dir-list">
                <div class="loading-state" style="font-size:0.75rem;">Loading...</div>
              </div>
            </div>
          </aside>

          <!-- ─── Main Chat Area ──────────────────────────────── -->
          <main class="chat-main">
            <div class="chat-messages" id="chat-messages">
              <div class="chat-welcome" id="chat-welcome">
                <div class="welcome-icon">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
                       stroke="var(--accent)" stroke-width="2">
                    <circle cx="24" cy="24" r="20"/>
                    <circle cx="24" cy="24" r="8" fill="var(--accent)" opacity="0.2"/>
                    <circle cx="24" cy="24" r="4" fill="var(--accent)"/>
                  </svg>
                </div>
                <h2>Chat with Scotty</h2>
                <p>Ask questions, run skills, or explore the system.</p>
                <div class="suggestions" id="suggestions">
                  ${SUGGESTIONS.map(s =>
                    `<button class="suggestion-btn">${escapeHtml(s)}</button>`
                  ).join('')}
                </div>
              </div>
            </div>

            <div class="chat-input-bar" id="chat-input-bar">
              <div class="chat-input-row">
                <textarea class="chat-textarea" id="chat-textarea"
                          placeholder="Type a message..." rows="1"
                          autocomplete="off"></textarea>
                <button class="btn btn-primary chat-send-btn" id="chat-send-btn"
                        title="Send message">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none"
                       stroke="currentColor" stroke-width="2"
                       stroke-linecap="round" stroke-linejoin="round">
                    <line x1="2" y1="9" x2="16" y2="9"/>
                    <polyline points="10,3 16,9 10,15"/>
                  </svg>
                </button>
              </div>
              <div class="chat-input-meta">
                <select class="model-selector" id="model-selector">
                  <option value="auto">Auto (Recommended)</option>
                  <option value="ollama">Ollama (Local)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Gemini</option>
                  <option value="lmstudio">LM Studio</option>
                </select>
                <span class="char-count" id="char-count"></span>
              </div>
            </div>
          </main>

        </div>
      </div>
    `;

    this._bindEvents(mount);
    this._loadConversations();
    this._loadAgentDirectory();
    this._checkQuickMessage();

    return () => this._cleanup();
  }

  // =========================================================================
  //  Event Binding
  // =========================================================================

  _bindEvents(mount) {
    const textarea = $('#chat-textarea', mount);
    const sendBtn  = $('#chat-send-btn', mount);
    const newBtn   = $('#new-chat-btn', mount);
    const search   = $('#conv-search', mount);

    // Auto-resize textarea + char count
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
      const cc = $('#char-count');
      if (cc) cc.textContent = textarea.value.length > 0 ? `${textarea.value.length}` : '';
    });

    // Send
    sendBtn.addEventListener('click', () => this._sendMessage());
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendMessage(); }
    });

    // New chat
    newBtn.addEventListener('click', () => this._startNewChat());

    // Conversation search (debounced)
    if (search) {
      const debouncedSearch = debounce((q) => this._filterConversations(q), 200);
      search.addEventListener('input', () => debouncedSearch(search.value));
    }

    // Suggestion buttons via delegation
    mount.addEventListener('click', (e) => {
      const suggBtn = e.target.closest('.suggestion-btn');
      if (suggBtn) {
        const ta = $('#chat-textarea');
        if (ta) { ta.value = suggBtn.textContent; this._sendMessage(); }
      }
    });

    // ── Message action buttons (delegation on chat-messages) ──
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl && !messagesEl._actionsDelegated) {
      messagesEl._actionsDelegated = true;
      messagesEl.addEventListener('click', (e) => {
        // Copy button
        const copyBtn = e.target.closest('.bubble-action-copy');
        if (copyBtn) {
          e.stopPropagation();
          this._copyBubbleText(copyBtn);
          return;
        }
        // Regenerate button
        const regenBtn = e.target.closest('.bubble-action-regen');
        if (regenBtn) {
          e.stopPropagation();
          this._regenerateLastResponse();
          return;
        }
        // Sources toggle
        const srcToggle = e.target.closest('.sources-toggle');
        if (srcToggle) {
          e.stopPropagation();
          const list = srcToggle.nextElementSibling;
          if (list) {
            const isOpen = list.style.display !== 'none';
            list.style.display = isOpen ? 'none' : 'block';
            srcToggle.setAttribute('aria-expanded', String(!isOpen));
            const chevron = srcToggle.querySelector('.sources-chevron');
            if (chevron) chevron.style.transform = isOpen ? '' : 'rotate(90deg)';
          }
        }
      });
    }
  }

  // =========================================================================
  //  Agent Directory
  // =========================================================================

  async _loadAgentDirectory() {
    const container = document.getElementById('agent-directory-list');
    if (!container) return;

    try {
      const agents = await this.api._get('/api/agents');
      if (!agents || agents.length === 0) {
        container.innerHTML = '<div class="agent-dir-empty">No agents configured</div>';
        return;
      }
      container.innerHTML = agents.map(agent => `
        <div class="agent-dir-item" title="${escapeHtml(agent.description || '')}">
          <span class="agent-dir-dot"
                style="background:${agent.status === 'active' ? '#00d2d3' : '#ff6b6b'}"></span>
          <span class="agent-dir-name">${escapeHtml(agent.name)}</span>
          <span class="agent-dir-domain">${escapeHtml(agent.domain || '')}</span>
        </div>
      `).join('');
    } catch {
      container.innerHTML = '<div class="agent-dir-empty">Agents unavailable</div>';
    }
  }

  // =========================================================================
  //  Quick Message (from sessionStorage)
  // =========================================================================

  _checkQuickMessage() {
    const msg = sessionStorage.getItem('aios_quick_message');
    if (msg) {
      sessionStorage.removeItem('aios_quick_message');
      const textarea = $('#chat-textarea');
      if (textarea) {
        textarea.value = msg;
        setTimeout(() => this._sendMessage(), 300);
      }
    }
  }

  // =========================================================================
  //  Conversation Management
  // =========================================================================

  async _loadConversations() {
    const listEl = document.getElementById('conversation-list');
    if (!listEl) return;

    const cached = this._getCachedConversations();
    if (cached.length) this._renderConversationList(cached);

    try {
      const conversations = await this.api.fetchConversations();
      if (Array.isArray(conversations)) {
        this._cacheConversations(conversations);
        this._renderConversationList(conversations);
      }
    } catch {
      if (!cached.length) {
        listEl.innerHTML = '<div class="empty-state"><p>No conversations yet</p></div>';
      }
    }
  }

  _renderConversationList(conversations) {
    const listEl = document.getElementById('conversation-list');
    if (!listEl) return;
    this._allConversations = conversations;

    if (!conversations.length) {
      listEl.innerHTML = '<div class="empty-state"><p>No conversations yet</p></div>';
      return;
    }

    listEl.innerHTML = conversations.map(conv => `
      <div class="conversation-item ${conv.id === this._activeConvId ? 'active' : ''}"
           data-conv-id="${escapeHtml(conv.id)}">
        <div class="conv-item-content">
          <div class="conv-title">${escapeHtml(conv.title || conv.id || 'Untitled')}</div>
          <div class="conv-meta">${formatRelative(conv.updatedAt || conv.lastActive || conv.createdAt || '')}</div>
        </div>
        <button class="conv-delete-btn" data-conv-id="${escapeHtml(conv.id)}"
                title="Delete conversation">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
               stroke="currentColor" stroke-width="1.5">
            <line x1="2" y1="2" x2="10" y2="10"/>
            <line x1="10" y1="2" x2="2" y2="10"/>
          </svg>
        </button>
      </div>
    `).join('');

    // Event delegation (one-time setup)
    if (!listEl._delegated) {
      listEl._delegated = true;
      listEl.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.conv-delete-btn');
        if (deleteBtn) {
          e.stopPropagation();
          this._deleteConversation(deleteBtn.getAttribute('data-conv-id'));
          return;
        }
        const convItem = e.target.closest('.conversation-item');
        if (convItem) {
          this._loadConversation(convItem.getAttribute('data-conv-id'));
        }
      });
    }
  }

  _filterConversations(query) {
    if (!this._allConversations) return;
    const q = query.toLowerCase().trim();
    if (!q) { this._renderConversationList(this._allConversations); return; }
    const filtered = this._allConversations.filter(c =>
      (c.title || '').toLowerCase().includes(q) ||
      (c.id || '').toLowerCase().includes(q)
    );
    this._renderConversationList(filtered);
  }

  async _deleteConversation(id) {
    if (!confirm('Delete this conversation?')) return;
    try {
      await this.api.deleteConversation(id);
      const cached = this._getCachedConversations().filter(c => c.id !== id);
      this._cacheConversations(cached);
      this._renderConversationList(cached);
      if (this._activeConvId === id) {
        this._activeConvId = null;
        this._startNewChat();
      }
      showToast('Conversation deleted', 'success');
    } catch (err) {
      showToast(`Failed to delete: ${err.message}`, 'error');
    }
  }

  async _loadConversation(id) {
    this._activeConvId = id;
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;
    messagesEl.innerHTML = '';

    document.querySelectorAll('.conversation-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-conv-id') === id);
    });

    try {
      let messages = [];
      try {
        const data = await this.api._get(`/api/chat/conversations/${encodeURIComponent(id)}`);
        messages = data.messages || data || [];
      } catch { messages = []; }

      if (Array.isArray(messages)) {
        messages.forEach(msg => {
          this._appendBubble(
            msg.role || msg.sender || 'user',
            msg.content || msg.text || '',
            { timestamp: msg.timestamp, hitlMode: msg.hitlMode }
          );
        });
        this._scrollToBottom();
      }
    } catch {
      showToast('Failed to load conversation', 'error');
    }
  }

  _startNewChat() {
    this._activeConvId = this._generateConvId();
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) {
      messagesEl.innerHTML = `
        <div class="chat-welcome">
          <div class="welcome-icon">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none"
                 stroke="var(--accent)" stroke-width="2">
              <circle cx="24" cy="24" r="20"/>
              <circle cx="24" cy="24" r="8" fill="var(--accent)" opacity="0.2"/>
              <circle cx="24" cy="24" r="4" fill="var(--accent)"/>
            </svg>
          </div>
          <h2>New Conversation</h2>
          <p>What would you like to explore?</p>
          <div class="suggestions">
            ${SUGGESTIONS.map(s =>
              `<button class="suggestion-btn">${escapeHtml(s)}</button>`
            ).join('')}
          </div>
        </div>
      `;
    }

    document.querySelectorAll('.conversation-item').forEach(el => el.classList.remove('active'));
    const textarea = $('#chat-textarea');
    if (textarea) textarea.focus();
  }

  // =========================================================================
  //  Send Message (with streaming + fallback)
  // =========================================================================

  async _sendMessage() {
    if (this._sending) return;

    const textarea = $('#chat-textarea');
    if (!textarea) return;
    const message = textarea.value.trim();
    if (!message) return;

    const model = $('#model-selector')?.value || 'auto';
    if (!this._activeConvId) this._activeConvId = this._generateConvId();

    // Store for regenerate feature
    this._lastUserMessage = message;

    // Clear welcome screen
    const welcome = document.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    // Append user bubble
    this._appendBubble('user', message);

    // Clear input
    textarea.value = '';
    textarea.style.height = 'auto';
    const charCount = $('#char-count');
    if (charCount) charCount.textContent = '';

    // Create empty assistant bubble with typing indicator
    const agentBubble = this._appendBubble('assistant', '', { isStreaming: true });
    const contentEl   = agentBubble.querySelector('.bubble-content');
    const metaEl      = agentBubble.querySelector('.bubble-meta');
    const actionsEl   = agentBubble.querySelector('.bubble-actions');

    // Show typing indicator using proper CSS class
    contentEl.innerHTML = `
      <span class="typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </span>`;

    this._sending = true;
    this._setSendState(false);

    let fullResponse = '';
    let responseMeta = {};
    let renderQueued = false;

    // Reset stream metadata accumulator
    this._streamMeta = {};

    try {
      // ── Attempt streaming first ──
      await this.api.sendMessageStream(
        this._activeConvId, message, model,
        (chunk, eventData) => {
          // First chunk: clear typing indicator
          if (!fullResponse) contentEl.innerHTML = '';
          fullResponse += chunk;

          // Capture any metadata sent alongside chunks
          if (eventData) {
            if (eventData.model)    this._streamMeta.model = eventData.model;
            if (eventData.provider) this._streamMeta.provider = eventData.provider;
          }

          // Debounce markdown rendering to avoid O(n^2) re-parses
          if (!renderQueued) {
            renderQueued = true;
            requestAnimationFrame(() => {
              contentEl.innerHTML = renderMarkdown(fullResponse);
              this._scrollToBottom();
              renderQueued = false;
            });
          }
        }
      );

      // Final render to ensure complete content is displayed
      if (fullResponse) {
        contentEl.innerHTML = renderMarkdown(fullResponse);
      } else {
        contentEl.innerHTML = '<span class="text-dim">No response received.</span>';
      }

      // Merge any stream-level metadata
      responseMeta = { ...this._streamMeta };

    } catch (err) {
      // ── Fallback to non-streaming ──
      if (!fullResponse) {
        try {
          contentEl.innerHTML = `
            <span class="typing-indicator">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </span>`;

          const response = await this.api.sendMessage(this._activeConvId, message, model);
          fullResponse = response.content || response.text || response.response || response.message || '';
          responseMeta = {
            model:      response.model,
            provider:   response.provider,
            hitlMode:   response.hitlMode,
            latencyMs:  response.latencyMs,
            agent:      response.agent,
            domain:     response.domain,
            confidence: response.confidence,
            reason:     response.reason || response.routingReason,
            sources:    response.sources,
            usage:      response.usage,
          };
          contentEl.innerHTML = renderMarkdown(fullResponse) ||
            '<span class="text-dim">Empty response.</span>';
        } catch (fallbackErr) {
          contentEl.innerHTML =
            `<span class="error-text">Error: ${escapeHtml(fallbackErr.message)}</span>`;
          showToast('Failed to send message', 'error');
        }
      } else {
        // Stream was partially received
        contentEl.innerHTML = renderMarkdown(fullResponse);
        responseMeta = { ...this._streamMeta };
        showToast('Stream interrupted — partial response shown', 'error');
      }
    } finally {
      this._sending = false;
      this._setSendState(true);
    }

    // ── Post-response enhancements ──

    // 1. Routing transparency bar
    this._renderRoutingBar(agentBubble, responseMeta);

    // 2. HITL mode badge in meta line
    this._renderMetaLine(metaEl, responseMeta);

    // 3. Source citations
    if (responseMeta.sources && Array.isArray(responseMeta.sources) && responseMeta.sources.length) {
      this._renderSourceCitations(agentBubble, responseMeta.sources);
    }

    // 4. Show action buttons
    if (actionsEl) actionsEl.style.display = '';

    // Store bubble text for copy
    agentBubble._responseText = fullResponse;

    this._scrollToBottom();
    this._updateConversationCache(this._activeConvId, message);
  }

  // =========================================================================
  //  Regenerate Last Response
  // =========================================================================

  _regenerateLastResponse() {
    if (this._sending || !this._lastUserMessage) return;

    // Remove the last assistant bubble
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return;
    const bubbles = messagesEl.querySelectorAll('.bubble-assistant');
    if (bubbles.length) {
      const lastBubble = bubbles[bubbles.length - 1];
      // Also remove routing bar if present
      const routingBar = lastBubble.nextElementSibling;
      if (routingBar && routingBar.classList.contains('routing-bar')) {
        routingBar.remove();
      }
      lastBubble.remove();
    }

    // Re-send the last user message
    const textarea = $('#chat-textarea');
    if (textarea) {
      textarea.value = this._lastUserMessage;
      this._sendMessage();
    }
  }

  // =========================================================================
  //  Copy Bubble Text
  // =========================================================================

  _copyBubbleText(copyBtn) {
    const bubble = copyBtn.closest('.bubble-assistant');
    if (!bubble) return;

    // Prefer stored plain text, fallback to innerText of content
    const contentEl = bubble.querySelector('.bubble-content');
    const text = bubble._responseText || contentEl?.innerText || '';

    navigator.clipboard.writeText(text).then(() => {
      // Visual feedback: swap icon briefly
      const originalHTML = copyBtn.innerHTML;
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"
        stroke="var(--accent-green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="2,7 5.5,10.5 12,3.5"/>
      </svg>`;
      copyBtn.title = 'Copied!';
      setTimeout(() => {
        copyBtn.innerHTML = originalHTML;
        copyBtn.title = 'Copy';
      }, 1500);
      showToast('Copied to clipboard', 'success');
    }).catch(() => {
      showToast('Failed to copy', 'error');
    });
  }

  // =========================================================================
  //  Bubble Rendering
  // =========================================================================

  _appendBubble(role, content, opts = {}) {
    const messagesEl = document.getElementById('chat-messages');
    if (!messagesEl) return document.createElement('div');

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble bubble-${role}`;

    const isUser = role === 'user';

    // Avatar
    const avatar = isUser
      ? `<div class="bubble-avatar user-avatar">U</div>`
      : `<div class="bubble-avatar agent-avatar">
           <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
             <circle cx="8" cy="8" r="6" stroke="var(--accent)" stroke-width="1.5"/>
             <circle cx="8" cy="8" r="2.5" fill="var(--accent)"/>
           </svg>
         </div>`;

    // Content
    const renderedContent = isUser
      ? escapeHtml(content)
      : (content ? renderMarkdown(content) : '');

    // Timestamp
    const timeStr = opts.timestamp
      ? `<span class="bubble-time">${formatTime(opts.timestamp)}</span>`
      : '';

    // HITL badge for historical messages
    let hitlBadge = '';
    if (!isUser && opts.hitlMode && opts.hitlMode !== 'INFORM') {
      const badgeClass = HITL_BADGE_MAP[opts.hitlMode] || 'badge badge-hitl-inform';
      hitlBadge = `<span class="${badgeClass}">${escapeHtml(opts.hitlMode)}</span>`;
    }

    // Action buttons for assistant bubbles (hidden by default, shown on hover via CSS)
    // For streaming bubbles, keep hidden until response completes
    const actionsHtml = !isUser ? `
      <div class="bubble-actions" style="${opts.isStreaming ? 'display:none' : ''}">
        <button class="bubble-action-btn bubble-action-copy" title="Copy">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
               stroke-linejoin="round">
            <rect x="4.5" y="4.5" width="8" height="8" rx="1.5"/>
            <path d="M9.5 4.5V2.5a1 1 0 00-1-1H2.5a1 1 0 00-1 1v6a1 1 0 001 1h2"/>
          </svg>
        </button>
        <button class="bubble-action-btn bubble-action-regen" title="Regenerate">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
               stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
               stroke-linejoin="round">
            <path d="M1.5 7a5.5 5.5 0 019.37-3.9M12.5 7a5.5 5.5 0 01-9.37 3.9"/>
            <polyline points="11,1 11,4 8,4"/>
            <polyline points="3,13 3,10 6,10"/>
          </svg>
        </button>
      </div>` : '';

    bubble.innerHTML = `
      ${avatar}
      <div class="bubble-body">
        <div class="bubble-header">
          <span class="bubble-sender">${isUser ? 'You' : 'Scotty'}</span>
          ${timeStr}
          ${hitlBadge}
        </div>
        <div class="bubble-content">${renderedContent}</div>
        ${actionsHtml}
        ${!isUser ? '<div class="bubble-meta"></div>' : ''}
      </div>
    `;

    messagesEl.appendChild(bubble);
    this._scrollToBottom();
    return bubble;
  }

  // =========================================================================
  //  Routing Transparency Bar
  // =========================================================================

  _renderRoutingBar(bubbleEl, meta) {
    // Only render if we have meaningful routing data
    if (!meta) return;

    const hasAgent      = meta.agent || meta.provider;
    const hasDomain     = meta.domain;
    const hasConfidence = meta.confidence != null;
    const hasReason     = meta.reason;
    const hasModel      = meta.model;
    const hasLatency    = meta.latencyMs;

    if (!hasAgent && !hasDomain && !hasConfidence && !hasReason && !hasModel) return;

    const bar = document.createElement('div');
    bar.className = 'routing-bar';

    const parts = [];

    // Agent / provider badge
    if (meta.agent) {
      parts.push(`<span class="routing-agent">${escapeHtml(meta.agent)}</span>`);
    } else if (meta.provider) {
      parts.push(`<span class="routing-agent">${escapeHtml(meta.provider)}</span>`);
    }

    // Model
    if (hasModel) {
      parts.push(`<span class="routing-model">${escapeHtml(meta.model)}</span>`);
    }

    // Domain badge
    if (hasDomain) {
      const domainLower = String(meta.domain).toLowerCase();
      const domainClass = DOMAIN_BADGE_MAP[domainLower] || 'badge badge-domain-general';
      parts.push(`<span class="${domainClass}">${escapeHtml(meta.domain)}</span>`);
    }

    // Confidence score
    if (hasConfidence) {
      const pct = typeof meta.confidence === 'number'
        ? Math.round(meta.confidence * 100)
        : meta.confidence;
      const color = pct >= 80 ? 'var(--accent-green)'
                  : pct >= 50 ? 'var(--accent-orange)'
                  : 'var(--accent-red)';
      parts.push(`<span class="routing-confidence" style="color:${color}">${pct}% confidence</span>`);
    }

    // Latency
    if (hasLatency) {
      parts.push(`<span class="routing-latency">${meta.latencyMs}ms</span>`);
    }

    // Routing reason
    if (hasReason) {
      parts.push(`<span class="routing-reason">${escapeHtml(meta.reason)}</span>`);
    }

    bar.innerHTML = `
      <svg class="routing-bar-icon" width="12" height="12" viewBox="0 0 12 12" fill="none"
           stroke="var(--text-muted)" stroke-width="1.2" stroke-linecap="round">
        <circle cx="2" cy="6" r="1.5"/>
        <circle cx="10" cy="3" r="1.5"/>
        <circle cx="10" cy="9" r="1.5"/>
        <line x1="3.5" y1="5.5" x2="8.5" y2="3.5"/>
        <line x1="3.5" y1="6.5" x2="8.5" y2="8.5"/>
      </svg>
      ${parts.join('<span class="routing-sep">&middot;</span>')}
    `;

    // Insert after the bubble (inside bubble-body, after bubble-meta)
    const bubbleBody = bubbleEl.querySelector('.bubble-body');
    if (bubbleBody) {
      bubbleBody.appendChild(bar);
    }
  }

  // =========================================================================
  //  Meta Line (HITL badge, model info)
  // =========================================================================

  _renderMetaLine(metaEl, meta) {
    if (!metaEl || !meta) return;

    const parts = [];

    // HITL mode badge with proper badge classes
    if (meta.hitlMode) {
      const mode = String(meta.hitlMode).toUpperCase();
      const badgeClass = HITL_BADGE_MAP[mode] || 'badge badge-hitl-inform';
      parts.push(`<span class="${badgeClass}">${escapeHtml(mode)}</span>`);
    }

    // Usage tokens
    if (meta.usage) {
      const tokensIn  = meta.usage.prompt || meta.usage.promptTokens || 0;
      const tokensOut = meta.usage.completion || meta.usage.completionTokens || 0;
      if (tokensIn || tokensOut) {
        parts.push(`<span class="meta-tokens">${tokensIn + tokensOut} tokens</span>`);
      }
    }

    if (parts.length) {
      metaEl.innerHTML = parts.join(' ');
    }
  }

  // =========================================================================
  //  Source Citations
  // =========================================================================

  _renderSourceCitations(bubbleEl, sources) {
    if (!sources || !sources.length) return;

    const section = document.createElement('div');
    section.className = 'sources-section';

    const header = `
      <button class="sources-toggle" aria-expanded="false">
        <svg class="sources-chevron" width="10" height="10" viewBox="0 0 10 10"
             fill="none" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round"
             style="transition:transform 0.15s ease">
          <polyline points="3,1 7,5 3,9"/>
        </svg>
        <span>Sources (${sources.length})</span>
      </button>
    `;

    const sourceItems = sources.map((src, i) => {
      const title     = escapeHtml(src.title || src.name || `Source ${i + 1}`);
      const relevance = src.relevance != null ? src.relevance : src.score;
      const url       = src.url || src.link || '';

      let relevanceHtml = '';
      if (relevance != null) {
        const pct = typeof relevance === 'number' && relevance <= 1
          ? Math.round(relevance * 100)
          : relevance;
        relevanceHtml = `<span class="source-relevance">${pct}%</span>`;
      }

      const titleHtml = url
        ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener" class="source-link">${title}</a>`
        : `<span class="source-title">${title}</span>`;

      return `
        <div class="source-item">
          <span class="source-index">${i + 1}</span>
          ${titleHtml}
          ${relevanceHtml}
        </div>`;
    }).join('');

    section.innerHTML = `
      ${header}
      <div class="sources-list" style="display:none">
        ${sourceItems}
      </div>
    `;

    const bubbleBody = bubbleEl.querySelector('.bubble-body');
    if (bubbleBody) {
      bubbleBody.appendChild(section);
    }
  }

  // =========================================================================
  //  Helpers
  // =========================================================================

  _scrollToBottom() {
    const messagesEl = document.getElementById('chat-messages');
    if (messagesEl) {
      requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
    }
  }

  _setSendState(enabled) {
    const btn = $('#chat-send-btn');
    if (btn) {
      btn.disabled = !enabled;
      btn.classList.toggle('sending', !enabled);
    }
  }

  _generateConvId() {
    return 'conv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  _getCachedConversations() {
    try { return JSON.parse(localStorage.getItem('aios_conversations') || '[]'); }
    catch { return []; }
  }

  _cacheConversations(conversations) {
    try { localStorage.setItem('aios_conversations', JSON.stringify(conversations)); }
    catch { /* storage full — non-critical */ }
  }

  _updateConversationCache(convId, lastMessage) {
    const cached = this._getCachedConversations();
    const existing = cached.find(c => c.id === convId);
    if (existing) {
      existing.updatedAt = new Date().toISOString();
      existing.title = existing.title || lastMessage.slice(0, 50);
    } else {
      cached.unshift({
        id: convId,
        title: lastMessage.slice(0, 50),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    this._cacheConversations(cached.slice(0, 50));
    this._renderConversationList(cached);
  }

  // =========================================================================
  //  Cleanup
  // =========================================================================

  _cleanup() {
    this._unsubs.forEach(fn => fn());
    this._unsubs = [];
    this._sending = false;
    // Cancel any in-flight stream request
    if (this.api._streamController) {
      this.api._streamController.abort();
      this.api._streamController = null;
    }
  }
}
