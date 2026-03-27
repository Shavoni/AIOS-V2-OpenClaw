/**
 * Brain Fuel API Routes
 * Endpoints for meal photo analysis, meal CRUD, daily summaries, and nutrition goals.
 */

const express = require('express');
const { asyncHandler } = require('../middleware/async-handler');

/**
 * @param {import('./service').BrainFuelService} brainFuelService
 * @returns {express.Router}
 */
function createBrainFuelRoutes(brainFuelService) {
  const router = express.Router();

  // ─── AI Analysis ────────────────────────────────────────

  /**
   * POST /api/brainfuel/analyze/photo
   * Analyze a meal photo using AI Vision
   * Body: { image: base64string, mimeType: "image/jpeg" }
   */
  router.post('/analyze/photo', asyncHandler(async (req, res) => {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data (base64) is required' });
    }

    // Validate image size (max ~8MB base64 ≈ ~6MB raw)
    const sizeBytes = Buffer.byteLength(image, 'base64');
    if (sizeBytes > 8 * 1024 * 1024) {
      return res.status(400).json({ error: 'Image too large. Maximum size is 8MB.' });
    }

    const result = await brainFuelService.analyzePhoto(image, mimeType || 'image/jpeg');
    res.json(result);
  }));

  /**
   * POST /api/brainfuel/analyze/text
   * Analyze a meal from text description
   * Body: { description: "I had a chicken sandwich with fries" }
   */
  router.post('/analyze/text', asyncHandler(async (req, res) => {
    const { description } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'Meal description is required' });
    }

    const result = await brainFuelService.analyzeText(description.trim());
    res.json(result);
  }));

  // ─── Meal CRUD ──────────────────────────────────────────

  /**
   * POST /api/brainfuel/meals
   * Save a meal with items
   * Body: { date, mealType, summary, healthScore, suggestions, items[], imageData?, analysisRaw? }
   */
  router.post('/meals', asyncHandler(async (req, res) => {
    const { date, mealType, summary, healthScore, suggestions, items, imageData, analysisRaw } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one meal item is required' });
    }

    const userId = req.user?.id || req.user?.username || 'dev';
    const result = brainFuelService.saveMeal({
      userId, date, mealType, summary, healthScore, suggestions, items, imageData, analysisRaw,
    });
    res.json({ ok: true, meal: result });
  }));

  /**
   * GET /api/brainfuel/meals?date=YYYY-MM-DD
   * Get all meals for a date
   */
  router.get('/meals', asyncHandler(async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const userId = req.user?.id || req.user?.username || 'dev';
    const meals = brainFuelService.getMealsByDate(date, userId);
    res.json(meals);
  }));

  /**
   * GET /api/brainfuel/meals/:id
   * Get a single meal with items
   */
  router.get('/meals/:id', asyncHandler(async (req, res) => {
    const meal = brainFuelService.getMeal(req.params.id);
    if (!meal) return res.status(404).json({ error: 'Meal not found' });
    res.json(meal);
  }));

  /**
   * DELETE /api/brainfuel/meals/:id
   * Delete a meal
   */
  router.delete('/meals/:id', asyncHandler(async (req, res) => {
    brainFuelService.deleteMeal(req.params.id);
    res.json({ ok: true });
  }));

  /**
   * PUT /api/brainfuel/meals/items/:id
   * Update a meal item
   */
  router.put('/meals/items/:id', asyncHandler(async (req, res) => {
    const result = brainFuelService.updateMealItem(req.params.id, req.body);
    if (!result) return res.status(400).json({ error: 'No valid fields to update' });
    res.json(result);
  }));

  /**
   * DELETE /api/brainfuel/meals/items/:id
   * Delete a meal item
   */
  router.delete('/meals/items/:id', asyncHandler(async (req, res) => {
    brainFuelService.deleteMealItem(req.params.id);
    res.json({ ok: true });
  }));

  // ─── Daily Summary & History ────────────────────────────

  /**
   * GET /api/brainfuel/summary?date=YYYY-MM-DD
   * Get daily nutrition summary
   */
  router.get('/summary', asyncHandler(async (req, res) => {
    const date = req.query.date || new Date().toISOString().split('T')[0];
    const userId = req.user?.id || req.user?.username || 'dev';
    const summary = brainFuelService.getDailySummary(date, userId);
    res.json(summary);
  }));

  /**
   * GET /api/brainfuel/history?start=YYYY-MM-DD&end=YYYY-MM-DD
   * Get nutrition history for a date range
   */
  router.get('/history', asyncHandler(async (req, res) => {
    const end = req.query.end || new Date().toISOString().split('T')[0];
    const start = req.query.start || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return d.toISOString().split('T')[0];
    })();
    const userId = req.user?.id || req.user?.username || 'dev';
    const history = brainFuelService.getHistory(start, end, userId);
    res.json(history);
  }));

  // ─── Goals ──────────────────────────────────────────────

  /**
   * GET /api/brainfuel/goals
   * Get nutrition goals
   */
  router.get('/goals', asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.user?.username || 'dev';
    const goals = brainFuelService.getGoals(userId);
    res.json(goals);
  }));

  /**
   * PUT /api/brainfuel/goals
   * Save nutrition goals
   * Body: { calories, protein_g, carbs_g, fat_g }
   */
  router.put('/goals', asyncHandler(async (req, res) => {
    const userId = req.user?.id || req.user?.username || 'dev';
    const result = brainFuelService.saveGoals(req.body, userId);
    res.json(result);
  }));

  return router;
}

module.exports = { createBrainFuelRoutes };
