const { ModelRouter, PROFILE_MODEL_MAP } = require("../../src/router");

describe("ModelRouter", () => {
  test("PROFILE_MODEL_MAP has expected profiles", () => {
    expect(PROFILE_MODEL_MAP.main).toBeTruthy();
    expect(PROFILE_MODEL_MAP.reasoning).toBeTruthy();
    expect(PROFILE_MODEL_MAP.coding).toBeTruthy();
    expect(PROFILE_MODEL_MAP.research).toBeTruthy();
    expect(PROFILE_MODEL_MAP.local).toBeTruthy();
  });

  test("creates with empty providers", () => {
    const router = new ModelRouter([]);
    expect(router.clients.size).toBe(0);
    expect(router.getProviderStatus()).toHaveLength(0);
  });

  test("creates clients for enabled providers", () => {
    const router = new ModelRouter([
      { id: "test", baseUrl: "http://localhost:1234/v1", apiKey: "k", defaultModel: "m", models: ["m"], enabled: true },
    ]);
    expect(router.clients.size).toBe(1);
  });

  test("skips disabled providers", () => {
    const router = new ModelRouter([
      { id: "disabled", baseUrl: "http://x/v1", apiKey: "k", defaultModel: "m", models: [], enabled: false },
    ]);
    expect(router.clients.size).toBe(0);
  });

  test("getProviderStatus returns status array", () => {
    const router = new ModelRouter([
      { id: "p1", baseUrl: "http://x/v1", apiKey: "k", defaultModel: "m1", models: ["m1"] },
    ]);
    const status = router.getProviderStatus();
    expect(status).toHaveLength(1);
    expect(status[0].id).toBe("p1");
    expect(status[0]).toHaveProperty("healthy");
    expect(status[0].models).toEqual(["m1"]);
  });
});
