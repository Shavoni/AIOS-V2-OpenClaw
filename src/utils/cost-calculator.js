const PRICING = {
  // OpenAI (per token)
  "gpt-4o": { input: 2.5 / 1_000_000, output: 10.0 / 1_000_000 },
  "gpt-4o-mini": { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 },
  "gpt-4-turbo": { input: 10.0 / 1_000_000, output: 30.0 / 1_000_000 },
  "gpt-3.5-turbo": { input: 0.5 / 1_000_000, output: 1.5 / 1_000_000 },

  // Anthropic
  "claude-opus-4-20250514": { input: 15.0 / 1_000_000, output: 75.0 / 1_000_000 },
  "claude-sonnet-4-20250514": { input: 3.0 / 1_000_000, output: 15.0 / 1_000_000 },
  "claude-haiku-4-20250514": { input: 0.8 / 1_000_000, output: 4.0 / 1_000_000 },

  // Gemini
  "gemini-2.0-flash": { input: 0.1 / 1_000_000, output: 0.4 / 1_000_000 },
  "gemini-1.5-pro": { input: 1.25 / 1_000_000, output: 5.0 / 1_000_000 },
};

function calculateCost(model, promptTokens, completionTokens) {
  const pricing = PRICING[model];
  if (!pricing) return 0;
  return pricing.input * promptTokens + pricing.output * completionTokens;
}

function getKnownModels() {
  return Object.keys(PRICING);
}

module.exports = { calculateCost, getKnownModels, PRICING };
