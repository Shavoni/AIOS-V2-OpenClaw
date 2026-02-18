const SocketClient = {
  socket: null,
  connected: false,
  handlers: {},

  connect() {
    this.socket = io({ transports: ['websocket', 'polling'] });

    this.socket.on('connect', () => {
      this.connected = true;
      this._updateStatus(true);
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      this._updateStatus(false);
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (err) => {
      this.connected = false;
      this._updateStatus(false, true);
      console.error('Socket error:', err.message);
    });

    return this.socket;
  },

  on(event, handler) {
    if (this.socket) this.socket.on(event, handler);
  },

  emit(event, data) {
    if (this.socket) this.socket.emit(event, data);
  },

  _updateStatus(connected, error) {
    const dot = document.getElementById('status-dot');
    const text = document.getElementById('status-text');
    if (!dot || !text) return;

    dot.className = 'status-dot' + (connected ? ' connected' : error ? ' error' : '');
    text.textContent = connected ? 'Connected' : error ? 'Connection Error' : 'Disconnected';
  },
};
