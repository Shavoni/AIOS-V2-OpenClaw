const Skills = {
  async load() {
    try {
      const skills = await API.get('/skills');
      const grid = document.getElementById('skills-grid');

      if (!skills.length) {
        grid.innerHTML = '<p style="color:var(--text-secondary);padding:32px">No skills installed</p>';
        return;
      }

      grid.innerHTML = skills.map(s =>
        '<div class="skill-card">' +
          '<h4>' + (s.name || s.id) + '</h4>' +
          '<p>' + (s.description || 'No description') + '</p>' +
          (s.capabilities && s.capabilities.length
            ? '<div class="caps">' + s.capabilities.map(c => '<span class="skill-cap">' + c + '</span>').join('') + '</div>'
            : '') +
          (s.hasScripts ? '<div style="margin-top:8px;font-size:0.7rem;color:var(--success)">Has scripts</div>' : '') +
        '</div>'
      ).join('');
    } catch (err) {
      document.getElementById('skills-grid').textContent = 'Failed to load skills';
      console.error('Skills error:', err);
    }
  },
};
