/**
 * Auth middleware supporting 3 methods (checked in order):
 * 1. JWT Bearer token (Authorization: Bearer <token>)
 * 2. API key header (X-Api-Key: <key>)
 * 3. Session cookie (aios-session)
 *
 * If none configured (dev mode), all requests get admin access.
 */

function createAuthMiddleware(authService) {
  function authRequired(requiredRole = "viewer") {
    return (req, res, next) => {
      // Dev mode: no keys configured AND no users in DB → auto-admin
      if (!authService.authEnabled) {
        req.user = { id: "dev", username: "dev", role: "admin" };
        return next();
      }

      // 1. JWT Bearer token
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const result = authService.verifyAccessToken(token);
        if (result.valid && authService.hasPermission(result.user.role, requiredRole)) {
          req.user = result.user;
          return next();
        }
      }

      // 2. API key
      const apiKey = req.headers["x-api-key"];
      if (apiKey) {
        const result = authService.validateApiKey(apiKey);
        if (result.valid && authService.hasPermission(result.role, requiredRole)) {
          req.user = { id: "apikey", username: "apikey", role: result.role };
          return next();
        }
      }

      // 3. Session cookie
      const sessionId = req.cookies?.["aios-session"];
      if (sessionId) {
        const result = authService.validateSession(sessionId);
        if (result.valid && authService.hasPermission(result.role, requiredRole)) {
          req.user = { id: "session", username: "session", role: result.role };
          return next();
        }
      }

      res.status(401).json({ error: "Authentication required" });
    };
  }

  function authOptional() {
    return (req, _res, next) => {
      req.user = { id: "anon", username: "anonymous", role: "viewer" };

      if (!authService.authEnabled) {
        req.user = { id: "dev", username: "dev", role: "admin" };
        return next();
      }

      // Try JWT
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const result = authService.verifyAccessToken(token);
        if (result.valid) {
          req.user = result.user;
          return next();
        }
      }

      // Try API key
      const apiKey = req.headers["x-api-key"];
      if (apiKey) {
        const result = authService.validateApiKey(apiKey);
        if (result.valid) {
          req.user = { id: "apikey", username: "apikey", role: result.role };
          return next();
        }
      }

      // Try session
      const sessionId = req.cookies?.["aios-session"];
      if (sessionId) {
        const result = authService.validateSession(sessionId);
        if (result.valid) {
          req.user = { id: "session", username: "session", role: result.role };
          return next();
        }
      }

      next();
    };
  }

  return { authRequired, authOptional };
}

module.exports = { createAuthMiddleware };
