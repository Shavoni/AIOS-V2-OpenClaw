const express = require("express");
const request = require("supertest");

// Mock auth middleware — always passes with user
jest.mock("../../src/middleware/auth-middleware", () => ({
  authRequired: () => (req, _res, next) => {
    req.user = { id: "user-1", role: "operator" };
    next();
  },
}));

const { createResearchRoutes } = require("../../src/research/routes");

describe("Research Routes", () => {
  let app, mockQueueService, mockManager;

  beforeEach(() => {
    mockManager = {
      getJob: jest.fn(),
      listJobs: jest.fn().mockReturnValue([]),
      getResult: jest.fn(),
      getSourcesForJob: jest.fn().mockReturnValue([]),
    };

    mockQueueService = {
      submitJob: jest.fn().mockResolvedValue({ id: "job-1", status: "QUEUED", query: "test" }),
      cancelJob: jest.fn().mockResolvedValue(true),
      getQueueSummary: jest.fn().mockReturnValue({ QUEUED: 1, PROCESSING: 0, COMPLETED: 2, FAILED: 0 }),
    };

    app = express();
    app.use(express.json());
    app.use("/api/research", createResearchRoutes(mockQueueService, mockManager));
  });

  // --- POST /api/research/jobs ---
  test("POST /jobs creates a research job", async () => {
    const res = await request(app)
      .post("/api/research/jobs")
      .send({ query: "What is quantum computing?" });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("id", "job-1");
    expect(mockQueueService.submitJob).toHaveBeenCalledWith(
      expect.objectContaining({ query: "What is quantum computing?", userId: "user-1" })
    );
  });

  test("POST /jobs returns 400 for missing query", async () => {
    const res = await request(app)
      .post("/api/research/jobs")
      .send({});

    expect(res.status).toBe(400);
  });

  test("POST /jobs returns 400 for empty query", async () => {
    const res = await request(app)
      .post("/api/research/jobs")
      .send({ query: "" });

    expect(res.status).toBe(400);
  });

  // --- GET /api/research/jobs ---
  test("GET /jobs returns list of jobs", async () => {
    mockManager.listJobs.mockReturnValue([
      { id: "job-1", query: "test", status: "COMPLETED" },
    ]);

    const res = await request(app).get("/api/research/jobs");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(mockManager.listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" })
    );
  });

  test("GET /jobs supports status filter", async () => {
    await request(app).get("/api/research/jobs?status=COMPLETED");
    expect(mockManager.listJobs).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" })
    );
  });

  // --- GET /api/research/jobs/:id ---
  test("GET /jobs/:id returns a specific job", async () => {
    mockManager.getJob.mockReturnValue({ id: "job-1", query: "test", status: "COMPLETED" });

    const res = await request(app).get("/api/research/jobs/job-1");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("id", "job-1");
  });

  test("GET /jobs/:id returns 404 for nonexistent job", async () => {
    mockManager.getJob.mockReturnValue(null);

    const res = await request(app).get("/api/research/jobs/nonexistent");

    expect(res.status).toBe(404);
  });

  // --- GET /api/research/jobs/:id/result ---
  test("GET /jobs/:id/result returns synthesis result", async () => {
    mockManager.getJob.mockReturnValue({ id: "job-1", status: "COMPLETED" });
    mockManager.getResult.mockReturnValue({
      synthesis: "# Report",
      sources: [],
      claims: [],
    });

    const res = await request(app).get("/api/research/jobs/job-1/result");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("synthesis", "# Report");
  });

  test("GET /jobs/:id/result returns 404 if no result", async () => {
    mockManager.getJob.mockReturnValue({ id: "job-1", status: "PROCESSING" });
    mockManager.getResult.mockReturnValue(null);

    const res = await request(app).get("/api/research/jobs/job-1/result");

    expect(res.status).toBe(404);
  });

  // --- GET /api/research/jobs/:id/sources ---
  test("GET /jobs/:id/sources returns sources for a job", async () => {
    mockManager.getJob.mockReturnValue({ id: "job-1", status: "COMPLETED" });
    mockManager.getSourcesForJob.mockReturnValue([
      { url: "https://a.com", composite_score: 0.9 },
    ]);

    const res = await request(app).get("/api/research/jobs/job-1/sources");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  // --- POST /api/research/jobs/:id/cancel ---
  test("POST /jobs/:id/cancel cancels a queued job", async () => {
    const res = await request(app).post("/api/research/jobs/job-1/cancel");

    expect(res.status).toBe(200);
    expect(mockQueueService.cancelJob).toHaveBeenCalledWith("job-1");
  });

  test("POST /jobs/:id/cancel returns 409 for non-cancellable job", async () => {
    mockQueueService.cancelJob.mockResolvedValue(false);

    const res = await request(app).post("/api/research/jobs/job-1/cancel");

    expect(res.status).toBe(409);
  });

  // --- GET /api/research/queue/summary ---
  test("GET /queue/summary returns queue statistics", async () => {
    const res = await request(app).get("/api/research/queue/summary");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("QUEUED", 1);
    expect(res.body).toHaveProperty("COMPLETED", 2);
  });
});
