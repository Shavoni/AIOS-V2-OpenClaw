const Settings = {
  async load() {
    try {
      const [providers, agent] = await Promise.all([
        API.get('/providers').catch(() => []),
        API.get('/agent').catch(() => null),
      ]);

      // Providers
      const provEl = document.getElementById('settings-providers');
      if (providers.length) {
        provEl.innerHTML = providers.map(p =>
          '<div class="provider-item">' +
            '<div>' +
              '<div class="provider-name">' + p.id + '</div>' +
              '<div style="font-size:0.75rem;color:var(--text-muted)">' + (p.defaultModel || 'No default model') + '</div>' +
            '</div>' +
            '<span class="provider-status ' + (p.healthy ? 'healthy' : 'unhealthy') + '">' +
              (p.healthy ? 'Online' : 'Offline') +
            '</span>' +
          '</div>'
        ).join('');
      } else {
        provEl.textContent = 'No providers configured';
      }

      // Profiles
      const profEl = document.getElementById('settings-profiles');
      if (agent && agent.profiles) {
        profEl.innerHTML = agent.profiles.map(p =>
          '<div class="profile-card">' +
            '<div class="profile-name">' + p.name + '</div>' +
            '<div class="profile-model">Model: ' + p.model + ' | Temp: ' + p.temperature + ' | Max: ' + p.maxTokens + '</div>' +
            '<div style="font-size:0.8rem;color:var(--text-secondary);margin-top:4px">' + p.description + '</div>' +
          '</div>'
        ).join('');
      }
    } catch (err) {
      console.error('Settings error:', err);
    }
  },
};
