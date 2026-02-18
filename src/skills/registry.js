class SkillRegistry {
  constructor() {
    this._skills = new Map();
  }

  register(skill) {
    this._skills.set(skill.id, skill);
  }

  get(id) {
    return this._skills.get(id) || null;
  }

  getAll() {
    return [...this._skills.values()];
  }

  findByKeyword(keyword) {
    const kw = keyword.toLowerCase();
    return this.getAll().filter((s) => {
      return (
        s.name.toLowerCase().includes(kw) ||
        s.description.toLowerCase().includes(kw) ||
        s.tags.some((t) => t.toLowerCase().includes(kw)) ||
        s.capabilities.some((c) => c.toLowerCase().includes(kw))
      );
    });
  }

  getSummary() {
    return this.getAll()
      .map((s) => `- **${s.name}**: ${s.description}`)
      .join("\n");
  }

  getSkillCount() {
    return this._skills.size;
  }
}

module.exports = { SkillRegistry };
