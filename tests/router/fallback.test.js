const { FallbackChain } = require("../../src/router/fallback");

describe("FallbackChain", () => {
  test("executes first healthy provider", async () => {
    const providers = [
      {
        id: "first",
        complete: jest.fn(async () => ({ text: "first", model: "m1", provider: "first" })),
        completeStream: jest.fn(),
      },
      {
        id: "second",
        complete: jest.fn(async () => ({ text: "second", model: "m2", provider: "second" })),
        completeStream: jest.fn(),
      },
    ];

    const chain = new FallbackChain(providers);
    const result = await chain.execute([], {});
    expect(result.text).toBe("first");
    expect(providers[1].complete).not.toHaveBeenCalled();
  });

  test("falls through on failure", async () => {
    const providers = [
      {
        id: "failing",
        complete: jest.fn(async () => { throw new Error("fail"); }),
        completeStream: jest.fn(),
      },
      {
        id: "working",
        complete: jest.fn(async () => ({ text: "backup", model: "m2", provider: "working" })),
        completeStream: jest.fn(),
      },
    ];

    const chain = new FallbackChain(providers);
    const result = await chain.execute([], {});
    expect(result.text).toBe("backup");
    expect(result.attemptCount).toBe(2);
  });

  test("throws when all providers fail", async () => {
    const providers = [
      { id: "a", complete: jest.fn(async () => { throw new Error("fail a"); }) },
      { id: "b", complete: jest.fn(async () => { throw new Error("fail b"); }) },
    ];

    const chain = new FallbackChain(providers);
    await expect(chain.execute([], {})).rejects.toThrow("All providers failed");
  });

  test("resetFailures clears cooldown", () => {
    const chain = new FallbackChain([]);
    chain._failures.set("test", Date.now());
    chain.resetFailures();
    expect(chain._failures.size).toBe(0);
  });
});
