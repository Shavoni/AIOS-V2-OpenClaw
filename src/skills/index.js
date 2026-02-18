const fs = require("fs");
const path = require("path");
const { parseSkillMd } = require("./parser");
const { SkillRegistry } = require("./registry");
const { SkillExecutor } = require("./executor");

class SkillEngine {
  constructor(projectRoot) {
    this.skillsDir = path.join(projectRoot, "skills");
    this.registry = new SkillRegistry();
    this.executor = new SkillExecutor(this.skillsDir);
  }

  loadAll() {
    const report = { loaded: 0, failed: 0, errors: [] };

    if (!fs.existsSync(this.skillsDir)) return report;

    const dirs = fs.readdirSync(this.skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    for (const dir of dirs) {
      try {
        const skillMdPath = path.join(this.skillsDir, dir, "SKILL.md");
        if (!fs.existsSync(skillMdPath)) continue;

        const content = fs.readFileSync(skillMdPath, "utf-8");
        const skill = parseSkillMd(content, dir);

        const scriptsDir = path.join(this.skillsDir, dir, "scripts");
        skill.hasScripts = fs.existsSync(scriptsDir);

        this.registry.register(skill);
        report.loaded++;
      } catch (err) {
        report.failed++;
        report.errors.push({ skill: dir, error: err.message });
      }
    }

    return report;
  }

  getAllSkills() { return this.registry.getAll(); }
  getSkill(id) { return this.registry.get(id); }
  findSkills(keyword) { return this.registry.findByKeyword(keyword); }
  getSkillCount() { return this.registry.getSkillCount(); }
  getSkillSummary() { return this.registry.getSummary(); }

  async executeScript(skillId, scriptName, args) {
    return this.executor.execute(skillId, scriptName, args);
  }
}

module.exports = { SkillEngine };
