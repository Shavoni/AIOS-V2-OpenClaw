const Dashboard = {
  async load() {
    try {
      const [health, agent, providers] = await Promise.all([
        fetch('/health').then(r => r.json()),
        API.get('/agent').catch(() => null),
        API.get('/providers').catch(() => []),
      ]);

      // Agent card
      const agentEl = document.getElementById('agent-info');
      if (agent) {
        agentEl.innerHTML = [
          '<div style="font-size:2rem;margin-bottom:8px">' + (agent.emoji || '') + '</div>',
          '<div style="font-size:1.2rem;font-weight:600">' + (agent.name || 'Agent') + '</div>',
          '<div style="color:var(--text-secondary);margin-bottom:8px">' + (agent.role || '') + '</div>',
          '<div style="font-size:0.8rem;color:var(--text-muted)">' + (agent.skillCount || 0) + ' skills loaded</div>',
        ].join('');
        // Update sidebar agent name
        const nameEl = document.getElementById('agent-name');
        if (nameEl) nameEl.textContent = agent.name || 'Scotty-5';
      }

      // Provider card
      const provEl = document.getElementById('provider-list');
      if (providers && providers.length) {
        provEl.innerHTML = providers.map(p =>
          '<div class="provider-item">' +
            '<span class="provider-name">' + p.id + '</span>' +
            '<span class="provider-status ' + (p.healthy ? 'healthy' : 'unhealthy') + '">' +
              (p.healthy ? 'Online' : 'Offline') +
            '</span>' +
          '</div>'
        ).join('');
      } else {
        provEl.textContent = 'No providers configured';
      }

      // Skill count
      const skillEl = document.getElementById('skill-count');
      skillEl.innerHTML = '<div style="font-size:2.5rem;font-weight:700;color:var(--accent)">' +
        (agent ? agent.skillCount : 0) +
        '</div><div style="color:var(--text-secondary)">Skills Loaded</div>';

      // Health card
      const healthEl = document.getElementById('health-info');
      const uptime = Math.floor(health.uptime || 0);
      const mins = Math.floor(uptime / 60);
      const secs = uptime % 60;
      healthEl.innerHTML = [
        '<div class="provider-item"><span>Status</span><span class="provider-status healthy">' + health.status + '</span></div>',
        '<div class="provider-item"><span>Version</span><span>' + (health.version || '0.1.0') + '</span></div>',
        '<div class="provider-item"><span>Uptime</span><span>' + mins + 'm ' + secs + 's</span></div>',
        '<div class="provider-item"><span>Providers</span><span>' + (health.providers || 0) + '</span></div>',
      ].join('');

    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  },
};
