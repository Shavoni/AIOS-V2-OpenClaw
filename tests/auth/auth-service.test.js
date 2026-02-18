const { AuthService } = require("../../src/services/auth-service");

describe("AuthService", () => {
  let db, authService;

  beforeAll(async () => {
    const initSqlJs = require("sql.js");
    const SQL = await initSqlJs();
    db = new SQL.Database();
    db.run("PRAGMA foreign_keys = ON");

    const { initSchema } = require("../../src/db/schema");
    initSchema(db);

    authService = new AuthService(db, () => {}, {
      jwtSecret: "test-secret-key-for-tests",
      accessTokenTtl: "1h",
    });
  });

  afterAll(() => {
    authService.destroy();
    if (db) db.close();
  });

  describe("registration", () => {
    test("registers the first user as admin", async () => {
      const user = await authService.register("admin_user", "password123", {
        email: "admin@test.com",
        displayName: "Admin",
      });
      expect(user.id).toBeTruthy();
      expect(user.username).toBe("admin_user");
      expect(user.role).toBe("admin");
    });

    test("registers subsequent users as viewer", async () => {
      const user = await authService.register("regular_user", "password123");
      expect(user.role).toBe("viewer");
    });

    test("rejects duplicate username", async () => {
      await expect(
        authService.register("admin_user", "password123")
      ).rejects.toThrow("Username already exists");
    });

    test("rejects duplicate email", async () => {
      await expect(
        authService.register("new_user", "password123", { email: "admin@test.com" })
      ).rejects.toThrow("Email already in use");
    });

    test("rejects short passwords", async () => {
      await expect(
        authService.register("short_pw", "12345")
      ).rejects.toThrow("at least 6");
    });

    test("rejects empty username", async () => {
      await expect(
        authService.register("", "password123")
      ).rejects.toThrow("Username and password required");
    });
  });

  describe("login", () => {
    test("logs in with valid credentials", async () => {
      const result = await authService.login("admin_user", "password123");
      expect(result.user.username).toBe("admin_user");
      expect(result.user.role).toBe("admin");
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });

    test("rejects invalid password", async () => {
      await expect(
        authService.login("admin_user", "wrongpassword")
      ).rejects.toThrow("Invalid credentials");
    });

    test("rejects nonexistent user", async () => {
      await expect(
        authService.login("nobody", "password123")
      ).rejects.toThrow("Invalid credentials");
    });
  });

  describe("JWT tokens", () => {
    let tokens;

    beforeAll(async () => {
      tokens = await authService.login("admin_user", "password123");
    });

    test("verifies valid access token", () => {
      const result = authService.verifyAccessToken(tokens.accessToken);
      expect(result.valid).toBe(true);
      expect(result.user.username).toBe("admin_user");
      expect(result.user.role).toBe("admin");
    });

    test("rejects invalid access token", () => {
      const result = authService.verifyAccessToken("invalid-token");
      expect(result.valid).toBe(false);
    });

    test("refreshes access token", async () => {
      const result = await authService.refreshAccessToken(tokens.refreshToken);
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.username).toBe("admin_user");
    });

    test("rejects reused refresh token", async () => {
      // The old refresh token was consumed in the previous test
      await expect(
        authService.refreshAccessToken(tokens.refreshToken)
      ).rejects.toThrow("Invalid refresh token");
    });
  });

  describe("user management", () => {
    test("lists all users", () => {
      const users = authService.listUsers();
      expect(users.length).toBeGreaterThanOrEqual(2);
      const admin = users.find((u) => u.username === "admin_user");
      expect(admin).toBeTruthy();
      expect(admin.role).toBe("admin");
    });

    test("updates user role", () => {
      const users = authService.listUsers();
      const viewer = users.find((u) => u.username === "regular_user");
      authService.updateUser(viewer.id, { role: "operator" });
      const updated = authService.listUsers().find((u) => u.id === viewer.id);
      expect(updated.role).toBe("operator");
    });

    test("changes password", async () => {
      const users = authService.listUsers();
      const viewer = users.find((u) => u.username === "regular_user");
      await authService.changePassword(viewer.id, "newpassword123");
      // Can login with new password
      const result = await authService.login("regular_user", "newpassword123");
      expect(result.user.username).toBe("regular_user");
    });

    test("disables user account", async () => {
      const users = authService.listUsers();
      const viewer = users.find((u) => u.username === "regular_user");
      authService.updateUser(viewer.id, { is_active: 0 });
      await expect(
        authService.login("regular_user", "newpassword123")
      ).rejects.toThrow("Account is disabled");
      // Re-enable for subsequent tests
      authService.updateUser(viewer.id, { is_active: 1 });
    });

    test("deletes user", async () => {
      const tempUser = await authService.register("temp_user", "password123");
      authService.deleteUser(tempUser.id);
      const users = authService.listUsers();
      expect(users.find((u) => u.id === tempUser.id)).toBeUndefined();
    });
  });

  describe("permissions", () => {
    test("admin has all permissions", () => {
      expect(authService.hasPermission("admin", "viewer")).toBe(true);
      expect(authService.hasPermission("admin", "operator")).toBe(true);
      expect(authService.hasPermission("admin", "admin")).toBe(true);
    });

    test("viewer has only viewer permission", () => {
      expect(authService.hasPermission("viewer", "viewer")).toBe(true);
      expect(authService.hasPermission("viewer", "operator")).toBe(false);
      expect(authService.hasPermission("viewer", "admin")).toBe(false);
    });

    test("operator has viewer and operator permission", () => {
      expect(authService.hasPermission("operator", "viewer")).toBe(true);
      expect(authService.hasPermission("operator", "operator")).toBe(true);
      expect(authService.hasPermission("operator", "admin")).toBe(false);
    });
  });

  describe("legacy API key support", () => {
    test("validates configured API keys", () => {
      const svc = new AuthService(db, () => {}, {
        jwtSecret: "test",
        apiKeys: ["test-key-123"],
      });
      expect(svc.validateApiKey("test-key-123").valid).toBe(true);
      expect(svc.validateApiKey("wrong-key").valid).toBe(false);
      svc.destroy();
    });
  });

  describe("legacy session support", () => {
    test("creates and validates sessions", () => {
      const session = authService.createSession("admin");
      expect(session.sessionId).toBeTruthy();
      const result = authService.validateSession(session.sessionId);
      expect(result.valid).toBe(true);
      expect(result.role).toBe("admin");
    });

    test("destroys sessions", () => {
      const session = authService.createSession("admin");
      authService.destroySession(session.sessionId);
      const result = authService.validateSession(session.sessionId);
      expect(result.valid).toBe(false);
    });
  });
});
