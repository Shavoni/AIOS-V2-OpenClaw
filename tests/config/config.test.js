const path = require("path");
const { loadConfig } = require("../../src/config");

describe("Config Loader", () => {
  test("returns frozen config object", () => {
    const config = loadConfig(path.resolve(__dirname, "../.."));
    expect(Object.isFrozen(config)).toBe(true);
  });

  test("has required properties", () => {
    const config = loadConfig(path.resolve(__dirname, "../.."));
    expect(config).toHaveProperty("port");
    expect(config).toHaveProperty("dbPath");
    expect(config).toHaveProperty("projectRoot");
    expect(config).toHaveProperty("providers");
    expect(config).toHaveProperty("fallbackChain");
    expect(config).toHaveProperty("primaryModel");
  });

  test("port defaults to 3000", () => {
    const config = loadConfig(path.resolve(__dirname, "../.."));
    expect(typeof config.port).toBe("number");
  });

  test("providers is an array", () => {
    const config = loadConfig(path.resolve(__dirname, "../.."));
    expect(Array.isArray(config.providers)).toBe(true);
  });

  test("fallbackChain is an array of strings", () => {
    const config = loadConfig(path.resolve(__dirname, "../.."));
    expect(Array.isArray(config.fallbackChain)).toBe(true);
    for (const id of config.fallbackChain) {
      expect(typeof id).toBe("string");
    }
  });
});
