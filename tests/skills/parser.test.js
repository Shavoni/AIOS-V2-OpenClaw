const { parseSkillMd, extractCapabilities, extractCommands } = require("../../src/skills/parser");
const { SAMPLE_SKILL_MD } = require("../helpers/fixtures");

describe("Skill Parser", () => {
  test("parses skill frontmatter", () => {
    const skill = parseSkillMd(SAMPLE_SKILL_MD, "test-skill");
    expect(skill.name).toBe("test-skill");
    expect(skill.description).toBe("A test skill for testing");
    expect(skill.version).toBe("1.0.0");
  });

  test("extracts tags", () => {
    const skill = parseSkillMd(SAMPLE_SKILL_MD, "test-skill");
    expect(skill.tags).toContain("test");
    expect(skill.tags).toContain("development");
  });

  test("extracts capabilities", () => {
    const skill = parseSkillMd(SAMPLE_SKILL_MD, "test-skill");
    expect(skill.capabilities).toContain("Run tests");
    expect(skill.capabilities).toContain("Generate test data");
  });

  test("extracts commands", () => {
    const skill = parseSkillMd(SAMPLE_SKILL_MD, "test-skill");
    expect(skill.commands.length).toBeGreaterThan(0);
  });

  test("returns body content", () => {
    const skill = parseSkillMd(SAMPLE_SKILL_MD, "test-skill");
    expect(skill.body.length).toBeGreaterThan(0);
  });
});
