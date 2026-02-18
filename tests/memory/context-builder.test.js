const { ContextBuilder } = require("../../src/memory/context-builder");

describe("ContextBuilder", () => {
  test("builds context with memory and messages", () => {
    const mockStore = {
      getRecentMessages: jest.fn(() => [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ]),
    };
    const mockFileMemory = {
      getMainMemory: jest.fn(() => "# Memory\nSome important context."),
    };

    const builder = new ContextBuilder(mockStore, mockFileMemory);
    const context = builder.buildContext("session-1", 8000);

    expect(context.length).toBeGreaterThan(0);
    expect(context[0].role).toBe("system");
    expect(context[0].content).toContain("Memory");
  });

  test("works with empty memory", () => {
    const mockStore = {
      getRecentMessages: jest.fn(() => []),
    };
    const mockFileMemory = {
      getMainMemory: jest.fn(() => ""),
    };

    const builder = new ContextBuilder(mockStore, mockFileMemory);
    const context = builder.buildContext("session-1", 8000);
    expect(Array.isArray(context)).toBe(true);
  });
});
