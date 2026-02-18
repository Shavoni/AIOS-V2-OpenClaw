/**
 * AIOS V2 - Connector Service
 * CRUD + approval lifecycle for third-party integration connectors.
 */

const { v4: uuidv4 } = require("uuid");

const ALLOWED_UPDATE_COLUMNS = new Set([
  "name",
  "type",
  "config",
  "description",
  "auth_type",
  "auth_config",
  "agent_id",
  "status",
]);

class ConnectorService {
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn || (() => {});
  }

  createConnector(config) {
    const id = config.id || uuidv4();
    const now = new Date().toISOString();

    this.db.run(
      `INSERT INTO connectors
       (id, name, type, config, status, agent_id, description,
        auth_type, auth_config, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        config.name || "Unnamed Connector",
        config.type || "webhook",
        JSON.stringify(config.config || {}),
        "pending",
        config.agent_id || null,
        config.description || "",
        config.auth_type || "none",
        JSON.stringify(config.auth_config || {}),
        config.created_by || null,
        now,
        now,
      ]
    );
    this.saveFn();
    return this.getConnector(id);
  }

  getConnector(id) {
    const stmt = this.db.prepare("SELECT * FROM connectors WHERE id = ?");
    stmt.bind([id]);
    let connector = null;
    if (stmt.step()) {
      connector = stmt.getAsObject();
      connector.config = JSON.parse(connector.config || "{}");
      connector.auth_config = JSON.parse(connector.auth_config || "{}");
    }
    stmt.free();
    return connector;
  }

  listConnectors(filters = {}) {
    let sql = "SELECT * FROM connectors";
    const conditions = [];
    const params = [];

    if (filters.status) {
      conditions.push("status = ?");
      params.push(filters.status);
    }
    if (filters.type) {
      conditions.push("type = ?");
      params.push(filters.type);
    }
    if (filters.agent_id) {
      conditions.push("agent_id = ?");
      params.push(filters.agent_id);
    }

    if (conditions.length) {
      sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY created_at DESC";

    const stmt = this.db.prepare(sql);
    if (params.length) stmt.bind(params);

    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      row.config = JSON.parse(row.config || "{}");
      row.auth_config = JSON.parse(row.auth_config || "{}");
      results.push(row);
    }
    stmt.free();
    return results;
  }

  updateConnector(id, updates) {
    const connector = this.getConnector(id);
    if (!connector) return null;

    const fields = [];
    const values = [];

    for (const [key, val] of Object.entries(updates)) {
      if (!ALLOWED_UPDATE_COLUMNS.has(key)) continue;
      if (key === "config" || key === "auth_config") {
        fields.push(`${key} = ?`);
        values.push(JSON.stringify(val));
      } else {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }

    if (fields.length === 0) return connector;

    fields.push("updated_at = ?");
    values.push(new Date().toISOString());
    values.push(id);

    this.db.run(`UPDATE connectors SET ${fields.join(", ")} WHERE id = ?`, values);
    this.saveFn();
    return this.getConnector(id);
  }

  deleteConnector(id) {
    this.db.run("DELETE FROM connectors WHERE id = ?", [id]);
    this.saveFn();
  }

  approveConnector(id, approvedBy) {
    const now = new Date().toISOString();
    this.db.run(
      "UPDATE connectors SET status = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ?",
      [approvedBy, now, now, id]
    );
    this.saveFn();
    this.logEvent(id, "approved", { approved_by: approvedBy });
    return this.getConnector(id);
  }

  suspendConnector(id) {
    const now = new Date().toISOString();
    this.db.run(
      "UPDATE connectors SET status = 'suspended', updated_at = ? WHERE id = ?",
      [now, id]
    );
    this.saveFn();
    this.logEvent(id, "suspended", {});
    return this.getConnector(id);
  }

  updateHealth(id, status) {
    const now = new Date().toISOString();
    this.db.run(
      "UPDATE connectors SET health_status = ?, last_health_check = ?, updated_at = ? WHERE id = ?",
      [status, now, now, id]
    );
    this.saveFn();
    return this.getConnector(id);
  }

  logEvent(connectorId, eventType, details = {}) {
    this.db.run(
      "INSERT INTO connector_events (connector_id, event_type, details) VALUES (?, ?, ?)",
      [connectorId, eventType, JSON.stringify(details)]
    );
    this.saveFn();
  }

  getEvents(connectorId, limit = 50) {
    const stmt = this.db.prepare(
      "SELECT * FROM connector_events WHERE connector_id = ? ORDER BY created_at DESC LIMIT ?"
    );
    stmt.bind([connectorId, limit]);

    const results = [];
    while (stmt.step()) {
      const row = stmt.getAsObject();
      row.details = JSON.parse(row.details || "{}");
      results.push(row);
    }
    stmt.free();
    return results;
  }

  getByAgent(agentId) {
    return this.listConnectors({ agent_id: agentId });
  }
}

module.exports = { ConnectorService };
