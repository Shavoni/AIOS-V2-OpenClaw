const { AgentIdentity } = require("./identity");
const { getProfile, getAllProfiles } = require("./profiles");
const { PromptBuilder } = require("./prompt-builder");

class AgentManager {
  constructor(projectRoot) {
    this.identity = new AgentIdentity(projectRoot).load();
    this.promptBuilder = new PromptBuilder(this.identity);
  }

  getSystemPrompt(profileId, governanceDecision, sessionContext) {
    const profile = getProfile(profileId);
    return this.promptBuilder.build(profile, governanceDecision, sessionContext);
  }

  getProfile(profileId) {
    return getProfile(profileId);
  }

  getAgentInfo() {
    return {
      name: this.identity.name,
      role: this.identity.role,
      emoji: this.identity.emoji,
      summary: this.identity.getSummary(),
      profiles: getAllProfiles(),
    };
  }
}

module.exports = { AgentManager };