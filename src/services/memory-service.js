const path = require("path");
const {
  readMarkdown,
  writeMarkdown,
  appendToFile,
  listDirectory,
  fileExists,
} = require("../utils/file-utils");
const config = require("../config-legacy");

class MemoryService {
  constructor() {
    this.memoryDir = config.paths.memory;
    this.identityDir = config.paths.identity;
  }

  async listFiles() {
    const memoryFiles = await listDirectory(this.memoryDir, ".md");

    const rootIdentityFiles = ["SOUL.md", "IDENTITY.md", "USER.md", "MEMORY.md"];
    const rootFiles = [];
    for (const name of rootIdentityFiles) {
      const fullPath = path.join(this.identityDir, name);
      if (await fileExists(fullPath)) {
        const fs = require("fs/promises");
        const stat = await fs.stat(fullPath);
        rootFiles.push({
          filename: name,
          path: fullPath,
          sizeBytes: stat.size,
          lastModified: stat.mtime.toISOString(),
          isIdentity: true,
        });
      }
    }

    return [...rootFiles, ...memoryFiles];
  }

  async readFile(filename) {
    const filePath = this._resolveSafePath(filename);
    if (!filePath) {
      throw Object.assign(new Error("Invalid filename"), { statusCode: 400 });
    }
    if (!(await fileExists(filePath))) {
      throw Object.assign(new Error("File not found"), { statusCode: 404 });
    }
    const content = await readMarkdown(filePath);
    const fs = require("fs/promises");
    const stat = await fs.stat(filePath);
    return {
      filename,
      content,
      lastModified: stat.mtime.toISOString(),
    };
  }

  async writeMemory(filename, content, mode = "overwrite") {
    if (!filename.endsWith(".md")) {
      throw Object.assign(new Error("Only .md files allowed"), { statusCode: 400 });
    }
    const filePath = path.join(this.memoryDir, path.basename(filename));

    if (mode === "append") {
      await appendToFile(filePath, "\n" + content);
    } else {
      await writeMarkdown(filePath, content);
    }

    return { success: true, filename: path.basename(filename) };
  }

  async searchMemory(query) {
    if (!query || query.length < 2) {
      return [];
    }

    const files = await this.listFiles();
    const results = [];
    const queryLower = query.toLowerCase();

    for (const file of files) {
      try {
        const content = await readMarkdown(file.path);
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(queryLower)) {
            results.push({
              filename: file.filename,
              lineNumber: i + 1,
              content: lines[i].trim(),
              context: lines
                .slice(Math.max(0, i - 1), i + 2)
                .map((l) => l.trim())
                .join("\n"),
            });
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    return results;
  }

  async getTodayLog() {
    const today = new Date().toISOString().split("T")[0];
    const filename = `${today}.md`;
    const filePath = path.join(this.memoryDir, filename);

    if (!(await fileExists(filePath))) {
      await writeMarkdown(filePath, `# ${today}\n\n`);
    }

    return this.readFile(filename);
  }

  _resolveSafePath(filename) {
    const basename = path.basename(filename);
    if (basename !== filename) return null;
    if (!basename.endsWith(".md")) return null;

    // Check identity files at root
    const rootIdentityFiles = ["SOUL.md", "IDENTITY.md", "USER.md", "MEMORY.md"];
    if (rootIdentityFiles.includes(basename)) {
      return path.join(this.identityDir, basename);
    }

    // Check memory directory
    return path.join(this.memoryDir, basename);
  }
}

module.exports = new MemoryService();
