const Chat = {
  currentSession: null,
  streaming: false,

  init() {
    // Socket events
    SocketClient.on('session-joined', (data) => {
      console.log('Joined session:', data.sessionId);
    });

    SocketClient.on('session-created', (session) => {
      this.currentSession = session.id;
      document.getElementById('chat-title').textContent = session.title;
      this.loadSessions();
      this.joinSession(session.id);
    });

    SocketClient.on('typing', (isTyping) => {
      const el = document.getElementById('typing-indicator');
      el.classList.toggle('hidden', !isTyping);
    });

    SocketClient.on('response-start', () => {
      this.streaming = true;
      this._addStreamingMessage();
    });

    SocketClient.on('response-chunk', (data) => {
      this._appendToStream(data.text);
    });

    SocketClient.on('response-end', (data) => {
      this.streaming = false;
      this._finalizeStream(data);
    });

    SocketClient.on('messages-loaded', (data) => {
      this._renderMessages(data.messages);
    });

    SocketClient.on('error', (data) => {
      this.streaming = false;
      this._addMessage('assistant', 'Error: ' + data.message, { error: true });
    });

    // Form submit
    document.getElementById('chat-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.sendMessage();
    });

    // Auto-resize textarea
    const input = document.getElementById('chat-input');
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Enter to send (Shift+Enter for newline)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    // New chat button
    document.getElementById('new-chat-btn').addEventListener('click', () => {
      this.createSession();
    });
  },

  async load() {
    await this.loadSessions();
    this.init();
  },

  async loadSessions() {
    try {
      const sessions = await API.get('/sessions');
      const list = document.getElementById('session-list');
      if (!sessions.length) {
        list.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;padding:8px">No conversations yet</p>';
        return;
      }
      list.innerHTML = sessions.map(s =>
        '<div class="session-item' + (s.id === this.currentSession ? ' active' : '') + '" data-id="' + s.id + '">' +
          '<span>' + (s.title || 'Untitled') + '</span>' +
          '<button class="delete-btn" data-id="' + s.id + '">x</button>' +
        '</div>'
      ).join('');

      // Click handlers
      list.querySelectorAll('.session-item').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.classList.contains('delete-btn')) return;
          this.selectSession(el.dataset.id, el.querySelector('span').textContent);
        });
      });

      list.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          await API.del('/sessions/' + btn.dataset.id);
          if (this.currentSession === btn.dataset.id) {
            this.currentSession = null;
            document.getElementById('messages').innerHTML = '';
            document.getElementById('chat-title').textContent = 'Select or create a chat';
          }
          this.loadSessions();
        });
      });
    } catch (err) {
      console.error('Failed to load sessions:', err);
    }
  },

  selectSession(id, title) {
    this.currentSession = id;
    document.getElementById('chat-title').textContent = title || 'Chat';
    this.joinSession(id);
    this.loadSessions();
    SocketClient.emit('load-messages', { sessionId: id });
  },

  joinSession(id) {
    SocketClient.emit('join-session', id);
  },

  createSession() {
    const profile = document.getElementById('profile-select').value;
    SocketClient.emit('create-session', { title: 'New Chat', profile });
  },

  sendMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text || this.streaming) return;

    if (!this.currentSession) {
      this.createSession();
      // Wait for session to be created, then send
      const handler = () => {
        SocketClient.socket.off('session-created', handler);
        setTimeout(() => this._doSend(text), 100);
      };
      SocketClient.on('session-created', handler);
      return;
    }

    this._doSend(text);
    input.value = '';
    input.style.height = 'auto';
  },

  _doSend(text) {
    this._addMessage('user', text);
    const profile = document.getElementById('profile-select').value;
    SocketClient.emit('send-message', {
      sessionId: this.currentSession,
      message: text,
      profile,
    });
  },

  _addMessage(role, content, opts = {}) {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = 'message ' + role;
    if (opts.error) div.classList.add('escalation');

    if (role === 'assistant') {
      div.innerHTML = MD.render(content);
    } else {
      div.textContent = content;
    }

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return div;
  },

  _addStreamingMessage() {
    const container = document.getElementById('messages');
    const div = document.createElement('div');
    div.className = 'message assistant streaming-cursor';
    div.id = 'streaming-msg';
    div.innerHTML = '';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  },

  _appendToStream(text) {
    const el = document.getElementById('streaming-msg');
    if (!el) return;
    el._rawText = (el._rawText || '') + text;
    el.innerHTML = MD.render(el._rawText);
    el.parentElement.scrollTop = el.parentElement.scrollHeight;
  },

  _finalizeStream(meta) {
    const el = document.getElementById('streaming-msg');
    if (!el) return;
    el.classList.remove('streaming-cursor');
    el.id = '';

    // Add meta info
    if (meta && (meta.model || meta.provider)) {
      const metaSpan = document.createElement('span');
      metaSpan.className = 'meta';
      metaSpan.textContent = [meta.model, meta.provider].filter(Boolean).join(' via ');
      el.appendChild(metaSpan);
    }

    // Check HITL mode styling
    if (meta && meta.hitlMode === 'ESCALATE') {
      el.classList.add('escalation');
    } else if (meta && meta.hitlMode === 'DRAFT') {
      el.classList.add('draft');
    }
  },

  _renderMessages(messages) {
    const container = document.getElementById('messages');
    container.innerHTML = '';
    for (const msg of messages) {
      this._addMessage(msg.role, msg.content);
    }
  },
};
