const { createSocketAuthMiddleware } = require("../../src/middleware/socket-auth");

describe("Socket Auth Middleware", () => {
  // --- Helpers to build mocks ---
  function createMockAuthService(overrides = {}) {
    return {
      authEnabled: true,
      verifyAccessToken: jest.fn().mockReturnValue({ valid: false }),
      ...overrides,
    };
  }

  function createMockSocket(token) {
    return {
      handshake: {
        auth: token !== undefined ? { token } : {},
      },
      data: {},
    };
  }

  // --- Test 1: Rejects connection without token when auth is enabled ---
  test("rejects connection without token when auth is enabled", () => {
    const authService = createMockAuthService({ authEnabled: true });
    const middleware = createSocketAuthMiddleware(authService);

    const socket = createMockSocket(); // no token
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Authentication required");
  });

  // --- Test 2: Accepts connection with valid JWT, attaches user to socket.data ---
  test("accepts connection with valid JWT and attaches user to socket.data", () => {
    const validUser = { id: "u1", username: "test", role: "admin" };
    const authService = createMockAuthService({
      authEnabled: true,
      verifyAccessToken: jest.fn().mockReturnValue({ valid: true, user: validUser }),
    });
    const middleware = createSocketAuthMiddleware(authService);

    const socket = createMockSocket("valid-jwt-token");
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error argument
    expect(socket.data.user).toEqual(validUser);
    expect(authService.verifyAccessToken).toHaveBeenCalledWith("valid-jwt-token");
  });

  // --- Test 3: Rejects expired/invalid JWT ---
  test("rejects expired or invalid JWT", () => {
    const authService = createMockAuthService({
      authEnabled: true,
      verifyAccessToken: jest.fn().mockReturnValue({ valid: false }),
    });
    const middleware = createSocketAuthMiddleware(authService);

    const socket = createMockSocket("expired-or-bad-token");
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Invalid or expired token");
    expect(authService.verifyAccessToken).toHaveBeenCalledWith("expired-or-bad-token");
  });

  // --- Test 4: Dev mode (authEnabled=false) allows without token, grants admin ---
  test("dev mode allows connection without token and grants admin", () => {
    const authService = createMockAuthService({ authEnabled: false });
    const middleware = createSocketAuthMiddleware(authService);

    const socket = createMockSocket(); // no token
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no error
    expect(socket.data.user).toEqual({
      id: "dev",
      username: "dev",
      role: "admin",
    });
    // verifyAccessToken should NOT be called in dev mode
    expect(authService.verifyAccessToken).not.toHaveBeenCalled();
  });

  // --- Test 5: Missing token emits "Authentication required" error ---
  test("missing token results in 'Authentication required' error", () => {
    const authService = createMockAuthService({ authEnabled: true });
    const middleware = createSocketAuthMiddleware(authService);

    // Explicitly null token
    const socket = createMockSocket(null);
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Authentication required");
  });

  // --- Test 6: Token provided as empty string is rejected ---
  test("empty string token is rejected as missing", () => {
    const authService = createMockAuthService({ authEnabled: true });
    const middleware = createSocketAuthMiddleware(authService);

    const socket = createMockSocket("");
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Authentication required");
  });

  // --- Test 7: Dev mode with token still grants dev admin (ignores token) ---
  test("dev mode ignores provided token and still grants dev admin", () => {
    const authService = createMockAuthService({ authEnabled: false });
    const middleware = createSocketAuthMiddleware(authService);

    const socket = createMockSocket("some-token");
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(socket.data.user).toEqual({
      id: "dev",
      username: "dev",
      role: "admin",
    });
    expect(authService.verifyAccessToken).not.toHaveBeenCalled();
  });

  // --- Test 8: Handles missing handshake.auth gracefully ---
  test("handles missing handshake.auth object gracefully", () => {
    const authService = createMockAuthService({ authEnabled: true });
    const middleware = createSocketAuthMiddleware(authService);

    const socket = {
      handshake: {}, // no auth property at all
      data: {},
    };
    const next = jest.fn();

    middleware(socket, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Authentication required");
  });
});
