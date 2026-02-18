const { ProviderClient } = require("../../src/router/provider");

describe("ProviderClient", () => {
  test("creates with config", () => {
    const client = new ProviderClient({
      id: "test",
      baseUrl: "http://localhost:1234/v1",
      apiKey: "test-key",
      defaultModel: "test-model",
    });
    expect(client.id).toBe("test");
    expect(client.defaultModel).toBe("test-model");
    expect(client.healthy).toBe(true);
  });

  test("starts healthy", () => {
    const client = new ProviderClient({
      id: "test",
      baseUrl: "http://localhost:9999/v1",
      apiKey: "x",
      defaultModel: "m",
    });
    expect(client.healthy).toBe(true);
    expect(client.lastError).toBeNull();
  });
});
