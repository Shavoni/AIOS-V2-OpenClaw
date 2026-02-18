const fs = require("fs");
const fsPromises = require("fs").promises;
const path = require("path");

class FileMemory {
  constructor(projectRoot) {
    this.memoryDir = path.join(projectRoot, "memory");
    this.projectRoot = projectRoot;
  }

  /**
   * Get main memory content. Synchronous for context-builder compatibility,
   * but reads are small files and infrequent (once per request).
   */
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

  async listMemoryFiles() {
    try {
      const files = await fsPromises.readdir(this.memoryDir);
      const results = [];
      for (const f of files) {
        if (!f.endsWith(".md") && !f.endsWith(".json")) continue;
        const filePath = path.join(this.memoryDir, f);
        const stat = await fsPromises.stat(filePath);
        results.push({ name: f, path: filePath, size: stat.size });
      }
      return results;
    } catch (err) {
      if (err.code === "ENOENT") return [];
      throw err;
    }
  }

  /**
   * Synchronous list for callers that haven't been converted to async yet.
   */
  listMemoryFilesSync() {
    if (!fs.existsSync(this.memoryDir)) return [];
    return fs.readdirSync(this.memoryDir)
      .filter((f) => f.endsWith(".md") || f.endsWith(".json"))
      .map((f) => ({
        name: f,
        path: path.join(this.memoryDir, f),
        size: fs.statSync(path.join(this.memoryDir, f)).size,
      }));
  }

  async writeMemoryFile(filename, content) {
    // Sanitize filename to prevent directory traversal
    const safeName = path.basename(filename);
    if (!safeName || safeName !== filename) {
      throw new Error("Invalid filename");
    }
    if (!fs.existsSync(this.memoryDir)) await fsPromises.mkdir(this.memoryDir, { recursive: true });
    await fsPromises.writeFile(path.join(this.memoryDir, safeName), content, "utf-8");
  }
}

module.exports = { FileMemory };
