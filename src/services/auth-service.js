const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

const ROLES = { admin: 3, operator: 2, viewer: 1 };
const BCRYPT_ROUNDS = 10;

class AuthService {
  constructor(db, saveFn, options = {}) {
    this.db = db;
    this.saveFn = saveFn || (() => {});
    this.jwtSecret = options.jwtSecret || process.env.JWT_SECRET || crypto.randomBytes(64).toString("hex");
    this.accessTokenTtl = options.accessTokenTtl || "1h";
    this.refreshTokenTtl = options.refreshTokenTtlMs || 7 * 24 * 60 * 60 * 1000; // 7 days

    // Legacy API key support
    this.apiKeys = new Set(options.apiKeys || []);

    // In-memory sessions (for backwards compat with cookie-based flow)
    this.sessions = new Map();
    this.sessionTtl = options.sessionTtlMs || 24 * 60 * 60 * 1000;
    this._cleanupInterval = setInterval(() => this.cleanupSessions(), 600_000);
  }

  get authEnabled() {
    return this.apiKeys.size > 0 || this._hasUsers();
  }

  _hasUsers() {
    if (!this.db) return false;
    try {
      const result = this.db.exec("SELECT COUNT(*) FROM users");
      return result.length > 0 && result[0].values[0][0] > 0;
    } catch {
      return false;
    }
  }

  // ─── User Management ──────────────────────────────────────

  async register(username, password, options = {}) {
    if (!username || !password) {
      throw new Error("Username and password required");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 6 characters");
    }

    // Check for existing user
    const stmt = this.db.prepare("SELECT id FROM users WHERE username = ?");
    stmt.bind([username]);
    if (stmt.step()) {
      stmt.free();
      throw new Error("Username already exists");
    }
    stmt.free();

    if (options.email) {
      const emailStmt = this.db.prepare("SELECT id FROM users WHERE email = ?");
      emailStmt.bind([options.email]);
      if (emailStmt.step()) {
        emailStmt.free();
        throw new Error("Email already in use");
      }
      emailStmt.free();
    }

    const id = uuidv4();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    // First user becomes admin
    const isFirst = !this._hasUsers();
    const role = options.role || (isFirst ? "admin" : "viewer");

    this.db.run(
      `INSERT INTO users (id, username, email, password_hash, role, display_name, department)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        username,
        options.email || null,
        passwordHash,
        role,
        options.displayName || username,
        options.department || "",
      ]
    );
    this.saveFn();

    return { id, username, role, email: options.email || null };
  }

  async login(username, password) {
    if (!username || !password) {
      throw new Error("Username and password required");
    }

    const stmt = this.db.prepare(
      "SELECT id, username, email, password_hash, role, is_active FROM users WHERE username = ?"
    );
    stmt.bind([username]);
    if (!stmt.step()) {
      stmt.free();
      throw new Error("Invalid credentials");
    }

    const user = stmt.getAsObject();
    stmt.free();

    if (!user.is_active) {
      throw new Error("Account is disabled");
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new Error("Invalid credentials");
    }

    // Update last login
    this.db.run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id]);
    this.saveFn();

    // Generate tokens
    const accessToken = this._generateAccessToken(user);
    const refreshToken = await this._generateRefreshToken(user.id);

    return {
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      accessToken,
      refreshToken,
    };
  }

  async refreshAccessToken(refreshToken) {
    if (!refreshToken) throw new Error("Refresh token required");

    const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    const stmt = this.db.prepare(
      "SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?"
    );
    stmt.bind([tokenHash]);
    if (!stmt.step()) {
      stmt.free();
      throw new Error("Invalid refresh token");
    }

    const record = stmt.getAsObject();
    stmt.free();

    if (new Date(record.expires_at) < new Date()) {
      this.db.run("DELETE FROM refresh_tokens WHERE id = ?", [record.id]);
      this.saveFn();
      throw new Error("Refresh token expired");
    }

    // Look up the user
    const userStmt = this.db.prepare(
      "SELECT id, username, email, role, is_active FROM users WHERE id = ?"
    );
    userStmt.bind([record.user_id]);
    if (!userStmt.step()) {
      userStmt.free();
      throw new Error("User not found");
    }

    const user = userStmt.getAsObject();
    userStmt.free();

    if (!user.is_active) throw new Error("Account is disabled");

    // Rotate refresh token
    this.db.run("DELETE FROM refresh_tokens WHERE id = ?", [record.id]);
    const newAccessToken = this._generateAccessToken(user);
    const newRefreshToken = await this._generateRefreshToken(user.id);
    this.saveFn();

    return {
      user: { id: user.id, username: user.username, email: user.email, role: user.role },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return { valid: true, user: decoded };
    } catch {
      return { valid: false };
    }
  }

  listUsers() {
    if (!this.db) return [];
    const results = this.db.exec(
      "SELECT id, username, email, role, display_name, department, is_active, last_login, created_at FROM users ORDER BY created_at"
    );
    if (!results.length) return [];
    return results[0].values.map((row) => {
      const obj = {};
      results[0].columns.forEach((c, i) => { obj[c] = row[i]; });
      return obj;
    });
  }

  updateUser(id, updates) {
    const allowed = ["email", "role", "display_name", "department", "is_active"];
    const sets = [];
    const values = [];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        sets.push(`${key} = ?`);
        values.push(updates[key]);
      }
    }
    if (sets.length === 0) return;
    sets.push("updated_at = datetime('now')");
    values.push(id);
    this.db.run(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, values);
    this.saveFn();
  }

  async changePassword(userId, newPassword) {
    if (!newPassword || newPassword.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    this.db.run("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?", [hash, userId]);
    // Invalidate all refresh tokens for this user
    this.db.run("DELETE FROM refresh_tokens WHERE user_id = ?", [userId]);
    this.saveFn();
  }

  deleteUser(id) {
    this.db.run("DELETE FROM users WHERE id = ?", [id]);
    this.saveFn();
  }

  // ─── Token Helpers ─────────────────────────────────────────

  _generateAccessToken(user) {
    return jwt.sign(
      { sub: user.id, username: user.username, role: user.role },
      this.jwtSecret,
      { expiresIn: this.accessTokenTtl }
    );
  }

  async _generateRefreshToken(userId) {
    const token = crypto.randomBytes(48).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const expiresAt = new Date(Date.now() + this.refreshTokenTtl).toISOString();
    const id = uuidv4();

    this.db.run(
      "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
      [id, userId, tokenHash, expiresAt]
    );

    // Limit to 5 refresh tokens per user
    this.db.run(
      `DELETE FROM refresh_tokens WHERE user_id = ? AND id NOT IN (
        SELECT id FROM refresh_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
      )`,
      [userId, userId]
    );

    return token;
  }

  // ─── Legacy API Key Support ────────────────────────────────

  validateApiKey(key) {
    if (!key) return { valid: false };
    if (this.apiKeys.has(key)) {
      return { valid: true, role: "admin" };
    }
    return { valid: false };
  }

  // ─── Legacy Session Support ────────────────────────────────

  createSession(role = "admin") {
    const sessionId = crypto.randomUUID();
    const now = Date.now();
    this.sessions.set(sessionId, { role, createdAt: now, lastActive: now });
    return {
      sessionId,
      expiresAt: new Date(now + this.sessionTtl).toISOString(),
    };
  }

  validateSession(sessionId) {
    if (!sessionId) return { valid: false };
    const session = this.sessions.get(sessionId);
    if (!session) return { valid: false };
    if (Date.now() - session.createdAt > this.sessionTtl) {
      this.sessions.delete(sessionId);
      return { valid: false };
    }
    session.lastActive = Date.now();
    return { valid: true, role: session.role };
  }

  destroySession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  hasPermission(role, requiredRole) {
    return (ROLES[role] || 0) >= (ROLES[requiredRole] || 0);
  }

  cleanupSessions() {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.createdAt > this.sessionTtl) {
        this.sessions.delete(id);
      }
    }
  }

  destroy() {
    clearInterval(this._cleanupInterval);
  }
}

module.exports = { AuthService, ROLES };
