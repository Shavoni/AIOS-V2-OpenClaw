const { HITL_MODES, higherMode } = require("./hitl");

const CONSTITUTIONAL_RULES = [
  {
    id: "no-external-posting",
    description: "Never post externally without explicit human approval",
    check: (_intent, risk) => {
      if (risk.signals.includes("PUBLIC_STATEMENT")) {
        return { hitlMode: HITL_MODES.ESCALATE, reason: "External posting requires human approval" };
      }
      return null;
    },
  },
  {
    id: "pii-protection",
    description: "Protect personally identifiable information",
    check: (_intent, risk) => {
      if (risk.signals.includes("PII")) {
        return { hitlMode: HITL_MODES.DRAFT, localOnly: true, reason: "PII detected \u2014 using local model only" };
      }
      return null;
    },
  },
  {
    id: "legal-review",
    description: "Legal content requires human review",
    check: (intent, risk) => {
      if (intent.domain === "Legal" || risk.signals.includes("LEGAL_CONTRACT")) {
        return { hitlMode: HITL_MODES.DRAFT, reason: "Legal content requires review" };
      }
      return null;
    },
  },
  {
    id: "financial-safeguard",
    description: "Financial actions require escalation",
    check: (intent, risk) => {
      if (risk.signals.includes("FINANCIAL") && intent.domain === "Finance") {
        return { hitlMode: HITL_MODES.ESCALATE, reason: "Financial action requires explicit approval" };
      }
      return null;
    },
  },
];

class GovernanceEngine {
  constructor(rules) {
    this.rules = rules || CONSTITUTIONAL_RULES;
    this.classifier = null;
    this.riskDetector = null;
  }

  evaluate(intent, risk) {
    let hitlMode = HITL_MODES.INFORM;
    let localOnly = false;
    const policyTriggers = [];
    const guardrails = [];
    let escalationReason = null;

    for (const rule of this.rules) {
      const result = rule.check(intent, risk);
      if (result) {
        hitlMode = higherMode(hitlMode, result.hitlMode);
        policyTriggers.push(rule.id);
        guardrails.push(rule.description);
        if (result.localOnly) localOnly = true;
        if (result.hitlMode === HITL_MODES.ESCALATE) {
          escalationReason = result.reason;
        }
      }
    }

    return {
      hitlMode,
      approvalRequired: hitlMode !== HITL_MODES.INFORM,
      providerConstraints: { localOnly },
      policyTriggers,
      guardrails,
      escalationReason,
    };
  }
}

module.exports = { GovernanceEngine, CONSTITUTIONAL_RULES };
