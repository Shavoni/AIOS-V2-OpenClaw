const AGENT_PROFILES = {
  main: {
    id: "main",
    name: "General",
    model: "gpt-4o",
    temperature: 0.7,
    maxTokens: 4096,
    description: "Balanced general-purpose assistant",
  },
  reasoning: {
    id: "reasoning",
    name: "Reasoning",
    model: "o3",
    temperature: 0.3,
    maxTokens: 8192,
    description: "Deep reasoning and analysis",
  },
  coding: {
    id: "coding",
    name: "Coding",
    model: "claude-sonnet-4-5-20250514",
    temperature: 0.2,
    maxTokens: 8192,
    description: "Code generation and review",
  },
  research: {
    id: "research",
    name: "Research",
    model: "gemini-2.5-pro",
    temperature: 0.5,
    maxTokens: 8192,
    description: "Research and information synthesis",
  },
  local: {
    id: "local",
    name: "Local",
    model: "gpt-oss-120b",
    temperature: 0.7,
    maxTokens: 4096,
    description: "Local private model (no data leaves machine)",
  },
};

function getProfile(id) {
  return AGENT_PROFILES[id] || AGENT_PROFILES.main;
}

function getAllProfiles() {
  return Object.values(AGENT_PROFILES);
}

module.exports = { AGENT_PROFILES, getProfile, getAllProfiles };