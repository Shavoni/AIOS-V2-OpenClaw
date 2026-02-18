const { PromptBuilder } = require("../../src/agent/prompt-builder");

describe("PromptBuilder", () => {
  const mockIdentity = {
    identity: "# Test Agent\nI am a test agent.",
    soul: "# Values\nBe helpful.",
    user: "# User\nTest User",
  };

  const builder = new PromptBuilder(mockIdentity);

  test("builds a prompt string", () => {
    const profile = { name: "General", description: "General assistant", model: "gpt-4o" };
    const result = builder.build(profile, null, null);
    expect(typeof result).toBe("string");
    expect(result).toContain("Test Agent");
  });

  test("includes governance constraints for DRAFT mode", () => {
    const profile = { name: "General", description: "General assistant", model: "gpt-4o" };
    const decision = { hitlMode: "DRAFT", providerConstraints: {}, guardrails: [] };
    const result = builder.build(profile, decision, null);
    expect(result).toContain("DRAFT");
  });

  test("includes local-only constraint", () => {
    const profile = { name: "Local", description: "Local model", model: "local" };
    const decision = { hitlMode: "INFORM", providerConstraints: { localOnly: true }, guardrails: [] };
    const result = builder.build(profile, decision, null);
    expect(result).toContain("local");
  });

  test("includes profile info", () => {
    const profile = { name: "Research", description: "Research mode", model: "gemini" };
    const result = builder.build(profile, null, null);
    expect(result).toContain("Research");
  });
});
