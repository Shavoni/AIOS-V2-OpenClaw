/**
 * AIOS V2 - Integration Routes
 * CRUD endpoints for third-party connectors with approval workflow.
 */

const express = require("express");

const SENSITIVE_AUTH_KEYS = new Set([
  "token", "secret", "password", "apiKey", "api_key",
  "client_secret", "refresh_token", "access_token",
]);

function redactAuthConfig(connector) {
  if (!connector || !connector.auth_config) return connector;
  const redacted = { ...connector };
  const authCopy = { ...redacted.auth_config };
  for (const key of Object.keys(authCopy)) {
    if (SENSITIVE_AUTH_KEYS.has(key)) {
      const val = String(authCopy[key]);
      authCopy[key] = val.length > 8
        ? val.slice(0, 4) + "****" + val.slice(-4)
        : "****";
    }
  }
  redacted.auth_config = authCopy;
  return redacted;
}

function createIntegrationRoutes(connectorService) {
  const router = express.Router();

  // List all connectors (supports ?status=, ?type=, ?agent_id= filters)
  router.get("/", (req, res) => {
    try {
      const filters = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.type) filters.type = req.query.type;
      if (req.query.agent_id) filters.agent_id = req.query.agent_id;

      const connectors = connectorService.listConnectors(filters);
      res.json(connectors.map(redactAuthConfig));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Create a new connector
  router.post("/", (req, res) => {
    try {
      const connector = connectorService.createConnector(req.body);
      res.status(201).json(redactAuthConfig(connector));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get a single connector
  router.get("/:id", (req, res) => {
    try {
      const connector = connectorService.getConnector(req.params.id);
      if (!connector) return res.status(404).json({ error: "Connector not found" });
      res.json(redactAuthConfig(connector));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Update a connector
  router.put("/:id", (req, res) => {
    try {
      const updated = connectorService.updateConnector(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Connector not found" });
      res.json(redactAuthConfig(updated));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete a connector
  router.delete("/:id", (req, res) => {
    try {
      connectorService.deleteConnector(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Approve a connector (admin action)
  router.post("/:id/approve", (req, res) => {
    try {
      const approved = connectorService.approveConnector(
        req.params.id,
        req.user?.username || "system"
      );
      if (!approved) return res.status(404).json({ error: "Connector not found" });
      res.json(redactAuthConfig(approved));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Suspend a connector
  router.post("/:id/suspend", (req, res) => {
    try {
      const suspended = connectorService.suspendConnector(req.params.id);
      if (!suspended) return res.status(404).json({ error: "Connector not found" });
      res.json(redactAuthConfig(suspended));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get connector events
  router.get("/:id/events", (req, res) => {
    try {
      const events = connectorService.getEvents(req.params.id);
      res.json(events);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createIntegrationRoutes, redactAuthConfig };
