const { ResearchQueueService } = require("../../src/research/queue-service");

describe("ResearchQueueService", () => {
  let service, mockManager, mockDecomposition, mockRetrieval, mockScoring, mockSynthesis, mockEventBus;

  beforeEach(() => {
    jest.useFakeTimers();

    mockManager = {
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
    };

    mockDecomposition = { execute: jest.fn().mockResolvedValue(["q1", "q2"]) };
    mockRetrieval = { execute: jest.fn().mockResolvedValue([
      { id: "r1", text: "Source 1", url: "https://a.com", score: 0.9, retrievalMethod: "rag" },
    ])};
    mockScoring = { execute: jest.fn().mockResolvedValue({
      scoredSources: [{ text: "Source 1", composite: 0.8 }],
      scoredClaims: [{ text: "Claim 1", confidenceScore: 0.85, contradictionFlag: false }],
      jobConfidence: { confidence: 0.85, claimCount: 1, sourceCount: 1, hasContradictions: false },
    })};
    mockSynthesis = { execute: jest.fn().mockResolvedValue({
      synthesis: "# Research Report\n\nFindings...",
      tokenUsage: { totalTokens: 1500 },
    })};

    mockEventBus = {
      emit: jest.fn(),
    };

    service = new ResearchQueueService({
      manager: mockManager,
      decompositionWorker: mockDecomposition,
      retrievalWorker: mockRetrieval,
      scoringWorker: mockScoring,
      synthesisWorker: mockSynthesis,
      eventBus: mockEventBus,
      maxConcurrency: 3,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Job submission ---
  test("submitJob creates a job and returns it", async () => {
    const job = await service.submitJob({ userId: "user-1", query: "test query" });
    expect(mockManager.createJob).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1", query: "test query" })
    );
    expect(job).toHaveProperty("id", "job-1");
  });

  test("submitJob enqueues the job for processing", async () => {
    await service.submitJob({ userId: "user-1", query: "test" });
    // Job is immediately drained since concurrency allows it — verify processing started
    expect(mockManager.updateStatus).toHaveBeenCalledWith("job-1", "PROCESSING");
  });

  test("submitJob emits research:queued event", async () => {
    await service.submitJob({ userId: "user-1", query: "test" });
    expect(mockEventBus.emit).toHaveBeenCalledWith("research:queued", expect.objectContaining({ id: "job-1" }));
  });

  // --- Pipeline orchestration ---
  test("processJob runs all 4 stages in order", async () => {
    const callOrder = [];
    mockDecomposition.execute.mockImplementation(async () => { callOrder.push("decomposition"); return ["q1"]; });
    mockRetrieval.execute.mockImplementation(async () => { callOrder.push("retrieval"); return [{ id: "r1", text: "S", retrievalMethod: "rag" }]; });
    mockScoring.execute.mockImplementation(async () => {
      callOrder.push("scoring");
      return { scoredSources: [], scoredClaims: [], jobConfidence: { confidence: 0.5, claimCount: 0, sourceCount: 0, hasContradictions: false } };
    });
    mockSynthesis.execute.mockImplementation(async () => { callOrder.push("synthesis"); return { synthesis: "Report", tokenUsage: {} }; });

    await service.processJob("job-1");
    expect(callOrder).toEqual(["decomposition", "retrieval", "scoring", "synthesis"]);
  });

  test("processJob updates status to PROCESSING at start", async () => {
    await service.processJob("job-1");
    expect(mockManager.updateStatus).toHaveBeenCalledWith("job-1", "PROCESSING");
  });

  test("processJob calls setQueryDecomposition with sub-questions", async () => {
    await service.processJob("job-1");
    expect(mockManager.setQueryDecomposition).toHaveBeenCalledWith("job-1", ["q1", "q2"]);
  });

  test("processJob passes sub-questions to retrieval worker", async () => {
    await service.processJob("job-1");
    expect(mockRetrieval.execute).toHaveBeenCalledWith(["q1", "q2"], expect.any(String));
  });

  test("processJob passes retrieval results to scoring worker", async () => {
    await service.processJob("job-1");
    expect(mockScoring.execute).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "r1" })]),
      "test"
    );
  });

  test("processJob passes scored evidence to synthesis worker", async () => {
    await service.processJob("job-1");
    expect(mockSynthesis.execute).toHaveBeenCalledWith(expect.objectContaining({
      query: "test",
      scoredSources: expect.any(Array),
      scoredClaims: expect.any(Array),
      jobConfidence: expect.any(Object),
    }));
  });

  test("processJob saves result and completes job", async () => {
    await service.processJob("job-1");
    expect(mockManager.saveResult).toHaveBeenCalledWith(expect.objectContaining({
      jobId: "job-1",
      synthesis: expect.stringContaining("Research Report"),
    }));
    expect(mockManager.completeJob).toHaveBeenCalledWith("job-1", expect.objectContaining({
      resultId: "result-1",
      confidenceScore: 0.85,
    }));
  });

  // --- Progress events ---
  test("processJob emits progress events for each stage", async () => {
    await service.processJob("job-1");
    const progressCalls = mockEventBus.emit.mock.calls.filter(([event]) => event === "research:progress");
    expect(progressCalls.length).toBeGreaterThanOrEqual(4);
  });

  test("processJob emits research:completed on success", async () => {
    await service.processJob("job-1");
    expect(mockEventBus.emit).toHaveBeenCalledWith("research:completed", expect.objectContaining({ jobId: "job-1" }));
  });

  // --- Error handling ---
  test("processJob emits research:failed on error", async () => {
    mockDecomposition.execute.mockRejectedValue(new Error("LLM down"));
    await service.processJob("job-1");
    expect(mockEventBus.emit).toHaveBeenCalledWith("research:failed", expect.objectContaining({
      jobId: "job-1",
      error: "LLM down",
    }));
  });

  test("processJob calls failJob on error", async () => {
    mockDecomposition.execute.mockRejectedValue(new Error("LLM down"));
    await service.processJob("job-1");
    expect(mockManager.failJob).toHaveBeenCalledWith("job-1", "LLM down");
  });

  // --- Concurrency ---
  test("respects maxConcurrency limit", async () => {
    let running = 0;
    let maxRunning = 0;

    mockDecomposition.execute.mockImplementation(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 100));
      running--;
      return ["q1"];
    });

    const jobs = Array.from({ length: 5 }, (_, i) => {
      mockManager.createJob.mockReturnValueOnce({ id: `job-${i}`, status: "QUEUED", query: "test" });
      mockManager.getJob.mockReturnValueOnce({ id: `job-${i}`, status: "QUEUED", query: "test" });
      return service.submitJob({ userId: "user-1", query: "test" });
    });

    await Promise.all(jobs);

    // Drain queue by advancing timers
    await jest.advanceTimersByTimeAsync(1000);

    expect(maxRunning).toBeLessThanOrEqual(3);
  });

  // --- Queue management ---
  test("getQueueSummary delegates to manager", () => {
    service.getQueueSummary();
    expect(mockManager.getQueueSummary).toHaveBeenCalled();
  });

  test("cancelJob sets status to CANCELLED", async () => {
    mockManager.getJob.mockReturnValue({ id: "job-1", status: "QUEUED" });
    await service.cancelJob("job-1");
    expect(mockManager.updateStatus).toHaveBeenCalledWith("job-1", "CANCELLED");
  });

  test("cancelJob emits research:cancelled event", async () => {
    mockManager.getJob.mockReturnValue({ id: "job-1", status: "QUEUED" });
    await service.cancelJob("job-1");
    expect(mockEventBus.emit).toHaveBeenCalledWith("research:cancelled", expect.objectContaining({ jobId: "job-1" }));
  });

  test("cancelJob returns false for already completed jobs", async () => {
    mockManager.getJob.mockReturnValue({ id: "job-1", status: "COMPLETED" });
    const result = await service.cancelJob("job-1");
    expect(result).toBe(false);
  });
});
