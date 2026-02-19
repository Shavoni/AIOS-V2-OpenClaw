/**
 * SkillEngine CRUD — TDD tests
 * create, update, delete, import operations
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const { SkillEngine } = require("../../src/skills");

function makeTmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-crud-"));
  fs.mkdirSync(path.join(root, "skills"), { recursive: true });
  return root;
}

describe("SkillEngine CRUD", () => {
  let root, engine;

  beforeEach(() => {
    root = makeTmpRoot();
    engine = new SkillEngine(root);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  // --- createSkill ---
  describe("createSkill", () => {
    test("creates directory and SKILL.md with correct frontmatter", () => {
      const skill = engine.createSkill({
        id: "my-skill",
        name: "My Skill",
        description: "A test skill",
        version: "1.0.0",
        tags: ["test", "demo"],
        body: "# My Skill\n\nThis is the body.",
      });

      expect(skill.id).toBe("my-skill");
      expect(skill.name).toBe("My Skill");
      expect(skill.description).toBe("A test skill");

      const skillMd = fs.readFileSync(
        path.join(root, "skills", "my-skill", "SKILL.md"),
        "utf-8"
      );
      expect(skillMd).toContain("name: My Skill");
      expect(skillMd).toContain("# My Skill");
    });

    test("creates _meta.json with timestamp", () => {
      engine.createSkill({ id: "meta-test", name: "Meta" });

      const metaPath = path.join(root, "skills", "meta-test", "_meta.json");
      expect(fs.existsSync(metaPath)).toBe(true);

      const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
      expect(meta.slug).toBe("meta-test");
      expect(typeof meta.createdAt).toBe("number");
    });

    test("registers skill in memory", () => {
      engine.createSkill({ id: "in-memory", name: "In Memory" });
      const found = engine.getSkill("in-memory");
      expect(found).toBeTruthy();
      expect(found.name).toBe("In Memory");
    });

    test("rejects duplicate id", () => {
      engine.createSkill({ id: "dupe", name: "First" });
      expect(() => engine.createSkill({ id: "dupe", name: "Second" })).toThrow(
        /already exists/
      );
    });

    test("rejects path traversal characters", () => {
      expect(() =>
        engine.createSkill({ id: "../escape", name: "Bad" })
      ).toThrow(/Invalid skill ID/);
      expect(() =>
        engine.createSkill({ id: "foo\\bar", name: "Bad" })
      ).toThrow(/Invalid skill ID/);
      expect(() =>
        engine.createSkill({ id: "foo/bar", name: "Bad" })
      ).toThrow(/Invalid skill ID/);
    });

    test("requires name field", () => {
      expect(() => engine.createSkill({ id: "no-name" })).toThrow(/name/i);
    });
  });

  // --- updateSkill ---
  describe("updateSkill", () => {
    test("updates frontmatter fields", () => {
      engine.createSkill({
        id: "updatable",
        name: "Original",
        description: "Old desc",
        tags: ["old"],
      });

      const updated = engine.updateSkill("updatable", {
        name: "Updated",
        description: "New desc",
        tags: ["new", "updated"],
      });

      expect(updated.name).toBe("Updated");
      expect(updated.description).toBe("New desc");
      expect(updated.tags).toContain("new");

      // Verify file was rewritten
      const content = fs.readFileSync(
        path.join(root, "skills", "updatable", "SKILL.md"),
        "utf-8"
      );
      expect(content).toContain("name: Updated");
    });

    test("updates body content", () => {
      engine.createSkill({ id: "body-upd", name: "Body", body: "Old body" });
      const updated = engine.updateSkill("body-upd", {
        body: "# New Body\n\nFresh content.",
      });

      expect(updated.body).toContain("Fresh content");
    });

    test("syncs updated skill in registry", () => {
      engine.createSkill({ id: "sync-test", name: "Before" });
      engine.updateSkill("sync-test", { name: "After" });

      const found = engine.getSkill("sync-test");
      expect(found.name).toBe("After");
    });

    test("returns null for non-existent skill", () => {
      const result = engine.updateSkill("ghost", { name: "Nope" });
      expect(result).toBeNull();
    });
  });

  // --- deleteSkill ---
  describe("deleteSkill", () => {
    test("removes directory and unregisters from registry", () => {
      engine.createSkill({ id: "doomed", name: "Doomed" });
      expect(engine.getSkill("doomed")).toBeTruthy();

      const result = engine.deleteSkill("doomed");
      expect(result).toBe(true);
      expect(engine.getSkill("doomed")).toBeNull();
      expect(
        fs.existsSync(path.join(root, "skills", "doomed"))
      ).toBe(false);
    });

    test("returns false for non-existent skill", () => {
      const result = engine.deleteSkill("nonexistent");
      expect(result).toBe(false);
    });
  });

  // --- importSkill ---
  describe("importSkill", () => {
    test("imports raw SKILL.md content and registers skill", () => {
      const mdContent = [
        "---",
        "name: Imported Skill",
        "description: From upload",
        "version: 2.0.0",
        "tags:",
        "  - imported",
        "---",
        "",
        "# Imported",
        "",
        "This was uploaded.",
      ].join("\n");

      const skill = engine.importSkill("imported-skill", mdContent, "md");

      expect(skill.id).toBe("imported-skill");
      expect(skill.name).toBe("Imported Skill");
      expect(skill.description).toBe("From upload");
      expect(engine.getSkill("imported-skill")).toBeTruthy();

      const onDisk = fs.readFileSync(
        path.join(root, "skills", "imported-skill", "SKILL.md"),
        "utf-8"
      );
      expect(onDisk).toContain("Imported Skill");
    });
  });
});
