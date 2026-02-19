/**
 * Skills CRUD Routes — REST API for skill management.
 *
 * GET    /             — List all skills
 * GET    /:id          — Get skill detail with readme + scripts
 * POST   /             — Create new skill
 * PUT    /:id          — Update existing skill
 * DELETE /:id          — Delete skill
 * POST   /:id/upload   — Import SKILL.md content
 * POST   /:id/execute  — Execute a skill script
 */

const { Router } = require("express");
const fs = require("fs");
const path = require("path");
const { validate, schemas } = require("../middleware/validation");

function createSkillRoutes(skillEngine, config = {}) {
  const router = Router();

  // GET / — List all skills
  router.get("/", (_req, res) => {
    try {
      const allSkills = skillEngine.getAllSkills().map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        version: s.version,
        tags: s.tags,
        capabilities: s.capabilities,
        hasScripts: s.hasScripts,
      }));
      res.json(allSkills);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // GET /:id — Get single skill detail
  router.get("/:id", (req, res) => {
    try {
      const skill = skillEngine.getSkill(req.params.id);
      if (!skill) return res.status(404).json({ error: "Skill not found" });

      let readme = "";
      const skillDir = path.join(skillEngine.skillsDir, skill.id);
      const skillMdPath = path.join(skillDir, "SKILL.md");
      if (fs.existsSync(skillMdPath)) {
        readme = fs.readFileSync(skillMdPath, "utf-8");
      }

      let scripts = [];
      const scriptsDir = path.join(skillDir, "scripts");
      if (fs.existsSync(scriptsDir)) {
        scripts = fs.readdirSync(scriptsDir).filter((f) => !f.startsWith("."));
      }

      res.json({ ...skill, readme, scripts });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST / — Create new skill
  router.post("/", validate(schemas.createSkill), (req, res) => {
    try {
      const skill = skillEngine.createSkill(req.body);
      res.status(201).json(skill);
    } catch (err) {
      const status = err.message.includes("already exists") ? 409 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  // PUT /:id — Update existing skill
  router.put("/:id", (req, res) => {
    try {
      const updated = skillEngine.updateSkill(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Skill not found" });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE /:id — Delete skill
  router.delete("/:id", (req, res) => {
    try {
      const deleted = skillEngine.deleteSkill(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Skill not found" });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /:id/upload — Import SKILL.md content
  router.post("/:id/upload", (req, res) => {
    try {
      const { content, fileType, filename } = req.body;
      if (!content) return res.status(400).json({ error: "content is required" });
      const type = fileType || (filename && filename.endsWith(".zip") ? "zip" : "md");
      const skill = skillEngine.importSkill(req.params.id, content, type);
      res.status(201).json(skill);
    } catch (err) {
      const status = err.message.includes("already exists") ? 409 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  // POST /:id/execute — Execute a skill script
  router.post("/:id/execute", validate(schemas.executeSkill), async (req, res) => {
    try {
      const { command, args } = req.body;
      if (!command) return res.status(400).json({ error: "command required" });
      const result = await skillEngine.executeScript(req.params.id, command, args);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createSkillRoutes };
