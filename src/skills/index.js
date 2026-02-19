const fs = require("fs");
const path = require("path");
const matter = require("gray-matter");
const { parseSkillMd } = require("./parser");
const { SkillRegistry } = require("./registry");
const { SkillExecutor } = require("./executor");

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;

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

  // --- CRUD Operations ---

  _validateSkillId(id) {
    const safeId = String(id || "").trim();
    if (!safeId || !VALID_ID_RE.test(safeId)) {
      throw new Error("Invalid skill ID: must be alphanumeric with hyphens/underscores");
    }
    return safeId;
  }

  createSkill(data) {
    const safeId = this._validateSkillId(data.id);
    if (!data.name) throw new Error("name is required");
    if (this.registry.get(safeId)) throw new Error("Skill already exists: " + safeId);

    // Ensure skills directory exists
    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }

    const skillDir = path.join(this.skillsDir, safeId);
    fs.mkdirSync(skillDir, { recursive: true });

    // Build SKILL.md with frontmatter
    const frontmatter = {
      name: data.name,
      description: data.description || "",
      version: data.version || "1.0.0",
      tags: data.tags || [],
    };
    const content = matter.stringify(data.body || "", frontmatter);
    fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");

    // Write _meta.json
    const meta = { slug: safeId, version: frontmatter.version, createdAt: Date.now() };
    fs.writeFileSync(path.join(skillDir, "_meta.json"), JSON.stringify(meta, null, 2), "utf-8");

    // Parse and register
    const skill = parseSkillMd(content, safeId);
    skill.hasScripts = false;
    this.registry.register(skill);
    return skill;
  }

  updateSkill(id, data) {
    const safeId = this._validateSkillId(id);
    const existing = this.registry.get(safeId);
    if (!existing) return null;

    const skillMdPath = path.join(this.skillsDir, safeId, "SKILL.md");
    const currentContent = fs.readFileSync(skillMdPath, "utf-8");
    const parsed = matter(currentContent);

    // Merge updates into frontmatter
    if (data.name !== undefined) parsed.data.name = data.name;
    if (data.description !== undefined) parsed.data.description = data.description;
    if (data.version !== undefined) parsed.data.version = data.version;
    if (data.tags !== undefined) parsed.data.tags = data.tags;

    const body = data.body !== undefined ? data.body : parsed.content;
    const newContent = matter.stringify(body, parsed.data);
    fs.writeFileSync(skillMdPath, newContent, "utf-8");

    // Re-parse and sync registry
    const updated = parseSkillMd(newContent, safeId);
    updated.hasScripts = fs.existsSync(path.join(this.skillsDir, safeId, "scripts"));
    this.registry.register(updated);
    return updated;
  }

  deleteSkill(id) {
    const safeId = this._validateSkillId(id);
    const skillDir = path.join(this.skillsDir, safeId);
    if (!fs.existsSync(skillDir)) return false;

    fs.rmSync(skillDir, { recursive: true, force: true });
    this.registry.unregister(safeId);
    return true;
  }

  importSkill(id, content, fileType) {
    const safeId = this._validateSkillId(id);
    if (this.registry.get(safeId)) throw new Error("Skill already exists: " + safeId);

    if (!fs.existsSync(this.skillsDir)) {
      fs.mkdirSync(this.skillsDir, { recursive: true });
    }

    const skillDir = path.join(this.skillsDir, safeId);
    fs.mkdirSync(skillDir, { recursive: true });

    if (fileType === "md") {
      fs.writeFileSync(path.join(skillDir, "SKILL.md"), content, "utf-8");
    } else {
      throw new Error("Unsupported file type: " + fileType);
    }

    const skillMdPath = path.join(skillDir, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) throw new Error("No SKILL.md found after import");

    const skillContent = fs.readFileSync(skillMdPath, "utf-8");
    const skill = parseSkillMd(skillContent, safeId);
    skill.hasScripts = fs.existsSync(path.join(skillDir, "scripts"));
    this.registry.register(skill);
    return skill;
  }
}

module.exports = { SkillEngine };
