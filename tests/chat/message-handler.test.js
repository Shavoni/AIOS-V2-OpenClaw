const { MessageHandler } = require("../../src/chat/message-handler");
const { createMockRouter, createMockAgent, createMockMemory, createMockGovernance, createMockSkills } = require("../helpers/mocks");

describe("MessageHandler", () => {
  let handler, mocks;

  beforeEach(() => {
    mocks = {
      router: createMockRouter(),
      agent: createMockAgent(),
      memory: createMockMemory(),
      governance: createMockGovernance(),
      skills: createMockSkills(),
    };
    handler = new MessageHandler(mocks);
  });

  test("handle returns response for general message", async () => {
    const result = await handler.handle("session-1", "Hello");
    expect(result.text).toBe("Mock response");
    expect(result.hitlMode).toBe("INFORM");
    expect(result.streamed).toBe(false);
  });

  test("handle saves user and assistant messages", async () => {
    await handler.handle("session-1", "Hello");
    expect(mocks.memory.addMessage).toHaveBeenCalledTimes(2);
    expect(mocks.memory.addMessage.mock.calls[0][1]).toBe("user");
    expect(mocks.memory.addMessage.mock.calls[1][1]).toBe("assistant");
  });

  test("handle returns escalation for ESCALATE mode", async () => {
    mocks.governance.engine.evaluate.mockReturnValue({
      hitlMode: "ESCALATE",
      approvalRequired: true,
      providerConstraints: { localOnly: false },
      policyTriggers: ["no-external-posting"],
      guardrails: [],
      escalationReason: "Requires approval",
    });

    const result = await handler.handle("session-1", "Post publicly");
    expect(result.hitlMode).toBe("ESCALATE");
    expect(result.text).toContain("human approval");
    expect(mocks.router.route).not.toHaveBeenCalled();
  });

  test("handle adds DRAFT prefix", async () => {
    mocks.governance.engine.evaluate.mockReturnValue({
      hitlMode: "DRAFT",
      approvalRequired: true,
      providerConstraints: { localOnly: false },
      policyTriggers: ["legal-review"],
      guardrails: [],
      escalationReason: null,
    });

    const result = await handler.handle("session-1", "Review contract");
    expect(result.text).toContain("DRAFT");
  });

  test("handle logs audit entry", async () => {
    await handler.handle("session-1", "Hello");
    expect(mocks.memory.addAuditLog).toHaveBeenCalled();
  });

  test("handleStream yields chunks", async () => {
    const chunks = [];
    for await (const chunk of handler.handleStream("session-1", "Hello")) {
      chunks.push(chunk);
    }
    expect(chunks.length).toBeGreaterThan(0);
    const done = chunks.find(c => c.done);
    expect(done).toBeTruthy();
  });

  test("handleStream yields escalation for ESCALATE", async () => {
    mocks.governance.engine.evaluate.mockReturnValue({
      hitlMode: "ESCALATE",
      approvalRequired: true,
      providerConstraints: { localOnly: false },
      policyTriggers: ["no-external-posting"],
      guardrails: [],
      escalationReason: "Needs approval",
    });

    const chunks = [];
    for await (const chunk of handler.handleStream("session-1", "Post publicly")) {
      chunks.push(chunk);
    }
    expect(chunks).toHaveLength(1);
    expect(chunks[0].done).toBe(true);
    expect(chunks[0].text).toContain("human approval");
  });
});
