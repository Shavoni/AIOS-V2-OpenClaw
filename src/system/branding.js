const fs = require("fs");
const path = require("path");

class BrandingService {
  constructor(db, saveFn, projectRoot) {
    this.db = db;
    this.saveFn = saveFn;
    this.projectRoot = projectRoot;
    this.uploadsDir = path.join(projectRoot, "public", "uploads");
  }

  get() {
    const stmt = this.db.prepare(
      "SELECT value FROM system_settings WHERE key = ?"
    );
    stmt.bind(["branding"]);
    let branding = {
      appName: "AIOS V2",
      organization: "",
      logoUrl: "",
      primaryColor: "#6c5ce7",
      tagline: "AI Operating System",
    };
    if (stmt.step()) {
      try {
        branding = { ...branding, ...JSON.parse(stmt.getAsObject().value) };
      } catch {}
    }
    stmt.free();
    return branding;
  }

  update(updates) {
    const existing = this.get();
    const merged = { ...existing, ...updates };
    const json = JSON.stringify(merged);

    this.db.run(
      `INSERT OR REPLACE INTO system_settings (key, value, updated_at)
       VALUES ('branding', ?, datetime('now'))`,
      [json]
    );
    if (this.saveFn) this.saveFn();
    return merged;
  }

  uploadLogo(fileBuffer, filename) {
    const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico"]);
    const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new Error("Empty file");
    }
    if (fileBuffer.length > MAX_LOGO_SIZE) {
      throw new Error("Logo file too large (max 2MB)");
    }

    const ext = path.extname(filename || "").toLowerCase() || ".png";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new Error(`Invalid file type: ${ext}. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`);
    }

    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }

    const safeName = `logo${ext}`;
    const filePath = path.join(this.uploadsDir, safeName);
    fs.writeFileSync(filePath, fileBuffer);

    const logoUrl = `/uploads/${safeName}`;
    this.update({ logoUrl });
    return { logoUrl };
  }
}

module.exports = { BrandingService };
