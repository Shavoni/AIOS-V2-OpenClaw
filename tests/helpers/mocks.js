function createMockDb() {
  const data = { sessions: [], messages: [], audit: [] };
  return {
    run: jest.fn(),
    prepare: jest.fn(() => ({
      bind: jest.fn(),
      step: jest.fn(() => false),
      getAsObject: jest.fn(() => ({})),
      free: jest.fn(),
    })),
    export: jest.fn(() => new Uint8Array(0)),
    close: jest.fn(),
    _data: data,
  };
}

function createMockRouter() {
  return {
    route: jest.fn(async () => ({
      text: "Mock response",
      model: "test-model",
      provider: "test-provider",
      usage: { prompt: 10, completion: 20 },
      latencyMs: 100,
    })),
    routeStream: jest.fn(async function* () {
      yield { text: "Mock ", model: "test-model", provider: "test-provider" };
      yield { text: "stream", model: "test-model", provider: "test-provider" };
    }),
    getProviderStatus: jest.fn(() => [
      { id: "test", healthy: true, lastError: null, defaultModel: "test-model" },
    ]),
    clients: new Map(),
    _modelIndex: new Map(),
  };
}

function createMockAgent() {
  return {
    getSystemPrompt: jest.fn(() => "You are a test assistant."),
    getProfile: jest.fn(() => ({
      id: "main",
      name: "General",
      model: "gpt-4o",
      temperature: 0.7,
      maxTokens: 4096,
    })),
    getAgentInfo: jest.fn(() => ({
      name: "Test Agent",
      role: "Assistant",
      emoji: "",
      summary: "Test Agent",
      profiles: [],
    })),
    identity: {
      name: "Test Agent",
      role: "Assistant",
      emoji: "",
      getSummary: () => "Test Agent",
    },
  };
}

function createMockMemory() {
  return {
    createSession: jest.fn((title, profile) => ({ id: "test-session-id", title, profile })),
    listSessions: jest.fn(() => []),
    deleteSession: jest.fn(),
    addMessage: jest.fn(),
    getMessages: jest.fn(() => []),
    addAuditLog: jest.fn(),
    buildContext: jest.fn(() => []),
    listMemoryFiles: jest.fn(() => []),
  };
}

function createMockGovernance() {
  const classifier = { classify: jest.fn(() => ({ domain: "General", confidence: 0, allScores: {} })) };
  const riskDetector = { detect: jest.fn(() => ({ signals: [], hasRisk: false, riskLevel: "low" })) };
  const engine = {
    evaluate: jest.fn(() => ({
      hitlMode: "INFORM",
      approvalRequired: false,
      providerConstraints: { localOnly: false },
      policyTriggers: [],
      guardrails: [],
      escalationReason: null,
    })),
    classifier,
    riskDetector,
  };
  return { classifier, riskDetector, engine };
}

function createMockSkills() {
  return {
    getAllSkills: jest.fn(() => []),
    getSkill: jest.fn(() => null),
    findSkills: jest.fn(() => []),
    getSkillCount: jest.fn(() => 0),
    getSkillSummary: jest.fn(() => ""),
  };
}

module.exports = {
  createMockDb,
  createMockRouter,
  createMockAgent,
  createMockMemory,
  createMockGovernance,
  createMockSkills,
};
