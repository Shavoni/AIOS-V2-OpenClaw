const { IntentClassifier } = require("../../src/governance/classifier");

describe("IntentClassifier", () => {
  const classifier = new IntentClassifier();

  test("classifies email-related text as Comms", () => {
    const result = classifier.classify("Send an email to the marketing team");
    expect(result.domain).toBe("Comms");
    expect(result.confidence).toBeGreaterThan(0);
  });

  test("classifies contract text as Legal", () => {
    const result = classifier.classify("Review the contract terms and NDA");
    expect(result.domain).toBe("Legal");
  });

  test("classifies budget text as Finance", () => {
    const result = classifier.classify("What is the quarterly budget and revenue forecast?");
    expect(result.domain).toBe("Finance");
  });

  test("classifies deployment text as DevOps", () => {
    const result = classifier.classify("Deploy the docker container to kubernetes");
    expect(result.domain).toBe("DevOps");
  });

  test("classifies general text as General", () => {
    const result = classifier.classify("What is the meaning of life?");
    expect(result.domain).toBe("General");
  });

  test("returns allScores object", () => {
    const result = classifier.classify("Hello world");
    expect(result).toHaveProperty("allScores");
    expect(typeof result.allScores).toBe("object");
  });

  test("confidence is between 0 and 1", () => {
    const result = classifier.classify("Send an email about the contract budget");
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
