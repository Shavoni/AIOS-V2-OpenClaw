const { GovernanceEngine } = require("../../src/governance/policies");
const { IntentClassifier } = require("../../src/governance/classifier");
const { RiskDetector } = require("../../src/governance/risk-detector");

describe("GovernanceEngine", () => {
  const engine = new GovernanceEngine();
  const classifier = new IntentClassifier();
  const detector = new RiskDetector();

  test("returns INFORM for safe general queries", () => {
    const intent = classifier.classify("What is 2+2?");
    const risk = detector.detect("What is 2+2?");
    const decision = engine.evaluate(intent, risk);
    expect(decision.hitlMode).toBe("INFORM");
    expect(decision.approvalRequired).toBe(false);
  });

  test("returns ESCALATE for public statements", () => {
    const intent = classifier.classify("Post this on social media");
    const risk = detector.detect("Draft a press release about our funding");
    const decision = engine.evaluate(intent, risk);
    expect(decision.hitlMode).toBe("ESCALATE");
    expect(decision.policyTriggers).toContain("no-external-posting");
  });

  test("returns DRAFT for PII content", () => {
    const intent = classifier.classify("Look up this person");
    const risk = detector.detect("The SSN is 123-45-6789");
    const decision = engine.evaluate(intent, risk);
    expect(decision.hitlMode).toBe("DRAFT");
    expect(decision.providerConstraints.localOnly).toBe(true);
  });

  test("returns DRAFT for legal content", () => {
    const intent = classifier.classify("Review the contract");
    const risk = detector.detect("Review the contract terms");
    const decision = engine.evaluate(intent, risk);
    expect(decision.hitlMode).toBe("DRAFT");
    expect(decision.policyTriggers).toContain("legal-review");
  });

  test("decision has required properties", () => {
    const intent = { domain: "General", confidence: 0 };
    const risk = { signals: [], hasRisk: false };
    const decision = engine.evaluate(intent, risk);
    expect(decision).toHaveProperty("hitlMode");
    expect(decision).toHaveProperty("approvalRequired");
    expect(decision).toHaveProperty("providerConstraints");
    expect(decision).toHaveProperty("policyTriggers");
    expect(decision).toHaveProperty("guardrails");
  });
});
