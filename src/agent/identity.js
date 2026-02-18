const fs = require("fs");
const path = require("path");

class AgentIdentity {
  constructor(projectRoot) {
    this.root = projectRoot;
    this.soul = "";
    this.identity = "";
    this.user = "";
    this.name = "Scotty-5";
    this.role = "AI Assistant";
    this.emoji = "";
  }

  load() {
    this.soul = this._readFile("SOUL.md");
    this.identity = this._readFile("IDENTITY.md");
    this.user = this._readFile("USER.md");

    const nameMatch = this.identity.match(/\*?\*?Name:\*?\*?\s*(.+)/i) || this.identity.match(/^#\s+(.+)/m);
    if (nameMatch) this.name = nameMatch[1].replace(/\*+/g, "").trim();

    const roleMatch = this.identity.match(/\*?\*?Creature:\*?\*?\s*(.+)/i) || this.identity.match(/role:\s*(.+)/i);
    if (roleMatch) this.role = roleMatch[1].replace(/\*+/g, "").trim();

    const emojiMatch = this.identity.match(/\*?\*?Emoji:\*?\*?\s*(.+)/i);
    if (emojiMatch) this.emoji = emojiMatch[1].replace(/\*+/g, "").trim();

    return this;
  }

  getSummary() {
    return `${this.emoji} ${this.name} — ${this.role}`.trim();
  }

  _readFile(filename) {
    const filePath = path.join(this.root, filename);
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, "utf-8");
    }
    return "";
  }

  _extractSection(content, heading) {
    const regex = new RegExp(`^## ${heading}\s*\n([\s\S]*?)(?=^## |$)`, "m");
    const match = content.match(regex);
    return match ? match[1].trim() : "";
  }
}

module.exports = { AgentIdentity };
