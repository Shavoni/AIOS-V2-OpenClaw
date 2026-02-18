const SAMPLE_MESSAGES = [
  { role: "user", content: "Hello, how are you?" },
  { role: "assistant", content: "I am doing well, thank you for asking." },
  { role: "user", content: "Can you help me draft an email?" },
];

const SAMPLE_IDENTITY_MD = `# IDENTITY.md
- **Name:** TestBot
- **Creature:** Test AI assistant
- **Emoji:** 🤖
- **Owner:** Tester
`;

const SAMPLE_SOUL_MD = `# SOUL.md
## Core Values
- Be helpful
- Be honest
`;

const SAMPLE_USER_MD = `# USER.md
## User
- Name: Test User
- Role: Developer
`;

const SAMPLE_SKILL_MD = `---
name: test-skill
description: A test skill for testing
version: 1.0.0
tags:
  - test
  - development
---

## Capabilities
- Run tests
- Generate test data
- Mock API responses

## Usage
Use \`/test\` to run the test skill.
`;

const RISK_TEST_CASES = [
  { input: "My SSN is 123-45-6789", expected: ["PII"] },
  { input: "Draft a press release about our new product", expected: ["PUBLIC_STATEMENT"] },
  { input: "Sign the contract with vendor X", expected: ["LEGAL_CONTRACT"] },
  { input: "Approve the budget of $50,000", expected: ["FINANCIAL"] },
  { input: "What is the weather today?", expected: [] },
];

const INTENT_TEST_CASES = [
  { input: "Send an email to the team", expected: "Comms" },
  { input: "Review the contract terms", expected: "Legal" },
  { input: "What is the quarterly budget?", expected: "Finance" },
  { input: "Deploy the docker container", expected: "DevOps" },
  { input: "What is 2+2?", expected: "General" },
];

module.exports = {
  SAMPLE_MESSAGES,
  SAMPLE_IDENTITY_MD,
  SAMPLE_SOUL_MD,
  SAMPLE_USER_MD,
  SAMPLE_SKILL_MD,
  RISK_TEST_CASES,
  INTENT_TEST_CASES,
};
