const AGENT_PROFILES = {
  main: {
    id: "main",
    name: "General",
    model: "glm-4.7-flash",
    temperature: 0.7,
    maxTokens: 4096,
    description: "Balanced general-purpose assistant",
  },
  reasoning: {
    id: "reasoning",
    name: "Reasoning",
    model: "deepseek-r1:8b",
    temperature: 0.3,
    maxTokens: 8192,
    description: "Deep reasoning and analysis",
  },
  coding: {
    id: "coding",
    name: "Coding",
    model: "qwen2.5:14b",
    temperature: 0.2,
    maxTokens: 8192,
    description: "Code generation and review",
  },
  research: {
    id: "research",
    name: "Research",
    model: "glm-4.7-flash",
    temperature: 0.5,
    maxTokens: 8192,
    description: "Research and information synthesis",
  },
  local: {
    id: "local",
    name: "Local",
    model: "glm-4.7-flash",
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