/**
 * TDD RED → GREEN: Route Protection Tests
 * Verifies that authRequired middleware blocks unauthenticated requests
 * and enforces role-based access control.
 */

const express = require("express");
const request = require("supertest");
const { createAuthMiddleware } = require("../../src/middleware/auth-middleware");

function createTestApp(authService, requiredRole = "viewer") {
  const app = express();
  app.use(express.json());
  const { authRequired } = createAuthMiddleware(authService);

  app.get("/protected", authRequired(requiredRole), (req, res) => {
    res.json({ ok: true, user: req.user });
  });
  app.post("/protected", authRequired(requiredRole), (req, res) => {
    res.json({ ok: true });
  });

  return app;
}

describe("Route Protection - authRequired middleware", () => {
  // Auth-enabled mock (simulates production with users)
  const enabledAuthService = {
    authEnabled: true,
    verifyAccessToken: jest.fn(),
    validateApiKey: jest.fn(() => ({ valid: false })),
    validateSession: jest.fn(() => ({ valid: false })),
    hasPermission(role, required) {
      const ROLES = { admin: 3, operator: 2, viewer: 1 };
      return (ROLES[role] || 0) >= (ROLES[required] || 0);
    },
  };

  // Dev mode mock (no auth configured)
  const devAuthService = {
    authEnabled: false,
    verifyAccessToken: jest.fn(),
    validateApiKey: jest.fn(() => ({ valid: false })),
    validateSession: jest.fn(() => ({ valid: false })),
    hasPermission(role, required) {
      const ROLES = { admin: 3, operator: 2, viewer: 1 };
      return (ROLES[role] || 0) >= (ROLES[required] || 0);
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Auth Enabled: Unauthenticated Requests ---

  it("rejects GET without any auth credentials (401)", async () => {
    const app = createTestApp(enabledAuthService);
    const res = await request(app).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/[Aa]uthentication/);
  });

  it("rejects POST without any auth credentials (401)", async () => {
    const app = createTestApp(enabledAuthService);
    const res = await request(app).post("/protected").send({ data: "test" });
    expect(res.status).toBe(401);
  });

  // --- Auth Enabled: Valid JWT ---

  it("allows request with valid Bearer token", async () => {
    enabledAuthService.verifyAccessToken.mockReturnValue({
      valid: true,
      user: { id: "u1", username: "alice", role: "admin" },
    });

    const app = createTestApp(enabledAuthService);
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer valid-token-123");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it("rejects request with invalid Bearer token (401)", async () => {
    enabledAuthService.verifyAccessToken.mockReturnValue({ valid: false });

    const app = createTestApp(enabledAuthService);
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer bad-token");
    expect(res.status).toBe(401);
  });

  // --- Auth Enabled: Role Enforcement ---

  it("rejects viewer trying to access admin-required route (401)", async () => {
    enabledAuthService.verifyAccessToken.mockReturnValue({
      valid: true,
      user: { id: "u2", username: "bob", role: "viewer" },
    });

    const app = createTestApp(enabledAuthService, "admin");
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer viewer-token");
    expect(res.status).toBe(401);
  });

  it("allows admin accessing admin-required route", async () => {
    enabledAuthService.verifyAccessToken.mockReturnValue({
      valid: true,
      user: { id: "u1", username: "alice", role: "admin" },
    });

    const app = createTestApp(enabledAuthService, "admin");
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer admin-token");
    expect(res.status).toBe(200);
  });

  it("allows operator accessing operator-required route", async () => {
    enabledAuthService.verifyAccessToken.mockReturnValue({
      valid: true,
      user: { id: "u3", username: "charlie", role: "operator" },
    });

    const app = createTestApp(enabledAuthService, "operator");
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer operator-token");
    expect(res.status).toBe(200);
  });

  it("rejects viewer trying to access operator-required route (401)", async () => {
    enabledAuthService.verifyAccessToken.mockReturnValue({
      valid: true,
      user: { id: "u2", username: "bob", role: "viewer" },
    });

    const app = createTestApp(enabledAuthService, "operator");
    const res = await request(app)
      .get("/protected")
      .set("Authorization", "Bearer viewer-token");
    expect(res.status).toBe(401);
  });

  // --- Auth Enabled: API Key ---

  it("allows request with valid API key", async () => {
    enabledAuthService.verifyAccessToken.mockReturnValue({ valid: false });
    enabledAuthService.validateApiKey.mockReturnValue({ valid: true, role: "admin" });

    const app = createTestApp(enabledAuthService);
    const res = await request(app)
      .get("/protected")
      .set("X-Api-Key", "valid-api-key");
    expect(res.status).toBe(200);
  });

  // --- Dev Mode: All requests pass ---

  it("allows unauthenticated request in dev mode (auto-grants admin)", async () => {
    const app = createTestApp(devAuthService, "admin");
    const res = await request(app).get("/protected");
    expect(res.status).toBe(200);
  });

  it("dev mode grants admin role even for admin-required routes", async () => {
    const app = createTestApp(devAuthService, "admin");
    const res = await request(app).post("/protected").send({});
    expect(res.status).toBe(200);
  });
});
