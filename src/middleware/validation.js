/**
 * Request validation middleware.
 * Validates required fields, types, and lengths on POST/PUT bodies.
 */

function validate(schema) {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = body[field];

      if (rules.required && (value === undefined || value === null || value === "")) {
        errors.push(`${field} is required`);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rules.type === "string" && typeof value !== "string") {
        errors.push(`${field} must be a string`);
      }
      if (rules.type === "number" && typeof value !== "number") {
        errors.push(`${field} must be a number`);
      }
      if (rules.type === "boolean" && typeof value !== "boolean") {
        errors.push(`${field} must be a boolean`);
      }
      if (rules.type === "array" && !Array.isArray(value)) {
        errors.push(`${field} must be an array`);
      }
      if (rules.type === "object" && (typeof value !== "object" || Array.isArray(value))) {
        errors.push(`${field} must be an object`);
      }
      if (rules.minLength && typeof value === "string" && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && typeof value === "string" && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(", ")}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: "Validation failed", details: errors });
    }

    next();
  };
}

// Pre-built schemas for common endpoints
const schemas = {
  chat: {
    sessionId: { required: true, type: "string", minLength: 1 },
    message: { required: true, type: "string", minLength: 1, maxLength: 32000 },
  },
  createAgent: {
    name: { required: true, type: "string", minLength: 1, maxLength: 200 },
    domain: { type: "string", maxLength: 100 },
    description: { type: "string", maxLength: 5000 },
    system_prompt: { type: "string", maxLength: 50000 },
  },
  createSession: {
    title: { type: "string", maxLength: 200 },
    profile: { type: "string", maxLength: 50 },
  },
  register: {
    username: { required: true, type: "string", minLength: 2, maxLength: 100 },
    password: { required: true, type: "string", minLength: 8, maxLength: 200 },
  },
  login: {
    username: { type: "string", minLength: 1, maxLength: 100 },
    password: { type: "string", maxLength: 200 },
    apiKey: { type: "string", maxLength: 500 },
  },
  createRule: {
    name: { required: true, type: "string", minLength: 1, maxLength: 200 },
    hitl_mode: { type: "string", enum: ["INFORM", "DRAFT", "ESCALATE"] },
  },
  writeMemory: {
    filename: { required: true, type: "string", minLength: 1, maxLength: 200 },
    content: { required: true, type: "string" },
  },
  executeSkill: {
    command: { required: true, type: "string", minLength: 1 },
  },
};

module.exports = { validate, schemas };
