const router = require("express").Router();
const memoryService = require("../services/memory-service");

router.get("/", async (_req, res, next) => {
  try {
    const files = await memoryService.listFiles();
    res.json(files);
  } catch (err) {
    next(err);
  }
});

router.get("/search", async (req, res, next) => {
  try {
    const results = await memoryService.searchMemory(req.query.q);
    res.json(results);
  } catch (err) {
    next(err);
  }
});

router.get("/:file", async (req, res, next) => {
  try {
    const data = await memoryService.readFile(req.params.file);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { filename, content, mode } = req.body;
    if (!filename || !content) {
      return res.status(400).json({ error: "filename and content required" });
    }
    const result = await memoryService.writeMemory(filename, content, mode);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
