const path = require("path");
const { spawn } = require("child_process");
const {
  readMarkdown,
  listSubdirectories,
  fileExists,
  readJSON,
} = require("../utils/file-utils");
const { parseSkillFrontmatter, parseMetaJson } = require("../utils/skill-parser");
const config = require("../config-legacy");

class SkillEngine {
  constructor() {
    this.skillsDir = config.paths.skills;
    this.registry = new Map();
    this.loaded = false;
  }

  async loadSkills() {
    const dirs = await listSubdirectories(this.skillsDir);

    for (const dir of dirs) {
      try {
        const skillDir = path.join(this.skillsDir, dir);
        const skill = { id: dir, status: "loaded" };

        // Parse _meta.json
        const metaPath = path.join(skillDir, "_meta.json");
        if (await fileExists(metaPath)) {
          const meta = await readJSON(metaPath);
          Object.assign(skill, parseMetaJson(meta));
        }

        // Parse SKILL.md
        const skillMdPath = path.join(skillDir, "SKILL.md");
        if (await fileExists(skillMdPath)) {
          const content = await readMarkdown(skillMdPath);
          const { frontmatter, body } = parseSkillFrontmatter(content);
          skill.name = frontmatter.name || dir;
          skill.description = frontmatter.description || "";
          skill.emoji = frontmatter.emoji || "";
          skill.skillMd = body;
          skill.frontmatter = frontmatter;
        } else {
          skill.name = dir;
          skill.description = "";
          skill.skillMd = "";
        }

        // Parse skill.json if exists
        const skillJsonPath = path.join(skillDir, "skill.json");
        if (await fileExists(skillJsonPath)) {
          skill.skillJson = await readJSON(skillJsonPath);
        }

        // Check for scripts
        const scriptsDir = path.join(skillDir, "scripts");
        skill.hasScripts = await fileExists(scriptsDir);
        skill.scripts = [];
        if (skill.hasScripts) {
          const fs = require("fs/promises");
          const entries = await fs.readdir(scriptsDir);
          skill.scripts = entries.filter(
            (e) => e.endsWith(".js") || e.endsWith(".sh")
          );
        }

        skill.skillDir = skillDir;
        this.registry.set(dir, skill);
      } catch (err) {
        this.registry.set(dir, {
          id: dir,
          name: dir,
          status: "error",
          error: err.message,
        });
      }
    }

    this.loaded = true;
  }

  listSkills() {
    return Array.from(this.registry.values()).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description || "",
      version: s.version || "0.0.0",
      emoji: s.emoji || "",
      status: s.status,
      hasScripts: s.hasScripts || false,
      scripts: s.scripts || [],
    }));
  }

  getSkill(id) {
    const skill = this.registry.get(id);
    if (!skill) {
      throw Object.assign(new Error(`Skill '${id}' not found`), {
        statusCode: 404,
      });
    }
    return skill;
  }

  async executeSkill(id, command, args = []) {
    const skill = this.getSkill(id);

    if (!skill.hasScripts || skill.scripts.length === 0) {
      throw Object.assign(new Error(`Skill '${id}' has no executable scripts`), {
        statusCode: 400,
      });
    }

    // Find the script to run
    const scriptFile = skill.scripts.find((s) => s.endsWith(".js"));
    if (!scriptFile) {
      throw Object.assign(new Error(`No .js script found for skill '${id}'`), {
        statusCode: 400,
      });
    }

    const scriptPath = path.join(skill.skillDir, "scripts", scriptFile);
    const fullArgs = [scriptPath, command, ...args].filter(Boolean);

    return new Promise((resolve, reject) => {
      const start = Date.now();
      let stdout = "";
      let stderr = "";

      const proc = spawn("node", fullArgs, {
        cwd: skill.skillDir,
        timeout: 30000,
        env: { ...process.env },
      });

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        resolve({
          success: code === 0,
          output: stdout.trim(),
          error: stderr.trim(),
          exitCode: code,
          durationMs: Date.now() - start,
        });
      });

      proc.on("error", (err) => {
        reject(
          Object.assign(new Error(`Script execution failed: ${err.message}`), {
            statusCode: 500,
          })
        );
      });
    });
  }
}

module.exports = new SkillEngine();
