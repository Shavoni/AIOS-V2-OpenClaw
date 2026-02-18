const path = require("path");
const { readMarkdown, fileExists } = require("../utils/file-utils");
const config = require("../config-legacy");

class ContextAssembler {
  constructor() {
    this.identityDir = config.paths.identity;
    this.memoryDir = config.paths.memory;
  }

  async assembleContext() {
    const parts = [];

    // Core identity files
    const identityFiles = [
      { name: "SOUL.md", label: "CORE PERSONALITY & RULES" },
      { name: "IDENTITY.md", label: "AGENT IDENTITY" },
      { name: "USER.md", label: "USER PROFILE" },
    ];

    for (const file of identityFiles) {
      const filePath = path.join(this.identityDir, file.name);
      if (await fileExists(filePath)) {
        const content = await readMarkdown(filePath);
        parts.push(`## ${file.label}\n${content.trim()}`);
      }
    }

    // Long-term memory
    const memoryPath = path.join(this.identityDir, "MEMORY.md");
    if (await fileExists(memoryPath)) {
      const content = await readMarkdown(memoryPath);
      if (content.trim().length > 0) {
        parts.push(`## LONG-TERM MEMORY\n${content.trim()}`);
      }
    }

    // Today's log
    const today = new Date().toISOString().split("T")[0];
    const todayPath = path.join(this.memoryDir, `${today}.md`);
    if (await fileExists(todayPath)) {
      const content = await readMarkdown(todayPath);
      if (content.trim().length > 100) {
        // Only include if there's meaningful content
        const truncated =
          content.length > 2000
            ? content.slice(0, 2000) + "\n...(truncated)"
            : content;
        parts.push(`## TODAY'S LOG (${today})\n${truncated.trim()}`);
      }
    }

    return parts.join("\n\n---\n\n");
  }

  async assembleCompactContext() {
    const parts = [];

    // Just SOUL.md and IDENTITY.md for compact context
    const soulPath = path.join(this.identityDir, "SOUL.md");
    if (await fileExists(soulPath)) {
      const content = await readMarkdown(soulPath);
      // Take first 500 chars
      parts.push(content.trim().slice(0, 500));
    }

    const identityPath = path.join(this.identityDir, "IDENTITY.md");
    if (await fileExists(identityPath)) {
      const content = await readMarkdown(identityPath);
      parts.push(content.trim().slice(0, 300));
    }

    return parts.join("\n\n");
  }
}

module.exports = new ContextAssembler();
