/**
 * AIOS V2 - Application Entry Point
 * Bootstraps the full SPA: state, API, router, sidebar, Socket.io, and all pages.
 */

import { Router } from './router.js';
import { State } from './state.js';
import { API } from './api.js';
import { Sidebar } from './components/sidebar.js';
import { DashboardPage } from './pages/dashboard.js';
import { ChatPage } from './pages/chat.js';
import { SkillsPage } from './pages/skills.js';
import { MemoryPage } from './pages/memory.js';
import { ModelsPage } from './pages/models.js';
import { MetricsPage } from './pages/metrics.js';
import { AgentsPage } from './pages/agents.js';
import { ApprovalsPage } from './pages/approvals.js';
import { AuditPage } from './pages/audit.js';
import { SettingsPage } from './pages/settings.js';
import { LoginPage } from './pages/login.js';
import { OnboardingPage } from './pages/onboarding.js';
import { IntegrationsPage } from './pages/integrations.js';
import { ThemeManager } from './components/theme-manager.js';

// ─── Initialize Core ─────────────────────────────────────
const state = new State();
const api = new API(state);
const router = new Router('#main-content');
const themeManager = new ThemeManager();
const app = { state, api, router, themeManager };

// ─── Sidebar ─────────────────────────────────────────────
const sidebarEl = document.getElementById('sidebar');
const sidebar = new Sidebar(sidebarEl, router, state);
sidebar.render();

// ─── Register Routes ─────────────────────────────────────
router
  .on('/', (mount) => {
    const page = new DashboardPage(app);
    return page.render(mount);
  })
  .on('/chat', (mount) => {
    const page = new ChatPage(app);
    return page.render(mount);
  })
  .on('/agents', (mount) => {
    const page = new AgentsPage(app);
    return page.render(mount);
  })
  .on('/skills', (mount) => {
    const page = new SkillsPage(app);
    return page.render(mount);
  })
  .on('/memory', (mount) => {
    const page = new MemoryPage(app);
    return page.render(mount);
  })
  .on('/models', (mount) => {
    const page = new ModelsPage(app);
    return page.render(mount);
  })
  .on('/metrics', (mount) => {
    const page = new MetricsPage(app);
    return page.render(mount);
  })
  .on('/approvals', (mount) => {
    const page = new ApprovalsPage(app);
    return page.render(mount);
  })
  .on('/audit', (mount) => {
    const page = new AuditPage(app);
    return page.render(mount);
  })
  .on('/settings', (mount) => {
    const page = new SettingsPage(app);
    return page.render(mount);
  })
  .on('/onboarding', (mount) => {
    const page = new OnboardingPage(app);
    return page.render(mount);
  })
  .on('/integrations', (mount) => {
    const page = new IntegrationsPage(app);
    return page.render(mount);
  })
  .on('/login', (mount) => {
    const page = new LoginPage(app);
    return page.render(mount);
  });

// ─── Socket.io Real-Time Updates ─────────────────────────
function initSocket() {
  if (typeof io === 'undefined') return null;

  const socket = io({
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 30000,
  });

  socket.on('connect', () => {
    console.log('Socket.io connected');
    state.set('socketConnected', true);
    socket.emit('join-room', 'dashboard');
    socket.emit('join-room', 'approvals');
    socket.emit('join-room', 'audit');
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket.io disconnected:', reason);
    state.set('socketConnected', false);
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('Socket.io reconnected after', attemptNumber, 'attempts');
    state.set('socketConnected', true);
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    state.set('socketReconnecting', attemptNumber);
  });

  socket.on('reconnect_failed', () => {
    state.set('socketConnected', false);
    state.set('socketReconnecting', false);
  });

  // HITL real-time updates
  socket.on('hitl:created', (approval) => {
    state.update('activity', (prev) => [
      { type: 'approval', message: `New ${approval.hitl_mode} approval queued`, timestamp: new Date().toISOString() },
      ...(prev || []).slice(0, 49),
    ]);
    state.invalidateCache('approvals');
    state.set('_hitl_event', { type: 'created', data: approval });
  });

  socket.on('hitl:approved', (approval) => {
    state.set('_hitl_event', { type: 'approved', data: approval });
  });

  socket.on('hitl:rejected', (approval) => {
    state.set('_hitl_event', { type: 'rejected', data: approval });
  });

  // Dashboard real-time metrics
  socket.on('chat:query', (event) => {
    state.update('activity', (prev) => [
      { type: 'chat', message: `Query handled by ${event.agent || 'Scotty'} (${event.latency}ms)`, timestamp: event.timestamp },
      ...(prev || []).slice(0, 49),
    ]);
  });

  socket.on('dashboard:metrics', (metrics) => {
    state.set('metrics', metrics);
  });

  // Audit real-time
  socket.on('audit:event', (event) => {
    state.set('_audit_event', { type: 'new', data: event });
  });

  return socket;
}

// Store socket reference globally for pages
app.socket = initSocket();

// ─── Auth Check & Start ──────────────────────────────────
async function boot() {
  // Check auth status — if auth not required (dev mode), proceed directly
  const authStatus = await api.checkAuthStatus();

  // If auth IS required and user is NOT authenticated, go to login
  // But user asked NOT to enforce this, so we just check silently
  if (authStatus.authRequired && !authStatus.authenticated && !api.isAuthenticated) {
    // Auth is required but not enforced — set dev mode user
    state.set('currentUser', { username: 'dev', role: 'admin', devMode: true });
  }

  router.start();
  api.startHealthPolling();
  sidebar.render(); // Re-render with user info

  console.log('AIOS V2 frontend initialized — 12 pages, real-time WebSocket enabled');
}

boot();
