const App = {
  pages: ['dashboard', 'chat', 'skills', 'memory', 'settings'],
  currentPage: null,
  chatInitialized: false,

  init() {
    // Connect socket
    SocketClient.connect();

    // Handle hash changes
    window.addEventListener('hashchange', () => this.route());

    // Nav link clicks
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.hash = link.getAttribute('href');
      });
    });

    // Initial route
    this.route();
  },

  route() {
    const hash = window.location.hash.slice(2) || 'dashboard';
    const page = this.pages.includes(hash) ? hash : 'dashboard';

    if (page === this.currentPage) return;
    this.currentPage = page;

    // Toggle pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById('page-' + page);
    if (target) target.classList.add('active');

    // Toggle nav
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const activeLink = document.querySelector('.nav-link[data-page="' + page + '"]');
    if (activeLink) activeLink.classList.add('active');

    // Load page content
    this.loadPage(page);
  },

  loadPage(page) {
    switch (page) {
      case 'dashboard':
        Dashboard.load();
        break;
      case 'chat':
        if (!this.chatInitialized) {
          Chat.load();
          this.chatInitialized = true;
        } else {
          Chat.loadSessions();
        }
        break;
      case 'skills':
        Skills.load();
        break;
      case 'memory':
        Memory.load();
        break;
      case 'settings':
        Settings.load();
        break;
    }
  },
};

// Start
document.addEventListener('DOMContentLoaded', () => App.init());
