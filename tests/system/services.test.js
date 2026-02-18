const { LLMConfig } = require("../../src/system/llm-config");
const { BrandingService } = require("../../src/system/branding");
const { CanonService } = require("../../src/system/canon");

describe("System Services", () => {
  let db;

  beforeAll(async () => {
    const initSqlJs = require("sql.js");
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");

    const { initSchema } = require("../../src/db/schema");
    initSchema(db);
  });

  afterAll(() => {
    if (db) db.close();
  });

  describe("LLMConfig", () => {
    let llmConfig;

    beforeAll(() => {
      llmConfig = new LLMConfig(db, () => {});
    });

    test("returns default config when empty", () => {
      const config = llmConfig.get();
      expect(config).toBeTruthy();
      expect(typeof config).toBe("object");
    });

    test("updates config values", () => {
      const updated = llmConfig.update({
        defaultProvider: "openai",
        defaultModel: "gpt-4o",
        temperature: 0.7,
      });
      expect(updated.defaultProvider).toBe("openai");
      expect(updated.defaultModel).toBe("gpt-4o");
    });

    test("persists config across reads", () => {
      const config = llmConfig.get();
      expect(config.defaultProvider).toBe("openai");
    });

    test("merges partial updates", () => {
      llmConfig.update({ temperature: 0.5 });
      const config = llmConfig.get();
      expect(config.temperature).toBe(0.5);
      expect(config.defaultProvider).toBe("openai");
    });
  });

  describe("BrandingService", () => {
    let branding;

    beforeAll(() => {
      branding = new BrandingService(db, () => {}, process.cwd());
    });

    test("returns default branding when empty", () => {
      const config = branding.get();
      expect(config).toBeTruthy();
      expect(typeof config).toBe("object");
    });

    test("updates branding", () => {
      const updated = branding.update({
        appName: "My AIOS",
        organization: "DEF1LIVE",
        primaryColor: "#6c5ce7",
      });
      expect(updated.appName).toBe("My AIOS");
      expect(updated.organization).toBe("DEF1LIVE");
    });

    test("persists branding", () => {
      const config = branding.get();
      expect(config.appName).toBe("My AIOS");
    });
  });

  describe("CanonService", () => {
    let canon;

    beforeAll(() => {
      canon = new CanonService(db, () => {});
    });

    test("starts with empty documents", () => {
      const docs = canon.listDocuments();
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBe(0);
    });

    test("adds a document", () => {
      const doc = canon.addDocument({
        filename: "company-handbook.txt",
        content: "This is our company handbook content.",
        file_type: "text",
      });
      expect(doc.id).toBeTruthy();
      expect(doc.filename).toBe("company-handbook.txt");
    });

    test("lists documents after adding", () => {
      const docs = canon.listDocuments();
      expect(docs.length).toBe(1);
    });

    test("adds another document", () => {
      canon.addDocument({
        filename: "policies.md",
        content: "# Policies\n\nOur company policies...",
        file_type: "markdown",
      });
      const docs = canon.listDocuments();
      expect(docs.length).toBe(2);
    });

    test("deletes a document", () => {
      const docs = canon.listDocuments();
      const id = docs[0].id;
      canon.deleteDocument(id);
      const remaining = canon.listDocuments();
      expect(remaining.length).toBe(1);
      expect(remaining.find((d) => d.id === id)).toBeUndefined();
    });
  });
});
