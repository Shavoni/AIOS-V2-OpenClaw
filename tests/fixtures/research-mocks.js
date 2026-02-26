/**
 * Shared mock objects for research pipeline tests.
 */

function createMockRouter() {
  return { route: jest.fn(), chatCompletion: jest.fn() };
}

function createMockRag() {
  return { search: { search: jest.fn().mockReturnValue([]) } };
}

function createMockEventBus(log = []) {
  return { emit: jest.fn((...args) => log.push(args)) };
}

function createMockManager(overrides = {}) {
  return {
    createJob: jest.fn().mockReturnValue({ id: "job-1", status: "QUEUED", query: "test" }),
    getJob: jest.fn().mockReturnValue({ id: "job-1", status: "QUEUED", query: "test" }),
    updateStatus: jest.fn(),
    updateStageProgress: jest.fn(),
    setQueryDecomposition: jest.fn(),
    completeJob: jest.fn(),
    failJob: jest.fn(),
    saveResult: jest.fn().mockReturnValue("result-1"),
    addSource: jest.fn(),
    getQueueSummary: jest.fn().mockReturnValue({ QUEUED: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0 }),
    listJobs: jest.fn().mockReturnValue([]),
    getResult: jest.fn(),
    getSourcesForJob: jest.fn().mockReturnValue([]),
    ...overrides,
  };
}

module.exports = { createMockRouter, createMockRag, createMockEventBus, createMockManager };
