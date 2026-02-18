const express = require("express");
const { validate, schemas } = require("../middleware/validation");
const { authLimiter } = require("../middleware/rate-limit");

function createAuthRoutes(authService, authMiddleware) {
  const router = express.Router();
  const { authRequired } = authMiddleware;

  // POST /api/auth/register — Create a new user account
  router.post("/register", authLimiter, validate(schemas.register), async (req, res) => {
    try {
      const { username, password, email, displayName, department } = req.body;
      const user = await authService.register(username, password, {
        email, displayName, department,
      });
      res.status(201).json(user);
    } catch (err) {
      const status = err.message.includes("already") ? 409 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  // POST /api/auth/login — Authenticate and get tokens
  router.post("/login", authLimiter, validate(schemas.login), async (req, res) => {
    try {
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

      // JWT login
      const result = await authService.login(username, password);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  // POST /api/auth/refresh — Refresh access token
  router.post("/refresh", authLimiter, async (req, res) => {
    try {
      const { refreshToken } = req.body;
      const result = await authService.refreshAccessToken(refreshToken);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  // POST /api/auth/logout — Invalidate session
  router.post("/logout", (req, res) => {
    const sessionId = req.cookies?.["aios-session"];
    if (sessionId) authService.destroySession(sessionId);
    res.clearCookie("aios-session");
    res.json({ success: true });
  });

  // GET /api/auth/status — Check authentication status
  router.get("/status", (req, res) => {
    if (!authService.authEnabled) {
      return res.json({ authenticated: true, role: "admin", authRequired: false });
    }

    // Check JWT
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const result = authService.verifyAccessToken(authHeader.slice(7));
      if (result.valid) {
        return res.json({ authenticated: true, user: result.user, authRequired: true });
      }
    }

    // Check session
    const sessionId = req.cookies?.["aios-session"];
    if (sessionId) {
      const result = authService.validateSession(sessionId);
      if (result.valid) {
        return res.json({ authenticated: true, role: result.role, authRequired: true });
      }
    }

    res.json({ authenticated: false, authRequired: true });
  });

  // GET /api/auth/users — List users (admin only)
  router.get("/users", authRequired("admin"), (_req, res) => {
    try {
      res.json(authService.listUsers());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PUT /api/auth/users/:id — Update user (admin only)
  router.put("/users/:id", authRequired("admin"), (req, res) => {
    try {
      authService.updateUser(req.params.id, req.body);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/auth/users/:id/change-password — Change password (admin or self)
  router.post("/users/:id/change-password", authRequired("viewer"), async (req, res) => {
    try {
      const targetId = req.params.id;
      // Only admin or the user themselves can change password
      if (req.user.role !== "admin" && req.user.sub !== targetId) {
        return res.status(403).json({ error: "Forbidden" });
      }
      await authService.changePassword(targetId, req.body.password);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // DELETE /api/auth/users/:id — Delete user (admin only)
  router.delete("/users/:id", authRequired("admin"), (req, res) => {
    try {
      authService.deleteUser(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createAuthRoutes };
