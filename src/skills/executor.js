const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");

class SkillExecutor {
  constructor(skillsDir) {
    this.skillsDir = skillsDir;
  }

  async execute(skillId, scriptName, args = {}) {
    const scriptsDir = path.join(this.skillsDir, skillId, "scripts");
    if (!fs.existsSync(scriptsDir)) {
      throw new Error(`No scripts directory for skill: ${skillId}`);
    }

    const scriptPath = path.join(scriptsDir, scriptName);
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptName} in skill ${skillId}`);
    }

    // Security: ensure script is within the skills directory
    const resolved = path.resolve(scriptPath);
    if (!resolved.startsWith(path.resolve(this.skillsDir))) {
      throw new Error("Script path traversal detected");
    }

    return new Promise((resolve, reject) => {
      const env = { ...process.env, SKILL_ARGS: JSON.stringify(args) };
      execFile(scriptPath, [], { env, timeout: 30000 }, (err, stdout, stderr) => {
        if (err) {
          reject(new Error(`Script execution failed: ${err.message}`));
          return;
        }
        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      });
    });
  }
}

module.exports = { SkillExecutor };
