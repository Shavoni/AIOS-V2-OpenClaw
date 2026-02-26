/**
 * Template Routes — REST API for browsing governance templates.
 */

const { Router } = require("express");

function createTemplateRoutes(templateRegistry) {
  const router = Router();

  // GET /api/templates — list all templates with optional filters
  router.get("/", (req, res) => {
    try {
      const { sector, size, q } = req.query;

      if (q) {
        const results = templateRegistry.searchTemplates(q);
        return res.json({
          query: q,
          count: results.length,
          templates: results.map(summarize),
        });
      }

      const results = templateRegistry.listTemplates({ sector, size });
      res.json({
        count: results.length,
        templates: results.map(summarize),
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/templates/sectors — list all sectors with counts
  router.get("/sectors", (_req, res) => {
    try {
      res.json(templateRegistry.listSectors());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/templates/summary — high-level stats
  router.get("/summary", (_req, res) => {
    try {
      res.json(templateRegistry.getSummary());
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /api/templates/:id — full template with governance config
  router.get("/:id", (req, res) => {
    try {
      const template = templateRegistry.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

/** Return a summary with enough data for template cards and fallback governance preview. */
function summarize(t) {
  return {
    id: t.id,
    name: t.name,
    sector: t.sector,
    size: t.size,
    description: t.description,
    departments: t.departments,
    governance: t.governance,
    departmentCount: t.departments.length,
  };
}

module.exports = { createTemplateRoutes };
