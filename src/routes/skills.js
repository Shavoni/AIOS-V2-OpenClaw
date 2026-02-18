const router = require("express").Router();
const skillEngine = require("../services/skill-engine");
const metricsService = require("../services/metrics-service");

router.get("/", async (_req, res, next) => {
  try {
    if (!skillEngine.loaded) {
      await skillEngine.loadSkills();
    }
    res.json(skillEngine.listSkills());
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!skillEngine.loaded) {
      await skillEngine.loadSkills();
    }
    const skill = skillEngine.getSkill(req.params.id);
    res.json(skill);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/execute", async (req, res, next) => {
  try {
    if (!skillEngine.loaded) {
      await skillEngine.loadSkills();
    }
    const { command, args } = req.body;
    const result = await skillEngine.executeSkill(req.params.id, command, args);

    metricsService.addActivity("skill", `Executed ${req.params.id}: ${command}`, {
      skill: req.params.id,
      command,
      success: result.success,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
