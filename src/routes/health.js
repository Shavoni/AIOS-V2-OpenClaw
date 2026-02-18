const router = require("express").Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    name: "AIOS V2",
    version: "0.2.0",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
