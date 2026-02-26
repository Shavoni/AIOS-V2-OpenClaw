/**
 * Environment variable validation.
 * Validates required env vars on startup and fails fast if missing.
 */

function validateEnv() {
  const warnings = [];
  const errors = [];

  // Security checks — enforce in all non-development environments
  const isDev = !process.env.NODE_ENV || process.env.NODE_ENV === "development";
  if (!isDev) {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes("dev-secret")) {
      errors.push("JWT_SECRET must be set to a secure value in non-development environments");
    }
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.includes("dev-secret")) {
      errors.push("SESSION_SECRET must be set to a secure value in non-development environments");
    }
  } else {
    // Even in dev, warn about missing secrets
    if (!process.env.JWT_SECRET) {
      warnings.push("JWT_SECRET not set — using auto-generated secret (tokens will not persist across restarts)");
    }
  }

  // Check at least one provider is configured
  const hasProvider = [
    process.env.OPENAI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.OLLAMA_HOST,
    process.env.LM_STUDIO_HOST,
  ].some(Boolean);

  if (!hasProvider) {
    warnings.push(
      "No LLM provider configured. Set at least one of: OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, OLLAMA_HOST, LM_STUDIO_HOST"
    );
  }

  // Port validation
  const port = parseInt(process.env.PORT || "3000", 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT: ${process.env.PORT}`);
  }

  // Print warnings
  if (warnings.length > 0) {
    console.warn("\n  Environment warnings:");
    for (const w of warnings) {
      console.warn(`  - ${w}`);
    }
  }

  // Fail on errors
  if (errors.length > 0) {
    console.error("\n  Environment errors:");
    for (const e of errors) {
      console.error(`  - ${e}`);
    }
    if (!isDev) {
      throw new Error(`Environment validation failed: ${errors.join("; ")}`);
    }
  }

  return { warnings, errors, valid: errors.length === 0 };
}

module.exports = { validateEnv };
