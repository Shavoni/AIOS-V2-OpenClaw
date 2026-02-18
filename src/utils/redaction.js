/**
 * Canonical auth config redaction — single source of truth.
 * Used by ConnectorService and Integration routes.
 */

const SENSITIVE_KEYS = /secret|token|password|apikey|api_key|key|credential|bearer/i;

function redactAuthConfig(authConfig) {
  if (!authConfig || typeof authConfig !== "object") return {};
  const redacted = {};
  for (const [key, value] of Object.entries(authConfig)) {
    if (typeof value === "string" && value.length > 0 && SENSITIVE_KEYS.test(key)) {
      redacted[key] = value.length > 8
        ? value.slice(0, 4) + "****" + value.slice(-4)
        : "****";
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

module.exports = { redactAuthConfig };
