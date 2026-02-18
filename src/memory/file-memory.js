const fs = require("fs");
const path = require("path");

class FileMemory {
  constructor(projectRoot) {
    this.memoryDir = path.join(projectRoot, "memory");
    this.projectRoot = projectRoot;
  }

  getMainMemory() {
    const memPath = path.join(this.memoryDir, "MEMORY.md");
    if (fs.existsSync(memPath)) return fs.readFileSync(memPath, "utf-8");

    const rootPath = path.join(this.projectRoot, "MEMORY.md");
    if (fs.existsSync(rootPath)) return fs.readFileSync(rootPath, "utf-8");

    return "";
  }

  getDailyLog(date) {
    const filename = (date || new Date().toISOString().slice(0, 10)) + ".md";
    const logPath = path.join(this.memoryDir, filename);
    if (fs.existsSync(logPath)) return fs.readFileSync(logPath, "utf-8");
    return "";
  }

  listMemoryFiles() {
    if (!fs.existsSync(this.memoryDir)) return [];
    return fs.readdirSync(this.memoryDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => ({
        name: f,
        path: path.join(this.memoryDir, f),
        size: fs.statSync(path.join(this.memoryDir, f)).size,
      }));
  }

  writeMemoryFile(filename, content) {
    if (!fs.existsSync(this.memoryDir)) fs.mkdirSync(this.memoryDir, { recursive: true });
    fs.writeFileSync(path.join(this.memoryDir, filename), content, "utf-8");
  }
}

module.exports = { FileMemory };
