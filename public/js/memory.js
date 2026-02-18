const Memory = {
  async load() {
    try {
      const [sessions, files] = await Promise.all([
        API.get('/sessions').catch(() => []),
        API.get('/memory/files').catch(() => []),
      ]);

      // Session list
      const sessionList = document.getElementById('memory-session-list');
      if (sessions.length) {
        sessionList.innerHTML = sessions.map(s =>
          '<div class="memory-file-item" data-id="' + s.id + '">' +
            '<span>' + (s.title || 'Untitled') + '</span>' +
            '<span style="color:var(--text-muted);font-size:0.75rem">' + (s.profile || 'main') + '</span>' +
          '</div>'
        ).join('');

        sessionList.querySelectorAll('.memory-file-item').forEach(el => {
          el.addEventListener('click', () => this.loadSessionMessages(el.dataset.id));
        });
      } else {
        sessionList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem">No sessions</p>';
      }

      // Memory files
      const fileList = document.getElementById('memory-file-list');
      if (files.length) {
        fileList.innerHTML = files.map(f =>
          '<div class="memory-file-item">' +
            '<span>' + f.name + '</span>' +
            '<span style="color:var(--text-muted);font-size:0.75rem">' + Math.round(f.size / 1024) + 'KB</span>' +
          '</div>'
        ).join('');
      } else {
        fileList.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem">No memory files</p>';
      }
    } catch (err) {
      console.error('Memory load error:', err);
    }
  },

  async loadSessionMessages(sessionId) {
    try {
      const messages = await API.get('/sessions/' + sessionId + '/messages');
      const content = document.getElementById('memory-content');
      content.innerHTML = '<h3>Messages (' + messages.length + ')</h3>';
      const list = document.createElement('div');

      for (const msg of messages) {
        const div = document.createElement('div');
        div.style.cssText = 'padding:8px 12px;margin:4px 0;border-radius:6px;font-size:0.85rem;' +
          (msg.role === 'user'
            ? 'background:rgba(99,102,241,0.1);border-left:3px solid var(--accent)'
            : 'background:var(--bg-tertiary);border-left:3px solid var(--text-muted)');
        div.innerHTML = '<strong style="color:var(--text-secondary);font-size:0.75rem">' + msg.role + '</strong><br>' +
          MD.render(msg.content);
        list.appendChild(div);
      }

      content.appendChild(list);
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  },
};
