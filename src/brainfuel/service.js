/**
 * Brain Fuel Service — AI-Powered Meal Analysis & Nutrition Tracking
 * Uses OpenAI Vision API to analyze meal photos and extract nutritional data.
 */

const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

const MEAL_ANALYSIS_PROMPT = `You are a professional nutritionist AI. Analyze this meal photo and identify every food item visible.

For each food item, provide:
- name: The food item name
- portion: Estimated portion size (e.g., "1 cup", "2 slices", "150g")
- calories: Estimated calories (kcal)
- protein_g: Protein in grams
- carbs_g: Carbohydrates in grams
- fat_g: Fat in grams
- fiber_g: Dietary fiber in grams
- sugar_g: Sugar in grams
- portion_notes: Any notes about the portion estimation

Also provide:
- meal_summary: A brief description of the overall meal
- health_score: A score from 1-10 rating the meal's nutritional balance
- suggestions: 1-2 brief suggestions for improving the meal's nutrition

You MUST respond with valid JSON only. No markdown, no explanation outside JSON.

JSON Schema:
{
  "meal_summary": "string",
  "health_score": number,
  "suggestions": ["string"],
  "items": [
    {
      "name": "string",
      "portion": "string",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "sugar_g": number,
      "portion_notes": "string"
    }
  ]
}`;

const TEXT_MEAL_PROMPT = `You are a professional nutritionist AI. The user describes a meal they ate. Parse the description and identify every food item mentioned.

For each food item, provide:
- name: The food item name
- portion: Estimated portion size (e.g., "1 cup", "2 slices", "150g")
- calories: Estimated calories (kcal)
- protein_g: Protein in grams
- carbs_g: Carbohydrates in grams
- fat_g: Fat in grams
- fiber_g: Dietary fiber in grams
- sugar_g: Sugar in grams
- portion_notes: Any notes about the portion estimation

Also provide:
- meal_summary: A brief description of the overall meal
- health_score: A score from 1-10 rating the meal's nutritional balance
- suggestions: 1-2 brief suggestions for improving the meal's nutrition

You MUST respond with valid JSON only. No markdown, no explanation outside JSON.

JSON Schema:
{
  "meal_summary": "string",
  "health_score": number,
  "suggestions": ["string"],
  "items": [
    {
      "name": "string",
      "portion": "string",
      "calories": number,
      "protein_g": number,
      "carbs_g": number,
      "fat_g": number,
      "fiber_g": number,
      "sugar_g": number,
      "portion_notes": "string"
    }
  ]
}

User's meal description:`;

class BrainFuelService {
  /**
   * @param {object} db - sql.js database instance
   * @param {Function} saveFn - markDirty callback
   */
  constructor(db, saveFn) {
    this.db = db;
    this.saveFn = saveFn;

    // Initialize OpenAI client
    this.openai = null;
    try {
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
      }
    } catch (err) {
      console.warn('Brain Fuel: OpenAI client init failed:', err.message);
    }
  }

  // ─── AI Analysis ────────────────────────────────────────

  /**
   * Analyze a meal photo using OpenAI Vision API
   * @param {string} imageBase64 - Base64-encoded image data
   * @param {string} mimeType - Image MIME type (image/jpeg, image/png, image/webp)
   * @returns {Promise<object>} Parsed meal analysis
   */
  async analyzePhoto(imageBase64, mimeType = 'image/jpeg') {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in your environment.');
    }

    const dataUrl = `data:${mimeType};base64,${imageBase64}`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: MEAL_ANALYSIS_PROMPT },
            {
              type: 'image_url',
              image_url: { url: dataUrl, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const raw = response.choices?.[0]?.message?.content || '';
    return this._parseAnalysisResponse(raw);
  }

  /**
   * Analyze a meal from text description using AI
   * @param {string} description - Text description of the meal
   * @returns {Promise<object>} Parsed meal analysis
   */
  async analyzeText(description) {
    if (!this.openai) {
      throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY in your environment.');
    }

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'user',
          content: `${TEXT_MEAL_PROMPT}\n\n${description}`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });

    const raw = response.choices?.[0]?.message?.content || '';
    return this._parseAnalysisResponse(raw);
  }

  /**
   * Parse the AI response JSON, handling markdown code fences
   * @private
   */
  _parseAnalysisResponse(raw) {
    let cleaned = raw.trim();
    // Strip markdown code fences if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
      const parsed = JSON.parse(cleaned);
      // Validate structure
      if (!parsed.items || !Array.isArray(parsed.items)) {
        throw new Error('Invalid response structure: missing items array');
      }
      // Normalize numeric fields
      parsed.items = parsed.items.map(item => ({
        name: item.name || 'Unknown Item',
        portion: item.portion || '1 serving',
        calories: Math.round(Number(item.calories) || 0),
        protein_g: Math.round((Number(item.protein_g) || 0) * 10) / 10,
        carbs_g: Math.round((Number(item.carbs_g) || 0) * 10) / 10,
        fat_g: Math.round((Number(item.fat_g) || 0) * 10) / 10,
        fiber_g: Math.round((Number(item.fiber_g) || 0) * 10) / 10,
        sugar_g: Math.round((Number(item.sugar_g) || 0) * 10) / 10,
        portion_notes: item.portion_notes || '',
      }));
      parsed.health_score = Math.min(10, Math.max(1, Math.round(Number(parsed.health_score) || 5)));
      parsed.meal_summary = parsed.meal_summary || 'Meal analyzed';
      parsed.suggestions = parsed.suggestions || [];
      return { ok: true, analysis: parsed, raw_json: cleaned };
    } catch (err) {
      return { ok: false, error: `Failed to parse AI response: ${err.message}`, raw_json: cleaned };
    }
  }

  // ─── Meal CRUD ──────────────────────────────────────────

  /**
   * Save a meal with its items to the database
   */
  saveMeal({ userId, date, mealType, summary, healthScore, suggestions, items, imageData, analysisRaw }) {
    const mealId = uuidv4();
    const now = new Date().toISOString();

    // Calculate totals
    const totals = this._calculateTotals(items);

    this.db.run(
      `INSERT INTO brainfuel_meals (id, user_id, date, meal_type, summary, health_score, suggestions,
        total_calories, total_protein_g, total_carbs_g, total_fat_g, total_fiber_g, total_sugar_g,
        image_data, analysis_raw, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [mealId, userId || 'dev', date || now.split('T')[0], mealType || 'meal',
       summary || '', healthScore || 5, JSON.stringify(suggestions || []),
       totals.calories, totals.protein_g, totals.carbs_g, totals.fat_g, totals.fiber_g, totals.sugar_g,
       imageData || null, analysisRaw || '{}', now, now]
    );

    // Save individual items
    for (const item of items) {
      const itemId = uuidv4();
      this.db.run(
        `INSERT INTO brainfuel_meal_items (id, meal_id, name, portion, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, portion_notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemId, mealId, item.name, item.portion || '1 serving',
         item.calories || 0, item.protein_g || 0, item.carbs_g || 0, item.fat_g || 0,
         item.fiber_g || 0, item.sugar_g || 0, item.portion_notes || '', now]
      );
    }

    this.saveFn();
    return { id: mealId, ...totals };
  }

  /**
   * Get all meals for a specific date
   */
  getMealsByDate(date, userId = 'dev') {
    const result = this.db.exec(
      `SELECT * FROM brainfuel_meals WHERE date = ? AND user_id = ? ORDER BY created_at DESC`,
      [date, userId]
    );
    if (!result.length) return [];
    return this._rowsToObjects(result[0]);
  }

  /**
   * Get a single meal with its items
   */
  getMeal(mealId) {
    const mealResult = this.db.exec(`SELECT * FROM brainfuel_meals WHERE id = ?`, [mealId]);
    if (!mealResult.length || !mealResult[0].values.length) return null;

    const meal = this._rowsToObjects(mealResult[0])[0];

    const itemsResult = this.db.exec(
      `SELECT * FROM brainfuel_meal_items WHERE meal_id = ? ORDER BY created_at`,
      [mealId]
    );
    meal.items = itemsResult.length ? this._rowsToObjects(itemsResult[0]) : [];
    meal.suggestions = this._safeJsonParse(meal.suggestions, []);

    return meal;
  }

  /**
   * Update a meal item
   */
  updateMealItem(itemId, updates) {
    const allowed = ['name', 'portion', 'calories', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sugar_g', 'portion_notes'];
    const sets = [];
    const values = [];
    for (const [key, val] of Object.entries(updates)) {
      if (allowed.includes(key)) {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (sets.length === 0) return null;

    values.push(itemId);
    this.db.run(`UPDATE brainfuel_meal_items SET ${sets.join(', ')} WHERE id = ?`, values);

    // Recalculate meal totals
    const itemResult = this.db.exec(`SELECT meal_id FROM brainfuel_meal_items WHERE id = ?`, [itemId]);
    if (itemResult.length && itemResult[0].values.length) {
      const mealId = itemResult[0].values[0][0];
      this._recalculateMealTotals(mealId);
    }

    this.saveFn();
    return { ok: true };
  }

  /**
   * Delete a meal item
   */
  deleteMealItem(itemId) {
    const itemResult = this.db.exec(`SELECT meal_id FROM brainfuel_meal_items WHERE id = ?`, [itemId]);
    this.db.run(`DELETE FROM brainfuel_meal_items WHERE id = ?`, [itemId]);

    if (itemResult.length && itemResult[0].values.length) {
      const mealId = itemResult[0].values[0][0];
      this._recalculateMealTotals(mealId);
    }

    this.saveFn();
    return { ok: true };
  }

  /**
   * Delete an entire meal and its items
   */
  deleteMeal(mealId) {
    this.db.run(`DELETE FROM brainfuel_meal_items WHERE meal_id = ?`, [mealId]);
    this.db.run(`DELETE FROM brainfuel_meals WHERE id = ?`, [mealId]);
    this.saveFn();
    return { ok: true };
  }

  /**
   * Get daily nutrition summary for a date
   */
  getDailySummary(date, userId = 'dev') {
    const result = this.db.exec(
      `SELECT
        COUNT(*) as meal_count,
        COALESCE(SUM(total_calories), 0) as total_calories,
        COALESCE(SUM(total_protein_g), 0) as total_protein_g,
        COALESCE(SUM(total_carbs_g), 0) as total_carbs_g,
        COALESCE(SUM(total_fat_g), 0) as total_fat_g,
        COALESCE(SUM(total_fiber_g), 0) as total_fiber_g,
        COALESCE(SUM(total_sugar_g), 0) as total_sugar_g
       FROM brainfuel_meals WHERE date = ? AND user_id = ?`,
      [date, userId]
    );
    if (!result.length) {
      return { meal_count: 0, total_calories: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, total_fiber_g: 0, total_sugar_g: 0 };
    }
    return this._rowsToObjects(result[0])[0];
  }

  /**
   * Get nutrition history for a date range (for charts)
   */
  getHistory(startDate, endDate, userId = 'dev') {
    const result = this.db.exec(
      `SELECT date,
        COUNT(*) as meal_count,
        SUM(total_calories) as total_calories,
        SUM(total_protein_g) as total_protein_g,
        SUM(total_carbs_g) as total_carbs_g,
        SUM(total_fat_g) as total_fat_g
       FROM brainfuel_meals
       WHERE date >= ? AND date <= ? AND user_id = ?
       GROUP BY date
       ORDER BY date`,
      [startDate, endDate, userId]
    );
    if (!result.length) return [];
    return this._rowsToObjects(result[0]);
  }

  /**
   * Get nutrition goals (stored in system_settings)
   */
  getGoals(userId = 'dev') {
    const result = this.db.exec(
      `SELECT value FROM system_settings WHERE key = ?`,
      [`brainfuel_goals_${userId}`]
    );
    if (!result.length || !result[0].values.length) {
      return { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 };
    }
    return this._safeJsonParse(result[0].values[0][0], { calories: 2000, protein_g: 150, carbs_g: 250, fat_g: 65 });
  }

  /**
   * Save nutrition goals
   */
  saveGoals(goals, userId = 'dev') {
    const key = `brainfuel_goals_${userId}`;
    const value = JSON.stringify(goals);
    this.db.run(
      `INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`,
      [key, value]
    );
    this.saveFn();
    return { ok: true };
  }

  // ─── Helpers ────────────────────────────────────────────

  _calculateTotals(items) {
    return items.reduce((acc, item) => ({
      calories: acc.calories + (Number(item.calories) || 0),
      protein_g: Math.round((acc.protein_g + (Number(item.protein_g) || 0)) * 10) / 10,
      carbs_g: Math.round((acc.carbs_g + (Number(item.carbs_g) || 0)) * 10) / 10,
      fat_g: Math.round((acc.fat_g + (Number(item.fat_g) || 0)) * 10) / 10,
      fiber_g: Math.round((acc.fiber_g + (Number(item.fiber_g) || 0)) * 10) / 10,
      sugar_g: Math.round((acc.sugar_g + (Number(item.sugar_g) || 0)) * 10) / 10,
    }), { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 });
  }

  _recalculateMealTotals(mealId) {
    const itemsResult = this.db.exec(
      `SELECT calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g FROM brainfuel_meal_items WHERE meal_id = ?`,
      [mealId]
    );
    let totals = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, sugar_g: 0 };
    if (itemsResult.length) {
      const items = this._rowsToObjects(itemsResult[0]);
      totals = this._calculateTotals(items);
    }
    this.db.run(
      `UPDATE brainfuel_meals SET total_calories = ?, total_protein_g = ?, total_carbs_g = ?, total_fat_g = ?, total_fiber_g = ?, total_sugar_g = ?, updated_at = datetime('now') WHERE id = ?`,
      [totals.calories, totals.protein_g, totals.carbs_g, totals.fat_g, totals.fiber_g, totals.sugar_g, mealId]
    );
  }

  _rowsToObjects(result) {
    const { columns, values } = result;
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });
  }

  _safeJsonParse(str, fallback) {
    try { return JSON.parse(str); } catch { return fallback; }
  }
}

module.exports = { BrainFuelService };
