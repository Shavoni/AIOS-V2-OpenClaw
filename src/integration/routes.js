/**
 * AIOS V2 - Integration Routes
 * CRUD endpoints for third-party connectors with approval workflow.
 */

const express = require("express");

function createIntegrationRoutes(connectorService) {
  const router = express.Router();

  // List all connectors (supports ?status=, ?type=, ?agent_id= filters)
  router.get("/", (req, res) => {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.type) filters.type = req.query.type;
    if (req.query.agent_id) filters.agent_id = req.query.agent_id;

    const connectors = connectorService.listConnectors(filters);
    res.json(connectors);
  });

  // Create a new connector
  router.post("/", (req, res) => {
    const connector = connectorService.createConnector(req.body);
    res.status(201).json(connector);
  });

  // Get a single connector
  router.get("/:id", (req, res) => {
    const connector = connectorService.getConnector(req.params.id);
    if (!connector) return res.status(404).json({ error: "Connector not found" });
    res.json(connector);
  });

  // Update a connector
  router.put("/:id", (req, res) => {
    const updated = connectorService.updateConnector(req.params.id, req.body);
    if (!updated) return res.status(404).json({ error: "Connector not found" });
    res.json(updated);
  });

  // Delete a connector
  router.delete("/:id", (req, res) => {
    connectorService.deleteConnector(req.params.id);
    res.json({ ok: true });
  });

  // Approve a connector (admin action)
  router.post("/:id/approve", (req, res) => {
    const approved = connectorService.approveConnector(
      req.params.id,
      req.user?.username || "system"
    );
    if (!approved) return res.status(404).json({ error: "Connector not found" });
    res.json(approved);
  });

  // Suspend a connector
  router.post("/:id/suspend", (req, res) => {
    const suspended = connectorService.suspendConnector(req.params.id);
    if (!suspended) return res.status(404).json({ error: "Connector not found" });
    res.json(suspended);
  });

  // Get connector events
  router.get("/:id/events", (req, res) => {
    const events = connectorService.getEvents(req.params.id);
    res.json(events);
  });

  return router;
}

module.exports = { createIntegrationRoutes };
