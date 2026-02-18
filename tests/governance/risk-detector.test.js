const { RiskDetector } = require("../../src/governance/risk-detector");

describe("RiskDetector", () => {
  const detector = new RiskDetector();

  test("detects PII (SSN pattern)", () => {
    const result = detector.detect("My SSN is 123-45-6789");
    expect(result.signals).toContain("PII");
    expect(result.hasRisk).toBe(true);
  });

  test("detects PII (email)", () => {
    const result = detector.detect("Contact me at user@example.com");
    expect(result.signals).toContain("PII");
  });

  test("detects PUBLIC_STATEMENT", () => {
    const result = detector.detect("Draft a press release for the new product launch");
    expect(result.signals).toContain("PUBLIC_STATEMENT");
  });

  test("detects LEGAL_CONTRACT", () => {
    const result = detector.detect("The party of the first part hereby agrees");
    expect(result.signals).toContain("LEGAL_CONTRACT");
  });

  test("detects FINANCIAL", () => {
    const result = detector.detect("Approve the transfer of $50,000 to vendor");
    expect(result.signals).toContain("FINANCIAL");
  });

  test("returns no signals for safe text", () => {
    const result = detector.detect("What is the weather today?");
    expect(result.signals).toHaveLength(0);
    expect(result.hasRisk).toBe(false);
    expect(result.riskLevel).toBe("low");
  });

  test("risk level scales with signal count", () => {
    const result = detector.detect("Transfer $10,000 and post the press release with SSN 123-45-6789");
    expect(result.riskLevel).toBe("high");
  });
});
