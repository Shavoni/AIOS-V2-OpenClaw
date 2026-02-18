const express = require("express");
const { validate, schemas } = require("../middleware/validation");
const { authLimiter } = require("../middleware/rate-limit");
const { asyncHandler } = require("../middleware/async-handler");

function createAuthRoutes(authService, authMiddleware) {
  const router = express.Router();
  const { authRequired } = authMiddleware;

  router.post("/register", authLimiter, validate(schemas.register), asyncHandler(async (req, res) => {
    const { username, password, email, displayName, department } = req.body;
    const user = await authService.register(username, password, {
      email, displayName, department,
    });
    res.status(201).json(user);
  }));

  router.post("/login", authLimiter, validate(schemas.login), asyncHandler(async (req, res) => {
    const { username, password, apiKey } = req.body;

    // Legacy API key login
    if (apiKey && !username) {
      if (!authService.authEnabled) {
        const session = authService.createSession("admin");
        return res.json({ success: true, role: "admin", ...session });
      }
      const result = authService.validateApiKey(apiKey);
      if (!result.valid) return res.status(401).json({ error: "Invalid API key" });
      const session = authService.createSession(result.role);
      return res.json({ success: true, role: result.role, ...session });
    }

    const result = await authService.login(username, password);
    res.json(result);
  }));

  router.post("/refresh", authLimiter, asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const result = await authService.refreshAccessToken(refreshToken);
    res.json(result);
  }));

  router.post("/logout", (req, res) => {
    const sessionId = req.cookies?.["aios-session"];
    if (sessionId) authService.destroySession(sessionId);
    res.clearCookie("aios-session");
    res.json({ success: true });
  });

  router.get("/status", (req, res) => {
    if (!authService.authEnabled) {
      return res.json({ authenticated: true, role: "admin", authRequired: false });
    }

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const result = authService.verifyAccessToken(authHeader.slice(7));
      if (result.valid) {
        return res.json({ authenticated: true, user: result.user, authRequired: true });
      }
    }

    const sessionId = req.cookies?.["aios-session"];
    if (sessionId) {
      const result = authService.validateSession(sessionId);
      if (result.valid) {
        return res.json({ authenticated: true, role: result.role, authRequired: true });
      }
    }

    res.json({ authenticated: false, authRequired: true });
  });

  router.get("/users", authRequired("admin"), asyncHandler((_req, res) => {
    res.json(authService.listUsers());
  }));

  router.put("/users/:id", authRequired("admin"), asyncHandler((req, res) => {
    authService.updateUser(req.params.id, req.body);
    res.json({ ok: true });
  }));

  router.post("/users/:id/change-password", authRequired("viewer"), asyncHandler(async (req, res) => {
    const targetId = req.params.id;
    if (req.user.role !== "admin" && req.user.sub !== targetId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await authService.changePassword(targetId, req.body.password);
    res.json({ ok: true });
  }));

  router.delete("/users/:id", authRequired("admin"), asyncHandler((req, res) => {
    authService.deleteUser(req.params.id);
    res.json({ ok: true });
  }));

  return router;
}

module.exports = { createAuthRoutes };
