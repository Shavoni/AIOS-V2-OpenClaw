/**
 * Socket.io authentication middleware.
 *
 * Uses the same AuthService as the HTTP auth middleware, verifying JWT tokens
 * passed via socket.handshake.auth.token.
 *
 * In dev mode (authEnabled === false), connections are auto-granted admin access.
 */

function createSocketAuthMiddleware(authService) {
  return (socket, next) => {
    // Dev mode bypass — mirrors HTTP auth middleware behaviour
    if (!authService.authEnabled) {
      socket.data.user = { id: "dev", username: "dev", role: "admin" };
      return next();
    }

    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Authentication required"));
    }

    const result = authService.verifyAccessToken(token);
    if (!result.valid) {
      return next(new Error("Invalid or expired token"));
    }

    socket.data.user = result.user;
    next();
  };
}

module.exports = { createSocketAuthMiddleware };
