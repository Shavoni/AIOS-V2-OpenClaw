/**
 * Integration Routes — CRUD for third-party connectors.
 * Auth config is redacted at the service layer (ConnectorService.getConnector).
 */

const express = require("express");
const { asyncHandler } = require("../middleware/async-handler");

function createIntegrationRoutes(connectorService) {
  const router = express.Router();

  router.get("/", asyncHandler((req, res) => {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.type) filters.type = req.query.type;
    if (req.query.agent_id) filters.agent_id = req.query.agent_id;
    res.json(connectorService.listConnectors(filters));
  }));

  router.post("/", asyncHandler((req, res) => {
    const { name, type, description, auth_type, auth_config, agent_id } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: "name is required" });
    }
    const connector = connectorService.createConnector({ name, type, description, auth_type, auth_config, agent_id });
    res.status(201).json(connector);
  }));

  router.get("/:id", asyncHandler((req, res) => {
    const connector = connectorService.getConnector(req.params.id);
    if (!connector) return res.status(404).json({ error: "Connector not found" });
    res.json(connector);
  }));

  router.put("/:id", asyncHandler((req, res) => {
    const updated = connectorService.updateConnector(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Connector not found" });
    res.json(updated);
  }));

  router.delete("/:id", asyncHandler((req, res) => {
    connectorService.deleteConnector(req.params.id);
    res.json({ ok: true });
  }));

  router.post("/:id/approve", asyncHandler((req, res) => {
    const approved = connectorService.approveConnector(
      req.params.id,
      req.user?.username || "system"
    );
    if (!approved) return res.status(404).json({ error: "Connector not found" });
    res.json(approved);
  }));

  router.post("/:id/suspend", asyncHandler((req, res) => {
    const suspended = connectorService.suspendConnector(req.params.id);
    if (!suspended) return res.status(404).json({ error: "Connector not found" });
    res.json(suspended);
  }));

  router.get("/:id/events", asyncHandler((req, res) => {
    const events = connectorService.getEvents(req.params.id);
    res.json(events);
  }));

  return router;
}

module.exports = { createIntegrationRoutes };
