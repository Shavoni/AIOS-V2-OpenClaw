const { createTestDb } = require("../fixtures/test-db");
const { ResearchJobManager } = require("../../src/research/manager");

describe("ResearchJobManager", () => {
  let db, manager, saveFn;

  beforeAll(async () => {
    db = await createTestDb();
    saveFn = jest.fn();
    manager = new ResearchJobManager(db, saveFn);
  });

  afterAll(() => {
    if (db) db.close();
  });

  beforeEach(() => {
    saveFn.mockClear();
  });

  describe("job creation", () => {
    let job;

    test("creates a research job with QUEUED status", () => {
      job = manager.createJob({ userId: "user-1", query: "What is quantum computing?" });
      expect(job).toBeTruthy();
      expect(job.status).toBe("QUEUED");
    });

    test("creates a job with user_id and query", () => {
      expect(job.user_id).toBe("user-1");
      expect(job.query).toBe("What is quantum computing?");
    });

    test("sets default ttl to 86400 seconds", () => {
      expect(job.ttl).toBe(86400);
    });

    test("assigns a UUID id", () => {
      expect(job.id).toBeTruthy();
      expect(typeof job.id).toBe("string");
      expect(job.id.length).toBeGreaterThan(10);
    });

    test("calls saveFn after creation", () => {
      manager.createJob({ userId: "user-2", query: "test" });
      expect(saveFn).toHaveBeenCalled();
    });

    test("accepts custom ttl", () => {
      const j = manager.createJob({ userId: "user-1", query: "test", ttl: 3600 });
      expect(j.ttl).toBe(3600);
    });

    test("accepts metadata", () => {
      const j = manager.createJob({
        userId: "user-1",
        query: "test",
        metadata: { sourcePreferences: ["academic"] },
      });
      expect(j.metadata).toEqual({ sourcePreferences: ["academic"] });
    });
  });

  describe("job retrieval", () => {
    let jobId;

    beforeAll(() => {
      const j = manager.createJob({ userId: "user-get", query: "retrieval test" });
      jobId = j.id;
    });

    test("getJob returns a job by id", () => {
      const job = manager.getJob(jobId);
      expect(job).toBeTruthy();
      expect(job.id).toBe(jobId);
      expect(job.query).toBe("retrieval test");
    });

    test("getJob returns null for nonexistent id", () => {
      expect(manager.getJob("nonexistent-id")).toBeNull();
    });

    test("getJob parses query_decomposition JSON", () => {
      manager.setQueryDecomposition(jobId, ["sub-q1", "sub-q2"]);
      const job = manager.getJob(jobId);
      expect(Array.isArray(job.query_decomposition)).toBe(true);
      expect(job.query_decomposition).toEqual(["sub-q1", "sub-q2"]);
    });

    test("getJob parses metadata JSON", () => {
      const j = manager.createJob({
        userId: "user-get",
        query: "meta test",
        metadata: { key: "value" },
      });
      const retrieved = manager.getJob(j.id);
      expect(retrieved.metadata).toEqual({ key: "value" });
    });

    test("listJobs returns jobs for a user_id", () => {
      const jobs = manager.listJobs({ userId: "user-get" });
      expect(jobs.length).toBeGreaterThanOrEqual(1);
      expect(jobs.every((j) => j.user_id === "user-get")).toBe(true);
    });

    test("listJobs filters by status", () => {
      const jobs = manager.listJobs({ userId: "user-get", status: "QUEUED" });
      expect(jobs.every((j) => j.status === "QUEUED")).toBe(true);
    });

    test("listJobs orders by created_at DESC", () => {
      const jobs = manager.listJobs({ userId: "user-get" });
      for (let i = 1; i < jobs.length; i++) {
        expect(jobs[i - 1].created_at >= jobs[i].created_at).toBe(true);
      }
    });

    test("listJobs respects limit parameter", () => {
      const jobs = manager.listJobs({ userId: "user-get", limit: 1 });
      expect(jobs.length).toBeLessThanOrEqual(1);
    });
  });

  describe("status transitions", () => {
    let jobId;

    beforeEach(() => {
      const j = manager.createJob({ userId: "user-status", query: "status test" });
      jobId = j.id;
      saveFn.mockClear();
    });

    test("updateStatus transitions QUEUED -> PROCESSING", () => {
      manager.updateStatus(jobId, "PROCESSING");
      const job = manager.getJob(jobId);
      expect(job.status).toBe("PROCESSING");
    });

    test("updateStatus transitions PROCESSING -> SYNTHESIZING", () => {
      manager.updateStatus(jobId, "PROCESSING");
      manager.updateStatus(jobId, "SYNTHESIZING");
      const job = manager.getJob(jobId);
      expect(job.status).toBe("SYNTHESIZING");
    });

    test("updateStatus calls saveFn", () => {
      manager.updateStatus(jobId, "PROCESSING");
      expect(saveFn).toHaveBeenCalled();
    });

    test("completeJob sets status=COMPLETED with result_id and confidence_score", () => {
      manager.completeJob(jobId, {
        resultId: "result-1",
        confidenceScore: 0.87,
        sourceCount: 12,
        hasContradictions: false,
      });
      const job = manager.getJob(jobId);
      expect(job.status).toBe("COMPLETED");
      expect(job.result_id).toBe("result-1");
      expect(job.confidence_score).toBeCloseTo(0.87);
      expect(job.source_count).toBe(12);
      expect(job.completed_at).toBeTruthy();
    });

    test("failJob sets status=FAILED with error_message", () => {
      manager.failJob(jobId, "Provider timeout");
      const job = manager.getJob(jobId);
      expect(job.status).toBe("FAILED");
      expect(job.error_message).toBe("Provider timeout");
    });
  });

  describe("stage progress tracking", () => {
    let jobId;

    beforeAll(() => {
      const j = manager.createJob({ userId: "user-stage", query: "stage test" });
      jobId = j.id;
    });

    test("updateStageProgress sets current_stage and stage_progress", () => {
      manager.updateStageProgress(jobId, "retrieval", 0.5);
      const job = manager.getJob(jobId);
      expect(job.current_stage).toBe("retrieval");
      expect(job.stage_progress).toBeCloseTo(0.5);
    });

    test("setQueryDecomposition stores sub-questions as JSON", () => {
      const subs = ["What is X?", "How does Y work?", "Why Z?"];
      manager.setQueryDecomposition(jobId, subs);
      const job = manager.getJob(jobId);
      expect(job.query_decomposition).toEqual(subs);
    });
  });

  describe("result storage", () => {
    let jobId, resultId;

    beforeAll(() => {
      const j = manager.createJob({ userId: "user-result", query: "result test" });
      jobId = j.id;
    });

    test("saveResult creates research_results row linked to job", () => {
      resultId = manager.saveResult({
        jobId,
        synthesis: "Quantum computing uses qubits...",
        sources: [{ url: "https://example.com", title: "Source 1" }],
        claims: [{ text: "Qubits are probabilistic", confidence: 0.9 }],
        evidenceSet: ["chunk-1", "chunk-2"],
        tokenUsage: { prompt: 1000, completion: 500 },
      });
      expect(resultId).toBeTruthy();
    });

    test("getResult returns full result with parsed JSON fields", () => {
      const result = manager.getResult(jobId);
      expect(result).toBeTruthy();
      expect(result.synthesis).toBe("Quantum computing uses qubits...");
      expect(Array.isArray(result.sources)).toBe(true);
      expect(result.sources[0].url).toBe("https://example.com");
      expect(Array.isArray(result.claims)).toBe(true);
      expect(result.token_usage.prompt).toBe(1000);
    });

    test("getResult returns null for nonexistent job", () => {
      expect(manager.getResult("nonexistent")).toBeNull();
    });
  });

  describe("source storage", () => {
    let jobId;

    beforeAll(() => {
      const j = manager.createJob({ userId: "user-source", query: "source test" });
      jobId = j.id;
    });

    test("addSource creates research_sources row linked to job", () => {
      const id = manager.addSource({
        jobId,
        url: "https://nature.com/article",
        title: "Quantum Computing Review",
        contentPreview: "This paper reviews...",
        domainAuthority: 95,
        recencyScore: 0.9,
        relevanceScore: 0.85,
        credibilityTier: "PRIMARY_SOURCE",
        compositeScore: 0.91,
        retrievalMethod: "rag",
      });
      expect(id).toBeTruthy();
    });

    test("addSource stores all scoring fields", () => {
      manager.addSource({
        jobId,
        url: "https://blog.example.com",
        title: "Blog Post",
        domainAuthority: 30,
        recencyScore: 0.5,
        relevanceScore: 0.6,
        credibilityTier: "UNVERIFIED",
        compositeScore: 0.4,
        retrievalMethod: "web",
      });

      const sources = manager.getSourcesForJob(jobId);
      const blog = sources.find((s) => s.url === "https://blog.example.com");
      expect(blog.domain_authority).toBe(30);
      expect(blog.credibility_tier).toBe("UNVERIFIED");
      expect(blog.retrieval_method).toBe("web");
    });

    test("getSourcesForJob returns sources ordered by composite_score DESC", () => {
      const sources = manager.getSourcesForJob(jobId);
      expect(sources.length).toBe(2);
      expect(sources[0].composite_score).toBeGreaterThanOrEqual(sources[1].composite_score);
    });

    test("getSourcesForJob returns empty array when no sources", () => {
      const j = manager.createJob({ userId: "user-empty", query: "empty" });
      expect(manager.getSourcesForJob(j.id)).toEqual([]);
    });
  });

  describe("job expiration", () => {
    test("expireJob sets status to EXPIRED", () => {
      const j = manager.createJob({ userId: "user-expire", query: "expire test" });
      manager.expireJob(j.id);
      const job = manager.getJob(j.id);
      expect(job.status).toBe("EXPIRED");
    });
  });

  describe("queue summary", () => {
    test("getQueueSummary returns counts by status", () => {
      const summary = manager.getQueueSummary();
      expect(summary).toHaveProperty("QUEUED");
      expect(summary).toHaveProperty("total");
      expect(typeof summary.total).toBe("number");
    });
  });

  describe("deleteJob", () => {
    test("removes a job and cascades to results and sources", () => {
      const j = manager.createJob({ userId: "user-del", query: "delete test" });
      manager.saveResult({ jobId: j.id, synthesis: "test", sources: [], claims: [] });
      manager.addSource({ jobId: j.id, url: "https://x.com", compositeScore: 0.5 });

      manager.deleteJob(j.id);
      expect(manager.getJob(j.id)).toBeNull();
      expect(manager.getResult(j.id)).toBeNull();
      expect(manager.getSourcesForJob(j.id)).toEqual([]);
    });
  });
});
