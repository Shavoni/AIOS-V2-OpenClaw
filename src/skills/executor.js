const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");

class SkillExecutor {
  constructor(skillsDir) {
    this.skillsDir = skillsDir;
  }

  async execute(skillId, scriptName, args = []) {
    const scriptDir = path.join(this.skillsDir, skillId, "scripts");
    if (!fs.existsSync(scriptDir)) {
      return { success: false, output: "", error: "No scripts directory", duration: 0 };
    }

    const candidates = [
      path.join(scriptDir, `${scriptName}.js`),
      path.join(scriptDir, `${scriptName}.sh`),
      path.join(scriptDir, scriptName),
    ];

    let scriptPath = null;
    for (const c of candidates) {
      if (fs.existsSync(c)) { scriptPath = c; break; }
    }

    if (!scriptPath) {
      return { success: false, output: "", error: `Script not found: ${scriptName}`, duration: 0 };
    }

    const start = Date.now();
    const ext = path.extname(scriptPath);
    const cmd = ext === ".js" ? process.execPath : scriptPath;
    const cmdArgs = ext === ".js" ? [scriptPath, ...args] : args;

    return new Promise((resolve) => {
      execFile(cmd, cmdArgs, { timeout: 30000, cwd: this.skillsDir }, (err, stdout, stderr) => {
        const duration = Date.now() - start;
        if (err) {
          resolve({ success: false, output: stdout, error: stderr || err.message, duration });
        } else {
          resolve({ success: true, output: stdout, error: null, duration });
        }
      });
    });
  }
}

module.exports = { SkillExecutor };
