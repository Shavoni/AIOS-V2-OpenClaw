class PromptBuilder {
  constructor(identity) {
    this.identity = identity;
  }

  build(profile, governanceDecision, sessionContext) {
    const sections = [];

    // Identity
    if (this.identity.identity) {
      sections.push(`# Agent Identity\n${this.identity.identity}`);
    }

    // Soul
    if (this.identity.soul) {
      sections.push(`# Core Values\n${this.identity.soul}`);
    }

    // User context
    if (this.identity.user) {
      sections.push(`# User Context\n${this.identity.user}`);
    }

    // Profile
    sections.push(`# Current Profile: ${profile.name}\n${profile.description}\nModel: ${profile.model}`);

    // Governance constraints
    if (governanceDecision) {
      const constraints = [];
      if (governanceDecision.hitlMode === "DRAFT") {
        constraints.push("IMPORTANT: Your response will be marked as DRAFT requiring human approval.");
      }
      if (governanceDecision.providerConstraints?.localOnly) {
        constraints.push("CONSTRAINT: Use only local models. No data should leave this machine.");
      }
      if (governanceDecision.guardrails?.length) {
        constraints.push(`Guardrails: ${governanceDecision.guardrails.join(", ")}`);
      }
      if (constraints.length) {
        sections.push(`# Governance\n${constraints.join("\n")}`);
      }
    }

    // Session context
    if (sessionContext) {
      sections.push(`# Session\n${sessionContext}`);
    }

    return sections.join("\n\n");
  }
}

module.exports = { PromptBuilder };